const mongoose = require('mongoose');

const courseProgressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    // Mảng chứa ID của các bài học đã hoàn thành
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    // Lưu bài học đang học dở (để lần sau vào học tiếp ngay bài đó)
    lastAccessedLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }
}, { timestamps: true });

// Đảm bảo 1 user chỉ có 1 record tiến độ cho 1 khóa học
courseProgressSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('CourseProgress', courseProgressSchema);