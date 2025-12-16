const Section = require('../models/Section');
const Course = require('../models/Course');

// @desc    Tạo chương học mới
// @route   POST /api/sections
// @access  Private (Instructor)
const createSection = async (req, res) => {
    try {
        const { title, courseId } = req.body;

        if (!title || !courseId) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin" });
        }

        // 1. Tạo Section mới
        const newSection = await Section.create({
            title,
            course: courseId // Link ngược về khóa học
        });

        // 2. QUAN TRỌNG: Cập nhật mảng sections trong Course
        // Dùng $push để thêm ID section vừa tạo vào cuối mảng
        await Course.findByIdAndUpdate(
            courseId,
            { $push: { sections: newSection._id } },
            { new: true } // Trả về data mới nhất
        );

        res.status(201).json({
            success: true,
            data: newSection
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

module.exports = { createSection };