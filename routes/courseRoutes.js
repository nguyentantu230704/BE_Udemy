const express = require('express');
const router = express.Router();
const { createCourse, getCourseBySlug } = require('../controllers/courseController');
const upload = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');

// Route: POST /api/courses/create
router.post('/create', protect, function (req, res, next) {
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

module.exports = router;