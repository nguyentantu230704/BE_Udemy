const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, lowercase: true },

    //  THÊM TRƯỜNG PHÂN LOẠI
    type: {
        type: String,
        enum: ['video', 'text', 'quiz', 'document'], // 4 loại bài học
        default: 'video'
    },

    passPercent: { type: Number, default: 80 },

    //  DỮ LIỆU CHO TRẮC NGHIỆM (QUIZ)
    quizQuestions: [{
        question: { type: String, required: true },
        options: [{ type: String, required: true }], // Mảng các đáp án (A, B, C, D)
        correctAnswer: { type: Number, required: true } // Index của đáp án đúng (0, 1, 2, hoặc 3)
    }],

    section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },

    // --- SỬA: Lưu object video ---
    video: {
        url: { type: String },
        public_id: { type: String },
        duration: { type: Number, default: 0 } // Gộp duration vào đây hoặc để ngoài cũng được
    },

    // THÊM: Object document để lưu file PDF
    document: {
        url: { type: String },
        public_id: { type: String }
    },

    content: { type: String }, // Dành cho bài học dạng Text (nếu có)
    isPreview: { type: Boolean, default: false },

    order: { type: Number }

}, { timestamps: true });

module.exports = mongoose.model('Lesson', lessonSchema);