import { firebaseDB } from '../../config/firebase';
import { Showtime, ShowtimeDocument, Seat, SeatStatus, SeatType } from './model';
import { CreateShowtimeDto, UpdateShowtimeDto } from './dto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ApiError } from '../../utils/ApiError';

const SHOWTIME_COLLECTION = 'showtimes';
const MOVIE_COLLECTION = 'movies';
const CINEMA_COLLECTION = 'cinemas';

export class ShowtimeService {
  private collection = firebaseDB.collection(SHOWTIME_COLLECTION);

  private toShowtime(doc: FirebaseFirestore.DocumentSnapshot): Showtime {
    const data = doc.data() as ShowtimeDocument;
    return {
      id: doc.id,
      ...data,
      startTime: (data.startTime as Timestamp).toDate(),
      endTime: (data.endTime as Timestamp).toDate(),
      // createdAt và updatedAt xử lý tương tự nếu cần
    } as Showtime;
  }

  /**
   * Helper: Tạo sơ đồ ghế giả lập (5 hàng x 10 ghế)
   * Trong thực tế, bạn sẽ lấy layout này từ module "Room"
   */
  private generateStandardSeats(basePrice: number): Record<string, Seat> {
    const rows = ['A', 'B', 'C', 'D', 'E'];
    const cols = 10;
    const seatMap: Record<string, Seat> = {};

    rows.forEach((row) => {
      for (let i = 1; i <= cols; i++) {
        const code = `${row}${i}`;
        // Ví dụ: Hàng E là VIP, giá +20%
        const isVip = row === 'E';
        const type = isVip ? SeatType.VIP : SeatType.STANDARD;
        const price = isVip ? basePrice * 1.2 : basePrice;

        seatMap[code] = {
          code,
          row,
          col: i,
          type,
          price,
          status: SeatStatus.AVAILABLE,
        };
      }
    });

    return seatMap;
  }

  /**
   * Lấy danh sách suất chiếu theo Phim và Tỉnh (Và ngày nếu cần)
   * Đây là API chính cho màn hình "Chọn Rạp & Giờ"
   */
  async getShowtimes(movieId: string, regionId: string, date?: string): Promise<Showtime[]> {
    let query = this.collection
      .where('movieId', '==', movieId)
      .where('regionId', '==', regionId);

    // Lọc thời gian: Lấy suất chiếu > thời gian hiện tại
    const now = Timestamp.now();
    query = query.where('startTime', '>', now);

    const snapshot = await query.orderBy('startTime', 'asc').get();

    if (snapshot.empty) return [];

    const showtimes = snapshot.docs.map(this.toShowtime);

    // Nếu có lọc theo ngày cụ thể (client gửi YYYY-MM-DD)
    if (date) {
      return showtimes.filter(st => {
        const stDate = st.startTime.toISOString().split('T')[0];
        return stDate === date;
      });
    }

    return showtimes;
  }

