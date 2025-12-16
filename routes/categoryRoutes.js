const express = require('express');
const router = express.Router();
const { createCategory } = require('../controllers/categoryController');

// POST /api/categories
router.post('/', createCategory);

module.exports = router;