import cron from 'node-cron';
import { firebaseDB } from '../config/firebase';
import { BookingStatus } from '../modules/booking/model';
import { SeatStatus } from '../modules/showtime/model';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const bookingCol = firebaseDB.collection('bookings');
const showtimeCol = firebaseDB.collection('showtimes');

export const startBookingCleanupJob = () => {
  // Chạy mỗi phút một lần (* * * * *)
  cron.schedule('* * * * *', async () => {
    console.log('[CRON] Đang quét các booking hết hạn...');

    const now = Timestamp.now();

    try {
      // 1. Tìm các booking đang PENDING mà đã hết hạn
      const snapshot = await bookingCol
        .where('status', '==', BookingStatus.PENDING)
        .where('expiresAt', '<', now)
        .get();

      if (snapshot.empty) {
        // console.log('Không có booking nào hết hạn.');
        return;
      }

      console.log(`Tìm thấy ${snapshot.size} booking hết hạn. Đang xử lý...`);

      const batch = firebaseDB.batch(); // Dùng Batch để xử lý hàng loạt cho nhanh

      // 2. Duyệt qua từng booking hết hạn
      for (const doc of snapshot.docs) {
        const bookingData = doc.data();
        const showtimeId = bookingData.showtimeId;
        const seats = bookingData.seats as string[]; // ['A1', 'A2']

        // A. Cập nhật trạng thái Booking -> CANCELLED
        const bookingRef = bookingCol.doc(doc.id);
        batch.update(bookingRef, {
          status: BookingStatus.CANCELLED,
          updatedAt: now
        });

        // B. Nhả ghế trong Showtime -> AVAILABLE
        const showtimeRef = showtimeCol.doc(showtimeId);

        // Tạo object update động: { "seatMap.A1.status": "available", ... }
        const seatUpdates: any = {};
        seats.forEach((seatCode) => {
          seatUpdates[`seatMap.${seatCode}.status`] = SeatStatus.AVAILABLE;
          seatUpdates[`seatMap.${seatCode}.userId`] = FieldValue.delete(); // Xóa người giữ
        });

        batch.update(showtimeRef, seatUpdates);
      }

      // 3. Thực thi tất cả thay đổi
      await batch.commit();
      console.log(`Đã hủy thành công ${snapshot.size} booking và nhả ghế.`);

    } catch (error) {
      console.error('[CRON ERROR] Lỗi khi dọn dẹp booking:', error);
    }
  });
};