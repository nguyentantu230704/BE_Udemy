const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
}, { timestamps: true });

// Đảm bảo 1 user chỉ đánh giá 1 lần cho 1 khóa học
reviewSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);