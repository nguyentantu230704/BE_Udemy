const express = require('express');
const router = express.Router();
const { createSection } = require('../controllers/sectionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// POST /api/sections
router.post('/', protect, authorize('instructor', 'admin'), createSection);

module.exports = router;