const express = require('express');
const router = express.Router();
const { createLesson } = require('../controllers/lessonController');
const upload = require('../config/cloudinary'); // Dùng lại bộ upload cũ
const { protect, authorize } = require('../middleware/authMiddleware');

// Route upload video: Field name là 'video'
// Lưu ý: Upload video lâu hơn ảnh, đừng tắt Postman vội khi đang quay
router.post('/', protect, authorize('instructor', 'admin'), upload.single('video'), createLesson);

module.exports = router;