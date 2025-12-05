import axios from 'axios';
import * as crypto from 'crypto';
// SỬA 1: Đổi cách import moment
import moment from 'moment'; 

export class ZaloPayService {
  private config = {
    app_id: "2554",
    key1: "sdngKKJmqEMzvh5QQcdD2A9XBSKq60//",
    key2: "trMrHtvjo6myautxDUiAcYsVtaeQ8nhf",
    endpoint: "https://sb-openapi.zalopay.vn/v2/create"
  };

  // Thay link Ngrok của bạn vào đây
  private callbackUrl = "https://stringily-riverine-jerrie.ngrok-free.dev/api/payment/webhook/zalopay";
  private redirectUrl = "cinebooking://payment-result";

  async createPaymentRequest(bookingId: string, amount: number) {
    const embed_data = {
      redirecturl: this.redirectUrl
    };

    const items = [{}]; 
    const transID = Math.floor(Math.random() * 1000000); 
    
    // moment() bây giờ sẽ gọi được bình thường
    const app_trans_id = `${moment().format('YYMMDD')}_${bookingId}`;

    const order = {
      app_id: this.config.app_id,
      app_user: "CineUser",
      app_trans_id: app_trans_id, 
      app_time: Date.now(), 
      amount: amount,
      item: JSON.stringify(items),
      description: `Thanh toan booking #${bookingId}`,
      embed_data: JSON.stringify(embed_data),
      callback_url: this.callbackUrl,
      mac: "" 
    };

    const data = `${order.app_id}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`;
    
    order.mac = crypto.createHmac('sha256', this.config.key1)
      .update(data)
      .digest('hex');

    try {
      console.log("🔵 [ZaloPay Request] Sending to:", this.config.endpoint);
      
      // SỬA 2: Thêm <any> vào axios.post<any> để báo TS biết data trả về kiểu gì cũng được
      const response = await axios.post<any>(this.config.endpoint, null, { params: order });
      
      console.log("🟢 [ZaloPay Response]:", response.data);

      // Bây giờ TS sẽ không báo lỗi dòng này nữa
      if (response.data.return_code === 1) {
        return {
          payUrl: response.data.order_url, 
          deeplink: response.data.zp_trans_token 
        };
      } else {
        throw new Error(`ZaloPay Error: ${response.data.return_message}`);
      }
    } catch (error: any) {
      console.error("🔴 [ZaloPay Exception]:", error.message);
      throw error;
    }
  }

  verifyCallback(body: any) {
    try {
      const { data: dataStr, mac: reqMac } = body;

      const macComputed = crypto.createHmac('sha256', this.config.key2)
        .update(dataStr)
        .digest('hex');

      if (reqMac !== macComputed) {
        console.log("❌ [ZaloPay] Invalid Signature");
        return { isValid: false };
      }

      const dataJson = JSON.parse(dataStr);
      console.log("💰 [ZaloPay Webhook Data]:", dataJson);

      const parts = dataJson.app_trans_id.split('_');
      const originalBookingId = parts.length > 1 ? parts[1] : dataJson.app_trans_id;

      return {
        isValid: true,
        bookingId: originalBookingId,
        amount: dataJson.amount,
        status: dataJson.status 
      };

    } catch (error) {
      console.error("Verify Zalo Error:", error);
      return { isValid: false };
    }
  }
}