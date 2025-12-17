const Category = require('../models/Category');
const slugify = require('slugify');

const createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const category = await Category.create({
            name,
            slug: slugify(name, { lower: true })
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Lấy tất cả danh mục
// @route   GET /api/categories
const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find().select('name _id'); // Chỉ lấy tên và ID
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

module.exports = { createCategory, getAllCategories };