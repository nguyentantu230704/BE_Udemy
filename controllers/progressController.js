const CourseProgress = require('../models/CourseProgress');
const Course = require('../models/Course');

// @desc    Lấy tiến độ của user trong 1 khóa học
// @route   GET /api/progress/:courseId
const getProgress = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user._id;

        let progress = await CourseProgress.findOne({ user: userId, course: courseId });

        // Nếu chưa có tiến độ (lần đầu học), tạo mới record rỗng
        if (!progress) {
            progress = await CourseProgress.create({
                user: userId,
                course: courseId,
                completedLessons: []
            });
        }

        res.json({ success: true, data: progress });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi lấy tiến độ" });
    }
};

// @desc    Đánh dấu bài học là hoàn thành (Toggle)
// @route   POST /api/progress/mark-completed
const markLessonCompleted = async (req, res) => {
    try {
        const { courseId, lessonId } = req.body;
        const userId = req.user._id;

        let progress = await CourseProgress.findOne({ user: userId, course: courseId });

        if (!progress) {
            progress = new CourseProgress({ user: userId, course: courseId, completedLessons: [] });
        }

        // Logic Toggle: Nếu có rồi thì bỏ (uncheck), chưa có thì thêm vào
        // Tuy nhiên với video onEnded thì thường chỉ thêm vào. Ở đây mình làm logic thêm vào thôi.
        if (!progress.completedLessons.includes(lessonId)) {
            progress.completedLessons.push(lessonId);
        }

        // Cập nhật bài học đang xem gần nhất
        progress.lastAccessedLesson = lessonId;

        await progress.save();

        res.json({
            success: true,
            data: progress.completedLessons, // Trả về mảng mới nhất để frontend update
            message: "Đã cập nhật tiến độ"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi cập nhật tiến độ" });
    }
};

module.exports = { getProgress, markLessonCompleted };