import { firebaseDB } from "../config/firebase";
import admin from "firebase-admin";

export async function saveOTP(phone: string, code: string) {
    const otpRef = firebaseDB.collection('otps').doc(phone);

    // Lưu mã OTP trong 5 phút
    await otpRef.set({
        code,
        phone,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000) // 5 phút
    });
}

export async function verifyOTP(phone: string, code: string) {
    const otpRef = firebaseDB.collection('otps').doc(phone);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
        return false;
    }

    const otpData = otpDoc.data()!;
    const now = admin.firestore.Timestamp.now();

    // Kiểm tra mã OTP hết hạn hay chưa
    if (now.toMillis() > otpData.expiresAt.toMillis()) {
        // Xóa mã OTP đã hết hạn
        await otpRef.delete();
        return false;
    }

    // Xóa mã OTP sau khi đã được sử dụng
    await otpRef.delete();

    return otpData.code === code;
}