const Coupon = require('../models/Coupon');
const Course = require('../models/Course');

// @desc    Tạo mã giảm giá mới
// @route   POST /api/coupons
const createCoupon = async (req, res) => {
    try {
        const { code, discountPercent, courseId, expiryDate } = req.body;

        // Check quyền sở hữu khóa học
        const course = await Course.findById(courseId);
        if (!course || course.instructor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Bạn không sở hữu khóa học này" });
        }

        const newCoupon = await Coupon.create({
            code,
            discountPercent,
            course: courseId,
            instructor: req.user._id,
            expiryDate
        });

        res.status(201).json({ success: true, data: newCoupon });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Lấy danh sách mã giảm giá của giảng viên
// @route   GET /api/coupons
const getMyCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ instructor: req.user._id }).populate('course', 'title');
        res.json({ success: true, data: coupons });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Xóa mã giảm giá
// @route   DELETE /api/coupons/:id
const deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) return res.status(404).json({ message: "Không tìm thấy" });

        if (coupon.instructor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Không có quyền" });
        }

        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Đã xóa mã giảm giá" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi server" });
    }
};

module.exports = { createCoupon, getMyCoupons, deleteCoupon };