const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');

// 1. GỘP IMPORT: Lấy hết các hàm từ instructorController (Nơi chứa logic mới)
const {
    getInstructorDashboard,
    getInstructorCoursesSelect,
    getPayoutBalance,
    createPayoutRequest
} = require('../controllers/instructorController');

const { createCoupon, getMyCoupons, deleteCoupon } = require('../controllers/couponController');

// Nếu bạn vẫn muốn giữ getPayoutHistory ở file cũ thì giữ dòng này, 
// nhưng createPayoutRequest phải bỏ đi để dùng cái ở trên.
const { getPayoutHistory } = require('../controllers/payoutController');

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
router.get('/payouts', getPayoutHistory);       // Lịch sử rút tiền
router.get('/payouts/balance', getPayoutBalance); // Lấy số dư khả dụng
router.post('/payouts', createPayoutRequest);     // Tạo yêu cầu rút tiền 

module.exports = router;