const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getProgress, markLessonCompleted, getCertificate } = require('../controllers/progressController');

// ==========================================
// 1. PUBLIC ROUTES (AI CŨNG XEM ĐƯỢC)
// ==========================================
// Route tra cứu chứng chỉ PHẢI nằm TRƯỚC middleware protect
// và bắt đầu bằng /certificate/ để không bị nhầm với /:courseId bên dưới
router.get('/certificate/:certificateId', getCertificate);


// ==========================================
// 2. PRIVATE ROUTES (BẮT BUỘC ĐĂNG NHẬP)
// ==========================================
router.use(protect); // Kể từ dòng này trở xuống, mọi API đều bị khóa

// Lấy tiến độ học
router.get('/:courseId', getProgress);

// Đánh dấu hoàn thành bài học
router.post('/mark-completed', markLessonCompleted);

module.exports = router;