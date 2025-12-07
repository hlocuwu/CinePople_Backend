import { firebaseDB } from '../../config/firebase';
import { CreateBookingDto } from './dto';
import { Booking, BookingDocument, BookingStatus } from './model';
import { SeatStatus, ShowtimeDocument } from '../showtime/model'; 
import { Timestamp } from 'firebase-admin/firestore';
import { ApiError } from '../../utils/ApiError';
import { VoucherService } from '../voucher/service'; // Import VoucherService

const BOOKING_COLLECTION = 'bookings';
const SHOWTIME_COLLECTION = 'showtimes';

export class BookingService {
  private bookingCol = firebaseDB.collection(BOOKING_COLLECTION);
  private showtimeCol = firebaseDB.collection(SHOWTIME_COLLECTION);
  private voucherService = new VoucherService(); // Khởi tạo service

  /**
   * Helper chuyển đổi Document sang Model chuẩn
   */
  private toBooking(doc: FirebaseFirestore.DocumentSnapshot): Booking {
    const data = doc.data() as BookingDocument;
    return {
      id: doc.id,
      ...data,
      showtimeDate: (data.showtimeDate as Timestamp).toDate(),
      createdAt: (data.createdAt as Timestamp).toDate(),
      updatedAt: (data.updatedAt as Timestamp).toDate(),
      expiresAt: (data.expiresAt as Timestamp).toDate(),
    };
  }

  /**
   * Tạo Booking & Giữ ghế (Transaction)
   */
  async createBooking(userId: string, dto: CreateBookingDto): Promise<Booking> {
    const showtimeRef = this.showtimeCol.doc(dto.showtimeId);
    const bookingRef = this.bookingCol.doc(); 

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 10 * 60 * 1000); 

    return await firebaseDB.runTransaction(async (transaction) => {
      // 1. Đọc document Showtime (Giữ nguyên)
      const showtimeDoc = await transaction.get(showtimeRef);
      if (!showtimeDoc.exists) {
        throw new ApiError(404, 'Suất chiếu không tồn tại');
      }

      const showtimeData = showtimeDoc.data() as ShowtimeDocument;
      const seatMap = showtimeData.seatMap;
      
      // 2. Validate & Tính giá gốc (Giữ nguyên)
      let originalTotalPrice = 0;
      const seatUpdates: any = {}; 

      for (const seatCode of dto.seats) {
        const seat = seatMap[seatCode];
        if (!seat) throw new ApiError(400, `Ghế ${seatCode} không tồn tại`);
        if (seat.status !== SeatStatus.AVAILABLE) throw new ApiError(400, `Ghế ${seatCode} đã được đặt`);

        originalTotalPrice += seat.price;

        seatUpdates[`seatMap.${seatCode}.status`] = SeatStatus.HELD;
        seatUpdates[`seatMap.${seatCode}.userId`] = userId;
        // Có thể lưu thêm expireAt vào ghế để cronjob quét dễ hơn
      }

      // 3. --- LOGIC TÍNH TIỀN VOUCHER (ĐÃ SỬA) ---
      let finalPrice = originalTotalPrice;
      let discountAmount = 0;
      let voucherCodeApplied = null;

      if (dto.voucherCode) {
        // [FIX] Truyền transaction vào để lock Voucher
        const voucherResult = await this.voucherService.applyVoucher(
            dto.voucherCode, 
            originalTotalPrice, 
            transaction
        );
        
        finalPrice = voucherResult.finalPrice;
        discountAmount = voucherResult.discountAmount;
        voucherCodeApplied = voucherResult.code;

        // [CRITICAL FIX] Cập nhật số lượt dùng của Voucher ngay trong transaction này
        transaction.update(voucherResult.voucherRef, {
            usedCount: voucherResult.currentUsedCount + 1
        });
      }

      // 4. Update Firestore Showtime (Giữ ghế)
      transaction.update(showtimeRef, seatUpdates);

      // 5. Tạo Booking Document
      const newBooking: BookingDocument = {
        userId,
        showtimeId: dto.showtimeId,
        movieTitle: showtimeData.movieTitle,
        cinemaName: showtimeData.cinemaName,
        roomName: showtimeData.roomName,
        showtimeDate: showtimeData.startTime,
        seats: dto.seats,
        seatPrice: originalTotalPrice / dto.seats.length,
        
        originalPrice: originalTotalPrice,
        discountAmount: discountAmount,
        finalPrice: finalPrice,
        voucherCode: voucherCodeApplied, // Dùng biến đã validate
        
        totalPrice: finalPrice,

        status: BookingStatus.PENDING,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresAt,
      };

      transaction.set(bookingRef, newBooking);

      return {
        id: bookingRef.id,
        ...newBooking,
        showtimeDate: newBooking.showtimeDate.toDate(),
        createdAt: newBooking.createdAt.toDate(),
        updatedAt: newBooking.updatedAt.toDate(),
        expiresAt: newBooking.expiresAt.toDate(),
        paymentAt: undefined,
      };
    });
  }

    async getAllBookings(): Promise<Booking[]> {
    const snapshot = await this.bookingCol
      .orderBy('createdAt', 'desc')
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => this.toBooking(doc));
  }

  /**
   * Lấy danh sách booking của User
   */
  async getMyBookings(userId: string): Promise<Booking[]> {
    const snapshot = await this.bookingCol
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => this.toBooking(doc));
  }

  /**
   * Lấy chi tiết booking
   */
  async getBookingById(bookingId: string, userId: string): Promise<Booking> {
    const doc = await this.bookingCol.doc(bookingId).get();
    if (!doc.exists) throw new ApiError(404, 'Booking không tìm thấy');

    const booking = this.toBooking(doc);

    if (booking.userId !== userId) {
      throw new ApiError(403, 'Bạn không có quyền xem booking này');
    }

    return booking;
  }
}