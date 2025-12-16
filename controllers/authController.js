const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

// @desc    Đăng ký người dùng mới
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // 1. Kiểm tra xem user đã tồn tại chưa
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'Email này đã được sử dụng' });
        }

        // 2. Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Tạo user mới vào DB
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'student' // Mặc định là student nếu không chọn
        });

        // 4. Trả về thông tin (kèm Token)
        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                token: generateToken(user._id), // Quan trọng nhất
            });
        } else {
            res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Đăng nhập & Lấy Token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Tìm user theo email
        const user = await User.findOne({ email });

        // 2. Kiểm tra mật khẩu (So sánh pass nhập vào và pass mã hóa trong DB)
        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { registerUser, loginUser };