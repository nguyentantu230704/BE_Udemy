const express = require('express');
const router = express.Router();
const { createSection } = require('../controllers/sectionController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/sections
router.post('/', protect, createSection);

module.exports = router;