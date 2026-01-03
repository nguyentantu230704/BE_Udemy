const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountPercent: { type: Number, required: true, min: 0, max: 100 }, // Giảm theo % (VD: 20%)
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }, // Áp dụng cho khóa nào
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Ai tạo
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);