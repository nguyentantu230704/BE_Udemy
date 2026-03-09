const mongoose = require('mongoose');

const courseProgressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    lastAccessedLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },

    // --- THÊM 3 TRƯỜNG MỚI CHO CHỨNG CHỈ ---
    isCompleted: { type: Boolean, default: false }, // Đánh dấu đã học xong 100%
    certificateId: { type: String, unique: true, sparse: true }, // Mã tra cứu chứng chỉ (VD: CERT-123456)
    completedAt: { type: Date } // Ngày cấp chứng chỉ
}, { timestamps: true });

// Đảm bảo 1 user chỉ có 1 record tiến độ cho 1 khóa học
courseProgressSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('CourseProgress', courseProgressSchema);