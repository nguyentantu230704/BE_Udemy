const express = require('express');
const router = express.Router();
const { getUserProfile, enrollCourse, getMyCourses, updateUserProfile, getCart, addToCart, removeFromCart, requestChangePassword, verifyChangePassword } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary'); // Import bộ upload


router.get('/profile', protect, getUserProfile);

// POST /api/users/enroll - Đăng ký học
router.post('/enroll', protect, enrollCourse);

// GET /api/users/my-courses - Lấy khóa học đã mua
router.get('/my-courses', protect, getMyCourses);

// PUT /api/users/profile - Cập nhật thông tin (có upload ảnh)
router.put('/profile', protect, upload.single('avatar'), updateUserProfile);
// Route đổi mật khẩu riêng
router.post('/request-change-password', protect, requestChangePassword);
router.put('/verify-change-password', protect, verifyChangePassword);

// --- ROUTES GIỎ HÀNG (MỚI) ---
router.get('/cart', protect, getCart);
router.post('/cart', protect, addToCart);
router.delete('/cart/:courseId', protect, removeFromCart);




module.exports = router;