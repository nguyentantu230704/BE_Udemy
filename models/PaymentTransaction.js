const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      require: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['vnpay', 'paypal'],
      require: true,
    },


    // --- CẬP NHẬT ĐỂ HỖ TRỢ GIỎ HÀNG ---
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Thay vì 1 khóa, ta lưu danh sách các khóa học đã mua trong giao dịch này
    items: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    }],


    transactionId: {
      type: String, // vnp_TxnRef / paypal orderId
      // required: false,
      unique: true,
      sparse: true,
      // default: null,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: 'VND',
    },

    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },

    rawResponse: {
      type: Object, // lưu callback/query gốc từ VNPay / PayPal
    },

    paidAt: {
      type: Date,
    },

    couponCode: { type: String }, // Lưu mã giảm giá đã dùng
    discountAmount: { type: Number, default: 0 }, // Số tiền được giảm

  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
