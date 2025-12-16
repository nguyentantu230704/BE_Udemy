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
    isPublished: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);