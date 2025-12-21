const mongoose = require('mongoose');
const Review = require('../models/Review');
const Course = require('../models/Course');
const User = require('../models/User');

// @desc    Lấy tất cả đánh giá của 1 khóa học
// @route   GET /api/reviews/:courseId
const getCourseReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ course: req.params.courseId })
            .populate('user', 'name avatar') // Lấy tên và avatar người đánh giá
            .sort({ createdAt: -1 }); // Mới nhất lên đầu

        res.json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Thêm đánh giá và Tự động tính điểm trung bình (Chỉ dành cho học viên đã mua)
// @route   POST /api/reviews
const addReview = async (req, res) => {
    try {
        const { courseId, rating, comment } = req.body;
        const userId = req.user._id;

        // 1. Kiểm tra User đã mua khóa học chưa
        const user = await User.findById(userId);
        // Lưu ý: enrolledCourses có thể chứa object ID hoặc string, nên convert sang string để so sánh cho chắc
        const hasEnrolled = user.enrolledCourses.some(id => id.toString() === courseId);

        if (!hasEnrolled) {
            return res.status(403).json({ success: false, message: "Bạn phải mua khóa học này mới được đánh giá." });
        }

        // 2. Kiểm tra xem đã đánh giá chưa
        const existingReview = await Review.findOne({ user: userId, course: courseId });
        if (existingReview) {
            return res.status(400).json({ success: false, message: "Bạn đã đánh giá khóa học này rồi." });
        }

        // 3. Tạo Review
        const review = await Review.create({
            user: userId,
            course: courseId,
            rating: Number(rating),
            comment
        });

        // --- 4. TÍNH TOÁN LẠI ĐIỂM TRUNG BÌNH (LOGIC MỚI) ---
        const stats = await Review.aggregate([
            {
                $match: { course: new mongoose.Types.ObjectId(courseId) }
            },
            {
                $group: {
                    _id: '$course',
                    nRating: { $sum: 1 }, // Đếm tổng số đánh giá
                    avgRating: { $avg: '$rating' } // Tính trung bình cộng trường rating
                }
            }
        ]);

        // Cập nhật vào bảng Course
        if (stats.length > 0) {
            await Course.findByIdAndUpdate(courseId, {
                ratingCount: stats[0].nRating,
                averageRating: stats[0].avgRating
            });
        } else {
            // Trường hợp reset (nếu cần)
            await Course.findByIdAndUpdate(courseId, {
                ratingCount: 0,
                averageRating: 0
            });
        }
        // -----------------------------------------------------

        const populatedReview = await Review.findById(review._id).populate('user', 'name avatar');

        res.status(201).json({
            success: true,
            data: populatedReview,
            // Trả về cả stats mới để Frontend cập nhật realtime (nếu muốn xịn hơn)
            newStats: stats.length > 0 ? { count: stats[0].nRating, avg: stats[0].avgRating } : null,
            message: "Cảm ơn bạn đã đánh giá!"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

module.exports = { getCourseReviews, addReview };