const express = require('express');
const router = express.Router();
const { createSection, deleteSection } = require('../controllers/sectionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// POST /api/sections
router.post('/', protect, authorize('instructor', 'admin'), createSection);
router.delete('/:id', deleteSection);

module.exports = router;