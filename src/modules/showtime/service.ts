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
    const doc = await docRef.get();
    
    if (!doc.exists) throw new ApiError(404, 'Không tìm thấy suất chiếu');
    
    const currentData = doc.data() as ShowtimeDocument;

    // VALIDATION: Không sửa nếu đã có người mua/giữ vé
    if (currentData.availableSeats < currentData.totalSeats) {
      throw new ApiError(400, 'Không thể sửa suất chiếu đã có vé được bán/giữ');
    }

    const updates: any = {
      updatedAt: Timestamp.now(),
      ...dto
    };

    // 1. Xử lý nếu đổi Phim (cần lấy tên phim & tính lại duration)
    let durationMinutes = 0;
    if (dto.movieId && dto.movieId !== currentData.movieId) {
      const movieDoc = await firebaseDB.collection(MOVIE_COLLECTION).doc(dto.movieId).get();
      if (!movieDoc.exists) throw new ApiError(404, 'Phim mới không tồn tại');
      
      const movieData = movieDoc.data();
      updates.movieTitle = movieData?.title || 'Unknown';
      durationMinutes = parseInt(movieData?.duration || "0");
    } else {
      // Nếu không đổi phim, lấy duration của phim hiện tại để tính lại endTime nếu startTime đổi
      // (Lưu ý: Logic này giả định cần query lại phim cũ để lấy duration, hoặc lưu duration vào showtime doc)
      // Để đơn giản, ta query lại phim hiện tại
      const movieDoc = await firebaseDB.collection(MOVIE_COLLECTION).doc(currentData.movieId).get();
      durationMinutes = parseInt(movieDoc.data()?.duration || "0");
    }

    // 2. Xử lý nếu đổi Rạp (cần lấy tên rạp & regionId)
    if (dto.cinemaId && dto.cinemaId !== currentData.cinemaId) {
      const cinemaDoc = await firebaseDB.collection(CINEMA_COLLECTION).doc(dto.cinemaId).get();
      if (!cinemaDoc.exists) throw new ApiError(404, 'Rạp mới không tồn tại');
      
      const cinemaData = cinemaDoc.data();
      updates.cinemaName = cinemaData?.name;
      updates.regionId = cinemaData?.regionId;
    }

    // 3. Tính toán lại StartTime & EndTime
    if (dto.startTime || dto.movieId) {
       // Nếu có gửi startTime mới thì dùng, không thì dùng cái cũ
       const newStartTimeDate = dto.startTime ? new Date(dto.startTime) : (currentData.startTime as Timestamp).toDate();
       const newEndTimeDate = new Date(newStartTimeDate.getTime() + durationMinutes * 60000);
       
       if (dto.startTime) updates.startTime = Timestamp.fromDate(newStartTimeDate);
       updates.endTime = Timestamp.fromDate(newEndTimeDate);
    }

    // 4. Xử lý nếu đổi Giá vé (update lại seatMap)
    if (dto.price && dto.price !== Object.values(currentData.seatMap)[0].price) { // So sánh cơ bản
       const newSeatMap = { ...currentData.seatMap };
       Object.keys(newSeatMap).forEach(key => {
         const seat = newSeatMap[key];
         // Chỉ update giá ghế thường/vip, logic tùy chỉnh
         // Ví dụ đơn giản: Update base price
         if (seat.type === SeatType.STANDARD) {
            seat.price = dto.price!;
         } else if (seat.type === SeatType.VIP) {
            seat.price = dto.price! * 1.2; // Giữ tỉ lệ VIP
         }
       });
       updates.seatMap = newSeatMap;
    }

    // Thực hiện update
    // Dùng delete undefined fields để tránh lỗi Firestore nếu dto có field undefined
    Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

    await docRef.update(updates);

    // Trả về dữ liệu mới
    const updatedDoc = await docRef.get();
    return this.toShowtime(updatedDoc);
  }

  /**
   * Xóa suất chiếu
   * Logic: Không cho xóa nếu đã có vé bán ra.
   */
  async deleteShowtime(id: string): Promise<void> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) throw new ApiError(404, 'Không tìm thấy suất chiếu');

    const data = doc.data() as ShowtimeDocument;

    if (data.availableSeats < data.totalSeats) {
      throw new ApiError(400, 'Không thể xóa suất chiếu đã có vé được bán/giữ');
    }

    await docRef.delete();
  }
}