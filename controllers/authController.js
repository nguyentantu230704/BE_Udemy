const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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

// --- MỚI: QUÊN MẬT KHẨU ---
// @route POST /api/auth/forgotpassword
const forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy email này' });

        // Lấy token từ method có sẵn trong Model User
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        // Tạo link reset (Trỏ về Frontend)
        const resetUrl = `${process.env.FE_URL}/reset-password/${resetToken}`;

        const message = `Bạn nhận được email này vì yêu cầu đặt lại mật khẩu. Click vào link dưới đây:\n\n ${resetUrl}`;
        const html = `
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px;">
    <div style="max-w-md; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <div style="background-color: #7e22ce; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Udemy Clone</h1>
        </div>

        <div style="padding: 30px; color: #374151;">
            <h2 style="margin-top: 0; color: #111827;">Đặt lại mật khẩu của bạn</h2>
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này. 
                Nếu bạn không gửi yêu cầu, hãy bỏ qua email này.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="background-color: #7e22ce; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Đặt lại mật khẩu ngay
                </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                Link này sẽ hết hạn sau 10 phút. Nếu nút trên không hoạt động, hãy copy link dưới đây dán vào trình duyệt:
            </p>
            <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">${resetUrl}</p>
        </div>

        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                © 2025 Udemy Clone. All rights reserved.
            </p>
        </div>
    </div>
</div>
`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Đặt lại mật khẩu - Udemy Clone',
                message,
                html
            });
            res.status(200).json({ success: true, data: 'Email đã được gửi!' });
        } catch (err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ success: false, message: 'Không thể gửi email' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- MỚI: ĐẶT LẠI MẬT KHẨU ---
// @route PUT /api/auth/resetpassword/:resettoken
const resetPassword = async (req, res) => {
    try {
        const resetPasswordToken = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() },
        });

        if (!user) return res.status(400).json({ success: false, message: 'Token không hợp lệ hoặc hết hạn' });

        // Hash mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);

        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();
        res.status(200).json({ success: true, data: 'Mật khẩu đã được cập nhật!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};



module.exports = { registerUser, loginUser, forgotPassword, resetPassword };