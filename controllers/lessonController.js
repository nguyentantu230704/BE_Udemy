const Lesson = require('../models/Lesson');
const Section = require('../models/Section');

// @desc    Tạo bài học mới (Upload Video)
// @route   POST /api/lessons
// @access  Private (Instructor)
const createLesson = async (req, res) => {
    try {
        const { title, sectionId, isPreview } = req.body;

        // Validation
        if (!title || !sectionId) {
            return res.status(400).json({ success: false, message: "Thiếu tiêu đề hoặc ID chương học" });
        }

        // 1. Xử lý Video (từ Cloudinary gửi về)
        let videoObj = { url: '', public_id: '' };

        if (req.file) {
            videoObj = {
                url: req.file.path,
                public_id: req.file.filename
            };
        } else {
            return res.status(400).json({ success: false, message: "Vui lòng upload video bài học" });
        }

        // 2. Tạo Lesson mới
        const newLesson = await Lesson.create({
            title,
            section: sectionId, // Link ngược về Section
            video: videoObj,    // Lưu object video
            isPreview: isPreview === 'true' // Chuyển string 'true' thành boolean
        });

        // 3. Cập nhật mảng lessons trong Section (Cha nhận con)
        await Section.findByIdAndUpdate(
            sectionId,
            { $push: { lessons: newLesson._id } },
            { new: true }
        );

        res.status(201).json({
            success: true,
            data: newLesson
        });

    } catch (error) {
        console.error("Lỗi tạo bài học:", error);
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

module.exports = { createLesson };