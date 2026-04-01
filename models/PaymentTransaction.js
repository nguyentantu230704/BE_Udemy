const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema(
  {
    orderId: { type: String, require: true, index: true },
    provider: { type: String, enum: ['vnpay', 'paypal'], require: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Danh sách khóa học trong đơn
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

    // 💡 MỚI: Mảng lưu danh sách mã giảm giá áp dụng cho TỪNG khóa học
    appliedCoupons: [{
      course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
      code: { type: String },
      discountAmount: { type: Number }
    }],

    // Két sắt lưu lịch sử chia tiền
    revenueSplits: [{
      course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
      instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      coursePriceAtPurchase: Number,
      courseActualPricePaid: Number, // 💡 THÊM MỚI: Giá khách THỰC TẾ TRẢ sau khi áp mã
      adminCommissionRate: Number,
      instructorEarning: Number,
      adminEarning: Number,
      appliedCoupon: String // 💡 MỚI: Lưu lại mã giảm giá vào sổ tay giảng viên
    }],

    transactionId: { type: String, unique: true, sparse: true },
    amount: { type: Number, required: true }, // Tổng tiền cuối cùng khách trả
    currency: { type: String, default: 'VND' },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    rawResponse: { type: Object },
    paidAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);