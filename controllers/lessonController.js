const Lesson = require('../models/Lesson');
const Section = require('../models/Section');

// @desc    Tạo bài học mới (Hỗ trợ Video, Text, Quiz)
// @route   POST /api/lessons
// @access  Private (Instructor)
const createLesson = async (req, res) => {
    try {
        // Lấy dữ liệu từ req.body (Do dùng multer nên data text cũng nằm trong body)
        const { title, sectionId, type, content, quizQuestions, isPreview } = req.body;

        if (!title || !sectionId) {
            return res.status(400).json({ success: false, message: "Tiêu đề và Chương học là bắt buộc" });
        }

        const lessonData = {
            title,
            section: sectionId,
            type: type || 'video', // Nhận type từ form
            isPreview: isPreview === 'true',
        };

        // Xử lý theo loại
        if (type === 'video') {
            if (req.file) {
                lessonData.video = {
                    url: req.file.path,
                    public_id: req.file.filename,
                    duration: req.body.duration || 0
                };
            }
        } else if (type === 'text') {
            lessonData.content = content; // Lưu nội dung text
        } else if (type === 'quiz') {
            if (quizQuestions) {
                lessonData.quizQuestions = JSON.parse(quizQuestions);
            }
        }

        const lesson = await Lesson.create(lessonData);

        // Cập nhật Section
        await Section.findByIdAndUpdate(sectionId, {
            $push: { lessons: lesson._id }
        });

        res.status(201).json({ success: true, data: lesson });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Xóa bài học (MỚI)
// @route   DELETE /api/lessons/:id
const deleteLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) {
            return res.status(404).json({ success: false, message: "Không tìm thấy bài học" });
        }

        // 1. Nếu là video, xóa trên Cloudinary
        if (lesson.type === 'video' && lesson.video && lesson.video.public_id) {
            try {
                // Cloudinary resource_type: 'video' là bắt buộc khi xóa video
                await cloudinary.uploader.destroy(lesson.video.public_id, { resource_type: 'video' });
            } catch (err) {
                console.log("Lỗi xóa video trên Cloudinary:", err);
            }
        }

        // 2. Xóa ID bài học khỏi mảng lessons trong Section
        await Section.findByIdAndUpdate(lesson.section, {
            $pull: { lessons: lesson._id }
        });

        // 3. Xóa bài học trong DB
        await Lesson.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: "Đã xóa bài học" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi xóa bài học" });
    }
};


module.exports = { createLesson, deleteLesson };