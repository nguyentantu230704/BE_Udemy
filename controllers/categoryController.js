const Category = require('../models/Category');
const slugify = require('slugify');


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

// @desc    Tạo danh mục mới (Admin)
// @route   POST /api/admin/categories
const createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: "Tên danh mục là bắt buộc" });

        const categoryExists = await Category.findOne({ name });
        if (categoryExists) return res.status(400).json({ success: false, message: "Danh mục đã tồn tại" });

        const category = await Category.create({ name });
        res.status(201).json({ success: true, data: category, message: "Tạo danh mục thành công" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Cập nhật danh mục (Admin)
// @route   PUT /api/admin/categories/:id
const updateCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });

        category.name = req.body.name || category.name;
        // Slug sẽ tự động update nhờ plugin mongoose-slug-updater nếu name đổi

        await category.save();
        res.json({ success: true, data: category, message: "Cập nhật thành công" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};



// @desc    Xóa danh mục (Admin)
// @route   DELETE /api/admin/categories/:id
const deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        // Kiểm tra xem có khóa học nào đang dùng danh mục này không
        const courseCount = await Course.countDocuments({ category: categoryId });
        if (courseCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Không thể xóa. Có ${courseCount} khóa học đang thuộc danh mục này.`
            });
        }

        await Category.findByIdAndDelete(categoryId);
        res.json({ success: true, message: "Đã xóa danh mục" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi xóa danh mục" });
    }
};

module.exports = { createCategory, getAllCategories, updateCategory, deleteCategory };