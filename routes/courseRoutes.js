const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { createCourse, getCourseBySlug, getAllCourses, togglePublishStatus, updateCourse, deleteCourse } = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/authMiddleware');


// (Đặt lên trên cùng hoặc trước route /:slug để tránh conflict)
router.get('/', getAllCourses);

// Route: POST /api/courses/create
router.post('/create', protect, authorize('instructor', 'admin'), function (req, res, next) {
    // Bọc hàm upload để bắt lỗi
    upload.single('thumbnail')(req, res, function (err) {
        if (err) {
            // Nếu lỗi xảy ra ở bước Upload (Cloudinary/Multer)
            console.error("🔥 LỖI UPLOAD ẢNH:", err); // In lỗi ra Terminal
            return res.status(500).json({
                success: false,
                message: "Lỗi khi upload ảnh lên Cloudinary",
                error: err.message
            });
        }
        // Nếu không lỗi thì đi tiếp vào Controller
        next();
    });
}, createCourse);


// Route lấy chi tiết (Để ở dưới cùng để tránh trùng lặp)
// GET /api/courses/khoa-hoc-reactjs-pro
router.get('/:slug', getCourseBySlug);

// PUT /api/courses/:id/publish - Bật/tắt xuất bản
router.put('/:id/publish', protect, authorize('instructor', 'admin'), togglePublishStatus);

// PUT /api/courses/:id - Cập nhật thông tin (có upload ảnh thumbnail)
// Sử dụng upload.single('thumbnail') vì chỉ up 1 ảnh bìa
router.put('/:id', protect, authorize('instructor', 'admin'), upload.single('thumbnail'), updateCourse);

// DELETE /api/courses/:id
router.delete('/:id', protect, authorize('instructor', 'admin'), deleteCourse);

module.exports = router;