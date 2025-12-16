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

module.exports = { createCategory };