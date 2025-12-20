const Lesson = require('../models/Lesson');
const Section = require('../models/Section');

// @desc    Tạo bài học mới (Upload Video)
// @route   POST /api/lessons
// @access  Private (Instructor)
const createLesson = async (req, res) => {
    try {
        const { title, sectionId, isPreview } = req.body;

        // 1. Validation: Kiểm tra dữ liệu đầu vào
        if (!title || !sectionId) {
            return res.status(400).json({ success: false, message: "Thiếu tiêu đề hoặc ID chương học" });
        }

        // 2. Validation: Kiểm tra File (Bắt buộc phải có video mới cho tạo)
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Vui lòng upload video bài học" });
        }

        // 3. Chuẩn bị dữ liệu Video
        // Lưu ý: Cloudinary qua Multer trả về link trong `path`, id trong `filename`
        const videoData = {
            url: req.file.path,       // Link video (Quan trọng nhất)
            public_id: req.file.filename,
            duration: 0               // Tạm thời set 0, sau này xử lý lấy thời lượng sau
        };

        // 4. Tạo Lesson mới vào DB
        const newLesson = await Lesson.create({
            title,
            section: sectionId,       // Link tới Section cha
            video: videoData,         // Lưu object video vừa tạo
            isPreview: isPreview === 'true' // Ép kiểu string sang boolean
        });

        // 5. Cập nhật mảng lessons trong Section cha
        await Section.findByIdAndUpdate(
            sectionId,
            { $push: { lessons: newLesson._id } },
            { new: true }
        );

        // 6. Trả về kết quả
        res.status(201).json({
            success: true,
            message: "Thêm bài học thành công",
            data: newLesson
        });

    } catch (error) {
        console.error("Lỗi tạo bài học:", error);
        // Trả về lỗi chi tiết để dễ debug
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};


module.exports = { createLesson };