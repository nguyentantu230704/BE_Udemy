const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getProgress, markLessonCompleted } = require('../controllers/progressController');

router.use(protect); // Bắt buộc đăng nhập

router.get('/:courseId', getProgress);
router.post('/mark-completed', markLessonCompleted);

module.exports = router;