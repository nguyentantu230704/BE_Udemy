const mongoose = require('mongoose');

const payoutRequestSchema = new mongoose.Schema({
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true }, // Số tiền muốn rút

    // Thông tin tài khoản ngân hàng (lưu dạng text hoặc JSON)
    paymentInfo: {
        bankName: String,
        accountNumber: String,
        accountName: String,
        note: String
    },

    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminComment: { type: String }, // Lý do từ chối hoặc mã giao dịch ngân hàng
    processedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('PayoutRequest', payoutRequestSchema);