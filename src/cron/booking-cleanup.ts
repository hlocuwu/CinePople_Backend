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
    console.log('🧹 [CRON] Đang quét các booking hết hạn...');

    const now = Timestamp.now();

    try {
      // 1. Tìm các booking đang PENDING mà đã hết hạn
      const snapshot = await bookingCol
        .where('status', '==', BookingStatus.PENDING)
        .where('expiresAt', '<', now)
        .get();

      if (snapshot.empty) {
        return;
      }

      console.log(`⚠️ Tìm thấy ${snapshot.size} booking hết hạn. Đang xử lý...`);

      const batch = firebaseDB.batch();
      let hasOperation = false;

      // 2. Duyệt qua từng booking hết hạn
      for (const doc of snapshot.docs) {
        const bookingData = doc.data();
        const showtimeId = bookingData.showtimeId;
        const seats = bookingData.seats as string[]; // ['A1', 'A2']

        // A. Cập nhật trạng thái Booking -> CANCELLED (Luôn thực hiện)
        const bookingRef = bookingCol.doc(doc.id);
        batch.update(bookingRef, {
          status: BookingStatus.CANCELLED,
          updatedAt: now
        });
        hasOperation = true;

        // B. Nhả ghế trong Showtime (CÓ KIỂM TRA TỒN TẠI)
        if (showtimeId) {
            const showtimeRef = showtimeCol.doc(showtimeId);
            
            // 🔥 QUAN TRỌNG: Phải đọc xem Suất chiếu còn tồn tại không
            const showtimeDoc = await showtimeRef.get();

            if (showtimeDoc.exists) {
                // Nếu còn tồn tại thì mới update nhả ghế
                const seatUpdates: any = {};
                seats.forEach((seatCode) => {
                    seatUpdates[`seatMap.${seatCode}.status`] = SeatStatus.AVAILABLE;
                    seatUpdates[`seatMap.${seatCode}.userId`] = FieldValue.delete();
                });
                batch.update(showtimeRef, seatUpdates);
            } else {
                console.warn(`⚠️ Showtime ${showtimeId} không tồn tại, chỉ hủy booking.`);
            }
        }
      }

      // 3. Thực thi tất cả thay đổi
      if (hasOperation) {
          await batch.commit();
          console.log(`✅ Đã hủy thành công ${snapshot.size} booking và nhả ghế.`);
      }

    } catch (error) {
      console.error('❌ [CRON ERROR] Lỗi khi dọn dẹp booking:', error);
    }
  });
};