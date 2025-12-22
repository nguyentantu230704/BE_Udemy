const mongoose = require('mongoose');
const Review = require('../models/Review');
const Course = require('../models/Course');
const User = require('../models/User');

// --- HÀM PHỤ: TÍNH LẠI ĐIỂM TRUNG BÌNH ---
const calcAverageRatings = async (courseId) => {
    const stats = await Review.aggregate([
        { $match: { course: new mongoose.Types.ObjectId(courseId) } },
        {
            $group: {
                _id: '$course',
                nRating: { $sum: 1 },
                avgRating: { $avg: '$rating' }
            }
        }
    ]);

    if (stats.length > 0) {
        await Course.findByIdAndUpdate(courseId, {
            ratingCount: stats[0].nRating,
            averageRating: stats[0].avgRating
        });
    } else {
        // Nếu không còn đánh giá nào (vừa xóa hết) -> Reset về 0
        await Course.findByIdAndUpdate(courseId, {
            ratingCount: 0,
            averageRating: 0
        });
    }
};

// @desc    Lấy tất cả đánh giá của 1 khóa học
// @route   GET /api/reviews/:courseId
const getCourseReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ course: req.params.courseId })
            .populate('user', 'name avatar')
            // --- THÊM DÒNG NÀY ĐỂ LẤY TÊN GIẢNG VIÊN TRẢ LỜI ---
            .populate('instructorReply.user', 'name avatar')
            // ---------------------------------------------------
            .sort({ createdAt: -1 });

        res.json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Thêm đánh giá
// @route   POST /api/reviews
const addReview = async (req, res) => {
    try {
        const { courseId, rating, comment } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        const hasEnrolled = user.enrolledCourses.some(id => id.toString() === courseId);

        if (!hasEnrolled) {
            return res.status(403).json({ success: false, message: "Bạn phải mua khóa học này mới được đánh giá." });
        }

        const existingReview = await Review.findOne({ user: userId, course: courseId });
        if (existingReview) {
            return res.status(400).json({ success: false, message: "Bạn đã đánh giá khóa học này rồi." });
        }

        const review = await Review.create({
            user: userId,
            course: courseId,
            rating: Number(rating),
            comment
        });

        // Tính lại điểm
        await calcAverageRatings(courseId);

        const populatedReview = await Review.findById(review._id).populate('user', 'name avatar');
        res.status(201).json({ success: true, data: populatedReview, message: "Cảm ơn bạn đã đánh giá!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Cập nhật đánh giá (MỚI)
// @route   PUT /api/reviews/:id
const updateReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;

        // Tìm review
        let review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
        }

        // Kiểm tra quyền sở hữu (Chỉ người tạo mới được sửa)
        if (review.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: "Bạn không có quyền sửa đánh giá này" });
        }

        // Cập nhật
        review.rating = rating;
        review.comment = comment;
        await review.save();

        // Tính lại điểm trung bình
        await calcAverageRatings(review.course);

        const populatedReview = await Review.findById(review._id).populate('user', 'name avatar');

        res.json({ success: true, data: populatedReview, message: "Đã cập nhật đánh giá" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Xóa đánh giá (MỚI)
// @route   DELETE /api/reviews/:id
const deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
        }

        // Kiểm tra quyền sở hữu (Admin cũng có thể xóa nếu muốn logic đó, ở đây chỉ check user)
        if (review.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: "Bạn không có quyền xóa đánh giá này" });
        }

        const courseId = review.course;
        await Review.findByIdAndDelete(req.params.id);

        // Tính lại điểm trung bình
        await calcAverageRatings(courseId);

        res.json({ success: true, message: "Đã xóa đánh giá" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};



// @desc    Giảng viên trả lời đánh giá
// @route   PUT /api/reviews/:id/reply
const replyToReview = async (req, res) => {
    try {
        const { comment } = req.body;
        const reviewId = req.params.id;
        const userId = req.user._id;

        const review = await Review.findById(reviewId).populate('course');
        if (!review) return res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });

        // Check quyền (Giữ nguyên)
        if (review.course.instructor.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Chỉ giảng viên khóa học mới được trả lời." });
        }

        // --- CẬP NHẬT LƯU USER ID ---
        review.instructorReply = {
            user: userId, // <--- Lưu ID người trả lời
            comment: comment,
            updatedAt: new Date()
        };
        // ----------------------------

        await review.save();

        // Populate lại để trả về frontend hiển thị ngay
        const populatedReview = await Review.findById(reviewId)
            .populate('user', 'name avatar')
            .populate('instructorReply.user', 'name avatar'); // <--- Populate thêm dòng này

        res.json({ success: true, data: populatedReview, message: "Đã gửi câu trả lời" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


module.exports = { getCourseReviews, addReview, updateReview, deleteReview, replyToReview };