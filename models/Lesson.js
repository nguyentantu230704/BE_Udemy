const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, lowercase: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },

    // --- SỬA: Lưu object video ---
    video: {
        url: { type: String },
        public_id: { type: String },
        duration: { type: Number, default: 0 } // Gộp duration vào đây hoặc để ngoài cũng được
    },

    content: { type: String }, // Dành cho bài học dạng Text (nếu có)
    isPreview: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Lesson', lessonSchema);