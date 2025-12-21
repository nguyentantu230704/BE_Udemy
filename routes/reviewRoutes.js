const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getCourseReviews, addReview } = require('../controllers/reviewController');

router.get('/:courseId', getCourseReviews); // Ai cũng xem được
router.post('/', protect, addReview);       // Phải đăng nhập mới được viết

module.exports = router;