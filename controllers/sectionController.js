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

// @desc    Xóa chương và các bài học bên trong
// @route   DELETE /api/sections/:id
const deleteSection = async (req, res) => {
    try {
        const section = await Section.findById(req.params.id);
        if (!section) {
            return res.status(404).json({ success: false, message: "Không tìm thấy chương" });
        }

        // 1. Xóa tất cả bài học thuộc chương này (Dọn rác)
        // Lưu ý: Nếu muốn xóa sạch video trên Cloudinary thì phải loop qua từng lesson để xóa.
        // Ở đây mình xóa nhanh trong DB.
        await Lesson.deleteMany({ section: req.params.id });

        // 2. Xóa ID chương khỏi mảng sections của Course
        await Course.findByIdAndUpdate(section.courseId, {
            $pull: { sections: section._id }
        });

        // 3. Xóa chương
        await Section.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: "Đã xóa chương và các bài học liên quan" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi xóa chương" });
    }
};

module.exports = { createSection, deleteSection };