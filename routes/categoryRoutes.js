const express = require('express');
const router = express.Router();
const { createCategory, getAllCategories } = require('../controllers/categoryController');

// GET /api/categories (Lấy danh sách)
router.get('/', getAllCategories);

// POST /api/categories
router.post('/', createCategory);

module.exports = router;