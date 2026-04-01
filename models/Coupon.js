const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },

    // 💡 THÊM MỚI: Logic quản lý số lượng và Lịch sử
    usageLimit: { type: Number, required: true, min: 1 }, // Số lượng tối đa (VD: 100 mã)
    usedCount: { type: Number, default: 0 },              // Số lượt đã dùng
    usedBy: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        orderId: { type: String },
        usedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);