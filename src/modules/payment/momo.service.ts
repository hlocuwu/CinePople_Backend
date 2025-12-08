import axios from 'axios';
import * as crypto from 'crypto';
import { env } from '../../config/env';

export class MomoService {
  // Thông tin cấu hình Sandbox (Test) Công khai của MoMo
  private config = {
    partnerCode: "MOMO",
    accessKey: "F8BBA842ECF85",
    secretKey: "K951B6PE1waDMi640xX08PD3vg6EkVlz",
    endpoint: "https://test-payment.momo.vn/v2/gateway/api/create"
  };

  // QUAN TRỌNG: Đây là đường dẫn Momo sẽ gọi về khi thanh toán xong
  // Hardcode IP Public để test nhanh (Thay vì dùng env)
  private ipnUrl = "https://stringily-riverine-jerrie.ngrok-free.dev/api/payment/webhook/momo";

  // URL Redirect: Quay về App sau khi thanh toán xong
  private redirectUrl = "cinebooking://payment-result";

  async createPaymentRequest(bookingId: string, amount: number) {
    // 1. Chuẩn bị dữ liệu
    const requestId = bookingId + new Date().getTime(); // Unique ID
    const orderId = bookingId;
    const orderInfo = `Thanh toán booking ${bookingId}`;
    const requestType = "captureWallet";
    const extraData = "";

    // 2. Tạo chữ ký (Signature)
    // QUAN TRỌNG: Phải đúng thứ tự alphabel (a-z) của các param
    const rawSignature = `accessKey=${this.config.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${this.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.config.partnerCode}&redirectUrl=${this.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

    const signature = crypto.createHmac('sha256', this.config.secretKey)
      .update(rawSignature)
      .digest('hex');

    // 3. Tạo Body Request (JSON)
    const requestBody = {
      partnerCode: this.config.partnerCode,
      accessKey: this.config.accessKey,
      requestId: requestId,
      amount: amount,
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      extraData: extraData,
      requestType: requestType,
      signature: signature,
      lang: 'vi'
    };

    try {
      console.log("🔵 [Momo Request] Sending to:", this.config.endpoint);

      // 4. Gửi HTTP Request bằng Axios (Thêm <any> để fix lỗi type unknown)
      const response = await axios.post<any>(this.config.endpoint, requestBody, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log("🟢 [Momo Response]:", response.data);

      if (response.data.resultCode === 0) {
        return {
          payUrl: response.data.payUrl,
          deeplink: response.data.deeplink
        };
      } else {
        throw new Error(`Momo Error: ${response.data.message}`);
      }
    } catch (error: any) {
      console.error("[Momo Exception]:", error.message);
      throw error;
    }
  }

  // Hàm kiểm tra chữ ký khi Momo gọi Webhook về
  verifySignature(data: any): boolean {
    const { partnerCode, accessKey, requestId, amount, orderId, orderInfo, orderType, transId, resultCode, message, payType, responseTime, extraData, signature } = data;

    const rawSignature = `accessKey=${this.config.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    const mySignature = crypto.createHmac('sha256', this.config.secretKey)
      .update(rawSignature)
      .digest('hex');

    return signature === mySignature;
  }
}