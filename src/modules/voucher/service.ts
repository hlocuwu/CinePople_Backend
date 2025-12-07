import { firebaseDB } from '../../config/firebase';
import { Voucher, VoucherDocument, DiscountType } from './model';
import { CreateVoucherDto } from './dto';
import { Timestamp } from 'firebase-admin/firestore';
import { ApiError } from '../../utils/ApiError';

const VOUCHER_COLLECTION = 'vouchers';

export class VoucherService {
  private collection = firebaseDB.collection(VOUCHER_COLLECTION);

  /**
   * Tạo Voucher mới
   */
  async createVoucher(dto: CreateVoucherDto): Promise<Voucher> {
    // Check trùng code
    const snapshot = await this.collection.where('code', '==', dto.code.toUpperCase()).get();
    if (!snapshot.empty) {
      throw new ApiError(400, 'Mã Voucher đã tồn tại');
    }

    const newVoucher: VoucherDocument = {
      code: dto.code.toUpperCase(),
      description: dto.description,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      maxDiscount: dto.maxDiscount || 0,
      minOrderValue: dto.minOrderValue,
      usageLimit: dto.usageLimit,
      usedCount: 0,
      validFrom: Timestamp.fromDate(new Date(dto.validFrom)),
      validTo: Timestamp.fromDate(new Date(dto.validTo)),
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const ref = await this.collection.add(newVoucher);
    return { id: ref.id, ...newVoucher };
  }

  /**
   * Kiểm tra và Tính toán giảm giá (Hỗ trợ Transaction)
   */
  async applyVoucher(
    code: string, 
    orderTotal: number, 
    transaction?: FirebaseFirestore.Transaction // [ADD] Thêm tham số transaction
  ) {
    // 1. Tìm Voucher ID trước (Query không hỗ trợ trực tiếp trong transaction.get nếu không biết ID)
    const snapshotQuery = await this.collection
      .where('code', '==', code.toUpperCase())
      .limit(1)
      .get();
    
    if (snapshotQuery.empty) throw new ApiError(404, 'Mã giảm giá không tồn tại');

    const voucherRef = snapshotQuery.docs[0].ref; // Lấy Reference

    // 2. Đọc dữ liệu (Nếu có transaction thì dùng transaction để lock)
    let voucherDoc: FirebaseFirestore.DocumentSnapshot;
    
    if (transaction) {
        voucherDoc = await transaction.get(voucherRef);
    } else {
        voucherDoc = await voucherRef.get();
    }

    if (!voucherDoc.exists) throw new ApiError(404, 'Mã giảm giá không tồn tại');
    
    const voucher = voucherDoc.data() as VoucherDocument;
    const now = Timestamp.now();

    // 3. Validate logic (Giữ nguyên logic cũ)
    if (!voucher.isActive) throw new ApiError(400, 'Mã giảm giá đang bị khóa');
    if (now.toMillis() < voucher.validFrom.toMillis()) throw new ApiError(400, 'Mã giảm giá chưa bắt đầu');
    if (now.toMillis() > voucher.validTo.toMillis()) throw new ApiError(400, 'Mã giảm giá đã hết hạn');
    
    // [FIX] Validate số lượng
    if (voucher.usedCount >= voucher.usageLimit) throw new ApiError(400, 'Mã giảm giá đã hết lượt sử dụng');
    
    if (orderTotal < voucher.minOrderValue) throw new ApiError(400, `Đơn hàng phải tối thiểu ${voucher.minOrderValue.toLocaleString()}đ`);

    // 4. Tính tiền giảm
    let discountAmount = 0;

    if (voucher.discountType === DiscountType.AMOUNT) {
      discountAmount = voucher.discountValue;
    } else {
      discountAmount = (orderTotal * voucher.discountValue) / 100;
      if (voucher.maxDiscount && voucher.maxDiscount > 0) {
        discountAmount = Math.min(discountAmount, voucher.maxDiscount);
      }
    }

    discountAmount = Math.min(discountAmount, orderTotal);

    return {
      isValid: true,
      code: voucher.code,
      discountAmount: Math.floor(discountAmount),
      finalPrice: orderTotal - Math.floor(discountAmount),
      voucherId: voucherRef.id,
      voucherRef: voucherRef, // [ADD] Trả về Ref để update
      currentUsedCount: voucher.usedCount // [ADD] Trả về số lượt dùng hiện tại
    };
  }

  /**
   * Lấy danh sách voucher khả dụng cho User
   */
  async getActiveVouchers(): Promise<Voucher[]> {
    const now = Timestamp.now();
    const snapshot = await this.collection
      .where('isActive', '==', true)
      .where('validTo', '>', now)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher));
  }
}