const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true }, // Thêm trim để cắt khoảng trắng thừa
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true },
    price: { type: Number, default: 0 },

    // --- SỬA QUAN TRỌNG 1: Lưu object ảnh để sau này còn xóa được ---
    thumbnail: {
        url: { type: String },      // Link ảnh
        public_id: { type: String } // ID ảnh trên Cloudinary
    },

    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // --- SỬA QUAN TRỌNG 2: Link tới bảng Category (Tạo file Category.js ở dưới) ---
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],

    // --- THÊM 2 TRƯỜNG NÀY ---
    averageRating: {
        type: Number,
        default: 0,
        min: [0, 'Rating must be at least 1'],
        max: [5, 'Rating must can not be more than 5'],
        // Hàm set này giúp tự động làm tròn 1 chữ số thập phân (VD: 4.567 -> 4.6)
        set: val => Math.round(val * 10) / 10
    },
    ratingCount: {
        type: Number,
        default: 0
    },

    totalStudents: {
        type: Number,
        default: 0 // Mặc định là 0 học viên
    },

    objectives: [{ type: String }], // Lưu danh sách các mục tiêu (từng dòng tích xanh)

    isPublished: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);