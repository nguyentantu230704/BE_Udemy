const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getCourseReviews, addReview, updateReview,
    deleteReview, replyToReview } = require('../controllers/reviewController');

router.get('/:courseId', getCourseReviews); // Ai cũng xem được
router.post('/', protect, addReview);       // Phải đăng nhập mới được viết

// --- 2 ROUTE MỚI ---
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

router.put('/:id/reply', protect, replyToReview);

module.exports = router;