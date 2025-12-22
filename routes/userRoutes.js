const express = require('express');
const router = express.Router();
const { enrollCourse, getMyCourses, updateUserProfile, getCart, addToCart, removeFromCart } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary'); // Import bộ upload

// POST /api/users/enroll - Đăng ký học
router.post('/enroll', protect, enrollCourse);

// GET /api/users/my-courses - Lấy khóa học đã mua
router.get('/my-courses', protect, getMyCourses);

// PUT /api/users/profile - Cập nhật thông tin (có upload ảnh)
router.put('/profile', protect, upload.single('avatar'), updateUserProfile);

// --- ROUTES GIỎ HÀNG (MỚI) ---
router.get('/cart', protect, getCart);
router.post('/cart', protect, addToCart);
router.delete('/cart/:courseId', protect, removeFromCart);


module.exports = router;