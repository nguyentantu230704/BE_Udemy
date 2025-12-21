const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getAdminStats, getAllUsers, deleteUser, createUser, updateUser, cleanupEnrollments } = require('../controllers/adminController');

// Tất cả các route dưới đây đều cần login và quyền admin
router.use(protect);
router.use(admin);

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.post('/users', createUser);       // <--- Tạo mới
router.put('/users/:id', updateUser);    // <--- Cập nhật (Cấp quyền)
router.delete('/users/:id', deleteUser);
router.post('/cleanup', cleanupEnrollments);

module.exports = router;