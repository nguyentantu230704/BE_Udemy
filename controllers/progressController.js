const CourseProgress = require('../models/CourseProgress');
const Course = require('../models/Course');
const User = require('../models/User');               // 💡 MỚI: Import User để lấy tên học viên
const Certificate = require('../models/Certificate'); // 💡 MỚI: Import bảng Certificate
const Lesson = require('../models/Lesson');
const crypto = require('crypto');

// ==========================================
// 1. LẤY TIẾN ĐỘ HỌC TẬP
// ==========================================
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
const markLessonCompleted = async (req, res) => {
    try {
        // 💡 BẮT ĐIỂM SỐ: Nhận thêm 'score' từ body
        const { courseId, lessonId, score } = req.body;
        const userId = req.user._id;

        // --- BƯỚC 1: XÁC THỰC BÀI QUIZ (CHỐT CHẶN BẢO MẬT) ---
        const lesson = await Lesson.findById(lessonId);
        if (!lesson) {
            return res.status(404).json({ success: false, message: "Không tìm thấy bài học" });
        }

        if (lesson.type === 'quiz') {
            const requiredScore = lesson.passPercent || 80;
            // Nếu Frontend không gửi điểm, hoặc điểm thấp hơn chuẩn -> Báo lỗi 400 chặn lưu DB
            if (score === undefined || score < requiredScore) {
                return res.status(400).json({
                    success: false,
                    message: `Bạn cần đạt ít nhất ${requiredScore}% để hoàn thành bài trắc nghiệm này.`
                });
            }
        }

        // --- BƯỚC 2: XỬ LÝ LƯU TIẾN ĐỘ ---
        let progress = await CourseProgress.findOne({ user: userId, course: courseId });

        if (!progress) {
            progress = new CourseProgress({ user: userId, course: courseId, completedLessons: [] });
        }

        if (!progress.completedLessons.includes(lessonId)) {
            progress.completedLessons.push(lessonId);
        }
        progress.lastAccessedLesson = lessonId;

        // 💡 LOGIC KIỂM TRA & CẤP CHỨNG CHỈ (Giữ nguyên gốc của bạn)
        if (!progress.isCompleted) {
            const course = await Course.findById(courseId)
                .populate({ path: 'sections', select: 'lessons' })
                .populate('instructor', 'name');

            if (course && course.sections) {
                let totalLessons = 0;
                course.sections.forEach(sec => {
                    if (sec.lessons) totalLessons += sec.lessons.length;
                });

                if (totalLessons > 0 && progress.completedLessons.length >= totalLessons) {
                    progress.isCompleted = true;
                    progress.completedAt = Date.now();

                    const randomCode = crypto.randomBytes(3).toString('hex').toUpperCase();
                    const certId = `UC-${randomCode}${Date.now().toString().slice(-4)}`;
                    progress.certificateId = certId;

                    const student = await User.findById(userId).select('name');

                    await Certificate.create({
                        certificateId: certId,
                        user: userId,
                        course: courseId,
                        studentName: student.name,
                        courseTitle: course.title,
                        instructorName: course.instructor ? course.instructor.name : 'Giảng viên SmartLMS',
                        issueDate: Date.now()
                    });
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
// 3. TRA CỨU CHỨNG CHỈ (PUBLIC PORTAL)
// ==========================================
const getCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;

        // 💡 BÂY GIỜ CHÚNG TA TÌM TRONG BẢNG CERTIFICATE THAY VÌ COURSE_PROGRESS
        const certificate = await Certificate.findOne({
            certificateId: certificateId.toUpperCase()
        });

        // Kiểm tra xem chứng chỉ có tồn tại và chưa bị thu hồi không
        if (!certificate || !certificate.isValid) {
            return res.status(404).json({
                success: false,
                message: "Chứng chỉ không tồn tại trên hệ thống hoặc đã bị thu hồi!"
            });
        }

        res.json({
            success: true,
            data: {
                certificateId: certificate.certificateId,
                studentName: certificate.studentName,       // Dữ liệu Snapshot
                courseTitle: certificate.courseTitle,       // Dữ liệu Snapshot
                instructorName: certificate.instructorName, // Dữ liệu Snapshot
                issueDate: certificate.issueDate
            }
        });

    } catch (error) {
        console.error("Lỗi tra cứu chứng chỉ:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

module.exports = { getProgress, markLessonCompleted, getCertificate };