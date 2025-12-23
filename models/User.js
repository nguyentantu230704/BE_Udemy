const mongoose = require('mongoose');

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


}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);