  async getShowtimeById(id: string): Promise<Showtime | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return this.toShowtime(doc);
  }

  async createShowtime(dto: CreateShowtimeDto): Promise<Showtime> {
    // 1. Lấy thông tin Phim
    const movieDoc = await firebaseDB.collection(MOVIE_COLLECTION).doc(dto.movieId).get();
    if (!movieDoc.exists) throw new ApiError(404, 'Phim không tồn tại');
    const movieData = movieDoc.data();

    // 2. Lấy thông tin Rạp (để lấy regionId và tên rạp)
    const cinemaDoc = await firebaseDB.collection(CINEMA_COLLECTION).doc(dto.cinemaId).get();
    if (!cinemaDoc.exists) throw new ApiError(404, 'Rạp không tồn tại');
    const cinemaData = cinemaDoc.data();

    // 3. Tính toán thời gian kết thúc (dựa vào duration phim)
    const durationMinutes = parseInt(movieData?.duration || "0"); // VD: "120"
    const startTimeDate = new Date(dto.startTime);
    const endTimeDate = new Date(startTimeDate.getTime() + durationMinutes * 60000);

    // 4. Sinh ghế
    const seatMap = this.generateStandardSeats(dto.price);
    const totalSeats = Object.keys(seatMap).length;

    // 5. Tạo Doc
    const newShowtime: ShowtimeDocument = {
      movieId: dto.movieId,
      movieTitle: movieData?.title || "Unknown Movie",
      
      cinemaId: dto.cinemaId,
      cinemaName: cinemaData?.name || "Unknown Cinema",
      regionId: cinemaData?.regionId || "", // Quan trọng: Lưu regionId từ rạp sang
      
      roomName: dto.roomName,
      startTime: Timestamp.fromDate(startTimeDate),
      endTime: Timestamp.fromDate(endTimeDate),
      
      seatMap: seatMap,
      totalSeats: totalSeats,
      availableSeats: totalSeats,
      
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const ref = await this.collection.add(newShowtime);
    const newDoc = await ref.get();
    return this.toShowtime(newDoc);
  }

  async updateShowtime(id: string, dto: UpdateShowtimeDto): Promise<Showtime> {
    const docRef = this.collection.doc(id);

    return await firebaseDB.runTransaction(async (transaction) => {
      // 1. Đọc dữ liệu mới nhất trong Transaction
      const doc = await transaction.get(docRef);
      if (!doc.exists) throw new ApiError(404, 'Không tìm thấy suất chiếu');

      const currentData = doc.data() as ShowtimeDocument;
      const seatMap = currentData.seatMap || {};

      // 2. [FIX VALIDATION] Check kỹ từng ghế xem có ai mua chưa
      // Bỏ qua ghế LOCKED (bảo trì), chỉ chặn nếu có người đang giữ hoặc đã mua
      const hasBookedSeats = Object.values(seatMap).some((seat) => {
        return seat.status === SeatStatus.SOLD || seat.status === SeatStatus.HELD;
      });

      if (hasBookedSeats) {
        throw new ApiError(400, 'Không thể cập nhật suất chiếu đã có vé bán ra hoặc đang giữ chỗ.');
      }

      // 3. Chuẩn bị dữ liệu update
      const updates: any = {
        updatedAt: Timestamp.now(),
        // spread dto nhưng loại bỏ undefined
        ...Object.fromEntries(Object.entries(dto).filter(([_, v]) => v !== undefined))
      };

      // --- LOGIC XỬ LÝ DỮ LIỆU ---

      // A. Nếu đổi Phim -> Cập nhật tên & Tính lại giờ kết thúc
      let durationMinutes = 0;
      // Nếu có gửi movieId mới hoặc cần lấy lại duration cũ để tính lại time
      const movieIdToCheck = dto.movieId || currentData.movieId;
      
      // Tối ưu: Chỉ query phim nếu movieId thay đổi HOẶC startTime thay đổi (cần duration để tính endTime)
      if (dto.movieId || dto.startTime) {
         const movieDoc = await transaction.get(firebaseDB.collection(MOVIE_COLLECTION).doc(movieIdToCheck));
         if (!movieDoc.exists) throw new ApiError(404, 'Phim không tồn tại');
         
         const movieData = movieDoc.data();
         if (dto.movieId) updates.movieTitle = movieData?.title; // Chỉ update title nếu đổi phim
         durationMinutes = parseInt(movieData?.duration || "0");
      }

      // B. [CẢNH BÁO] Chặn đổi Cinema/Room nếu không muốn reset ghế
      if (dto.cinemaId && dto.cinemaId !== currentData.cinemaId) {
         throw new ApiError(400, 'Không hỗ trợ đổi Rạp cho suất chiếu đã tạo. Vui lòng tạo mới.');
      }
      // (Nếu muốn cho đổi Room cùng rạp thì phải đảm bảo layout giống nhau, tạm thời bỏ qua logic này cho an toàn)

      // C. Tính lại StartTime & EndTime
      if (dto.startTime || (dto.movieId && durationMinutes > 0)) {
        const newStartTimeDate = dto.startTime ? new Date(dto.startTime) : (currentData.startTime as Timestamp).toDate();
        const newEndTimeDate = new Date(newStartTimeDate.getTime() + durationMinutes * 60000);

        updates.startTime = Timestamp.fromDate(newStartTimeDate);
        updates.endTime = Timestamp.fromDate(newEndTimeDate);
      }

      // D. [FIX PRICE] Cập nhật giá vé an toàn
      // Vì đang trong transaction và đã check hasBookedSeats = false, ta có thể an tâm sửa giá
      if (dto.price !== undefined) {
        const newSeatMap = { ...seatMap }; // Copy map hiện tại
        
        Object.keys(newSeatMap).forEach(key => {
          const seat = newSeatMap[key];
          
          // Logic giá: Base price cho Standard, +20% cho VIP (hoặc logic tùy chỉnh của bạn)
          if (seat.type === SeatType.STANDARD) {
            seat.price = dto.price!;
          } else if (seat.type === SeatType.VIP) {
            seat.price = dto.price! * 1.2; 
          }
          // COUPLE...
        });
        
        updates.seatMap = newSeatMap;
      }

      // 4. Thực thi Update
      transaction.update(docRef, updates);

      // Trả về dữ liệu mockup đã update (đỡ phải get lại lần nữa)
      return {
          id: docRef.id,
          ...currentData,
          ...updates,
          startTime: (updates.startTime || currentData.startTime).toDate(),
          endTime: (updates.endTime || currentData.endTime).toDate()
      } as Showtime;
    });
  }

  /**
   * Xóa suất chiếu
   * Fix: Kiểm tra trực tiếp trong seatMap thay vì tin vào biến đếm availableSeats
   */
  async deleteShowtime(id: string): Promise<void> {
    const docRef = this.collection.doc(id);
    
    // Dùng transaction để đảm bảo dữ liệu nhất quán nhất khi đọc
    await firebaseDB.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) throw new ApiError(404, 'Không tìm thấy suất chiếu');

      const data = doc.data() as ShowtimeDocument;
      const seatMap = data.seatMap || {};

      // QUAN TRỌNG: Quét toàn bộ ghế để xem có ghế nào đang không Available hay không
      // Nếu có ghế SOLD (đã bán) hoặc HELD (đang giữ chỗ thanh toán) -> Chặn xóa
      const hasBookedSeats = Object.values(seatMap).some((seat) => {
        return seat.status === SeatStatus.SOLD || seat.status === SeatStatus.HELD;
      });

      if (hasBookedSeats) {
        throw new ApiError(400, 'Không thể xóa suất chiếu đã có vé được bán hoặc đang giữ chỗ.');
      }

      // Nếu an toàn thì mới xóa
      transaction.delete(docRef);
    });
  }
}