const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getAdminStats, getAllUsers, deleteUser, createUser, updateUser, cleanupEnrollments, removeUserCourse, getSystemStats, getPayoutRequests, processPayoutRequest, getAllCourses,
    deleteCourseByAdmin } = require('../controllers/adminController');
const {
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory
} = require('../controllers/categoryController');

// Tất cả các route dưới đây đều cần login và quyền admin
router.use(protect);
router.use(admin);

// --- DASHBOARD ---
router.get('/stats', getSystemStats);

// --- PAYOUTS ---
router.get('/payouts', getPayoutRequests);
router.put('/payouts/:id', processPayoutRequest);

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.post('/users', createUser);       // <--- Tạo mới
router.put('/users/:id', updateUser);    // <--- Cập nhật (Cấp quyền)
router.delete('/users/:id', deleteUser);
router.post('/cleanup', cleanupEnrollments);

// --- ROUTES CATEGORY (Mới) ---
router.get('/categories', getAllCategories); // Admin xem list để quản lý
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Route Gỡ khóa học
router.delete('/users/:userId/courses/:courseId', removeUserCourse);

router.get('/courses', getAllCourses);
router.delete('/courses/:id', deleteCourseByAdmin);

module.exports = router;