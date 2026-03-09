const CourseProgress = require('../models/CourseProgress');
const Course = require('../models/Course');
const crypto = require('crypto');

// ==========================================
// 1. LẤY TIẾN ĐỘ HỌC TẬP
// ==========================================
// @desc    Lấy tiến độ của user trong 1 khóa học
// @route   GET /api/progress/:courseId
const getProgress = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user._id;

        let progress = await CourseProgress.findOne({ user: userId, course: courseId });

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

// ==========================================
// 2. LƯU TIẾN ĐỘ & CẤP CHỨNG CHỈ (NẾU ĐỦ 100%)
// ==========================================
// @desc    Đánh dấu bài học là hoàn thành và CẤP CHỨNG CHỈ nếu đủ 100%
// @route   POST /api/progress/mark-completed
const markLessonCompleted = async (req, res) => {
    try {
        const { courseId, lessonId } = req.body;
        const userId = req.user._id;

        let progress = await CourseProgress.findOne({ user: userId, course: courseId });

        if (!progress) {
            progress = new CourseProgress({ user: userId, course: courseId, completedLessons: [] });
        }

        // 1. Lưu bài học vào danh sách đã hoàn thành
        if (!progress.completedLessons.includes(lessonId)) {
            progress.completedLessons.push(lessonId);
        }
        progress.lastAccessedLesson = lessonId;

        // 2. LOGIC KIỂM TRA & CẤP CHỨNG CHỈ (Chỉ chạy nếu chưa hoàn thành)
        if (!progress.isCompleted) {
            const course = await Course.findById(courseId).populate({
                path: 'sections',
                select: 'lessons'
            });

            if (course && course.sections) {
                let totalLessons = 0;
                course.sections.forEach(sec => {
                    if (sec.lessons) totalLessons += sec.lessons.length;
                });

                // So sánh số bài đã học với tổng số bài thực tế của khóa
                if (totalLessons > 0 && progress.completedLessons.length >= totalLessons) {
                    progress.isCompleted = true;
                    progress.completedAt = Date.now();

                    // Tạo mã chứng chỉ dạng: CERT-XXXXXX + Timestamp
                    const randomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
                    progress.certificateId = `CERT-${randomCode}-${Date.now().toString().slice(-6)}`;
                }
            }
        }

        await progress.save();

        res.json({
            success: true,
            data: progress.completedLessons,
            isCompleted: progress.isCompleted,
            certificateId: progress.certificateId,
            message: progress.isCompleted ? "Chúc mừng! Bạn đã hoàn thành khóa học và nhận được chứng chỉ." : "Đã cập nhật tiến độ"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi cập nhật tiến độ" });
    }
};

// ==========================================
// 3. TRA CỨU CHỨNG CHỈ (PUBLIC)
// ==========================================
// @desc    Tra cứu thông tin chứng chỉ bằng mã (Public)
// @route   GET /api/progress/certificate/:certificateId
const getCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;

        const progress = await CourseProgress.findOne({ certificateId })
            .populate('user', 'name email')
            .populate({
                path: 'course',
                select: 'title instructor',
                populate: { path: 'instructor', select: 'name' }
            });

        if (!progress || !progress.isCompleted) {
            return res.status(404).json({
                success: false,
                message: "Chứng chỉ không tồn tại hoặc chưa hợp lệ"
            });
        }

        res.json({
            success: true,
            data: {
                certificateId: progress.certificateId,
                studentName: progress.user.name,
                courseTitle: progress.course.title,
                instructorName: progress.course.instructor ? progress.course.instructor.name : 'Hệ thống Udemy Clone',
                completedAt: progress.completedAt
            }
        });

    } catch (error) {
        console.error("Lỗi tra cứu chứng chỉ:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// Xuất khẩu đầy đủ cả 3 hàm
module.exports = { getProgress, markLessonCompleted, getCertificate };