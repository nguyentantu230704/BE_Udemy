const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // Link ngược lại cha

    // REFERENCING: Chỉ lưu ID của các bài học
    lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }]
}, { timestamps: true });

module.exports = mongoose.model('Section', sectionSchema);