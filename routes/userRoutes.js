const express = require('express');
const router = express.Router();
const { enrollCourse, getMyCourses, updateUserProfile } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../config/cloudinary'); // Import bộ upload

// POST /api/users/enroll - Đăng ký học
router.post('/enroll', protect, enrollCourse);

// GET /api/users/my-courses - Lấy khóa học đã mua
router.get('/my-courses', protect, getMyCourses);

// PUT /api/users/profile - Cập nhật thông tin (có upload ảnh)
router.put('/profile', protect, upload.single('avatar'), updateUserProfile);


module.exports = router;