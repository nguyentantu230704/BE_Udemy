const mongoose = require('mongoose');
const crypto = require('crypto');


const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['student', 'instructor', 'admin'],
        default: 'student'
    },
    avatar: { type: String, default: '' },
    // Mảng chứa ID các khóa học đã mua
    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    // --- THÊM TRƯỜNG CART ---
    cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

    // --- THÔNG TIN BỔ SUNG CHO PROFILE ---
    headline: { type: String, default: '' }, // Ví dụ: Fullstack Developer
    bio: { type: String, default: '' },      // Giới thiệu bản thân
    // -------------------------------------
    resetPasswordToken: String,
    resetPasswordExpire: Date,

}, { timestamps: true });


// Thêm method tạo Token Reset Password
userSchema.methods.getResetPasswordToken = function () {
    // 1. Tạo token ngẫu nhiên
    const resetToken = crypto.randomBytes(20).toString('hex');

    // 2. Hash token và lưu vào field trong DB (Bảo mật)
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // 3. Set thời hạn (ví dụ: 10 phút)
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    return resetToken; // Trả về token gốc để gửi qua email
};

module.exports = mongoose.model('User', userSchema);