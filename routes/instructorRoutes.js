const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// Import Controllers
const { getInstructorDashboard, getInstructorCoursesSelect } = require('../controllers/instructorController');
const { createCoupon, getMyCoupons, deleteCoupon } = require('../controllers/couponController');
const { createPayoutRequest, getPayoutHistory } = require('../controllers/payoutController');

// Tất cả các route này yêu cầu Login + Role là Instructor (hoặc Admin)
router.use(protect);
router.use(authorize('instructor', 'admin'));

// --- DASHBOARD ---
router.get('/dashboard', getInstructorDashboard);
router.get('/courses-select', getInstructorCoursesSelect);

// --- COUPONS ---
router.get('/coupons', getMyCoupons);
router.post('/coupons', createCoupon);
router.delete('/coupons/:id', deleteCoupon);

// --- PAYOUTS (RÚT TIỀN) ---
router.get('/payouts', getPayoutHistory);
router.post('/payouts', createPayoutRequest);

module.exports = router;