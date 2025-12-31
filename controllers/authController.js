const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// @desc    Đăng ký (Sửa đổi: Gửi mail kích hoạt)
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'Email này đã được sử dụng' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Tạo user nhưng KHÔNG trả về token đăng nhập ngay
        const user = new User({
            name, email, password: hashedPassword, role: role || 'student'
        });

        // Tạo token xác thực
        const verificationToken = user.getVerificationToken();
        await user.save();

        // Tạo link kích hoạt
        const verifyUrl = `${process.env.FE_URL}/verify-email/${verificationToken}`;

        const message = `Chào mừng bạn đến với Udemy Clone! Vui lòng click vào link dưới đây để kích hoạt tài khoản:\n\n ${verifyUrl}`;

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                /* Reset CSS cho Email Client */
                body { margin: 0; padding: 0; min-width: 100%; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333333; }
                a { color: #9333ea; text-decoration: none; }
                .btn { display: inline-block; font-weight: bold; color: #ffffff !important; background-color: #9333ea; border-radius: 8px; padding: 12px 24px; text-decoration: none; }
                .btn:hover { background-color: #7e22ce; }
            </style>
        </head>
        <body style="background-color: #f3f4f6;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <div style="background-color: #9333ea; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Udemy Clone</h1>
                </div>

                <div style="padding: 40px 30px;">
                    <h2 style="margin-top: 0; color: #1f2937;">Xin chào ${name},</h2>
                    <p style="color: #4b5563; margin-bottom: 24px;">
                        Cảm ơn bạn đã đăng ký tài khoản tại <b>Udemy Clone</b>. Chúng tôi rất vui được đồng hành cùng bạn trên hành trình học tập sắp tới.
                    </p>
                    <p style="color: #4b5563; margin-bottom: 30px;">
                        Để bắt đầu, vui lòng xác thực địa chỉ email của bạn bằng cách nhấn vào nút bên dưới (Link có hiệu lực trong 24 giờ):
                    </p>

                    <div style="text-align: center; margin-bottom: 30px;">
                        <a href="${verifyUrl}" class="btn" style="background-color: #9333ea; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Kích hoạt tài khoản ngay
                        </a>
                    </div>

                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                        Nếu nút trên không hoạt động, bạn có thể copy và dán đường dẫn sau vào trình duyệt:
                    </p>
                    <p style="margin-top: 5px; word-break: break-all; color: #9333ea; font-size: 13px;">
                        <a href="${verifyUrl}">${verifyUrl}</a>
                    </p>
                </div>

                <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        Bạn nhận được email này vì đã đăng ký tài khoản tại Udemy Clone.
                    </p>
                    <p style="margin: 5px 0 0; font-size: 12px; color: #9ca3af;">
                        © ${new Date().getFullYear()} Udemy Clone. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
        try {
            await sendEmail({
                email: user.email,
                subject: 'Xác thực tài khoản - Udemy Clone',
                message,
                html
            });

            res.status(200).json({
                success: true,
                message: 'Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản.'
            });

        } catch (err) {
            // Nếu gửi mail lỗi thì xóa user luôn để họ đăng ký lại
            await User.findByIdAndDelete(user._id);
            return res.status(500).json({ success: false, message: 'Không thể gửi email xác thực. Vui lòng thử lại.' });
        }

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Xác thực Email (MỚI)
// @route   PUT /api/auth/verifyemail/:token
const verifyEmail = async (req, res) => {
    try {
        const verificationToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            verificationToken,
            verificationTokenExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Token kích hoạt không hợp lệ hoặc đã hết hạn' });
        }

        // Kích hoạt user
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpire = undefined;
        await user.save();

        // Trả về token đăng nhập luôn để user vào thẳng app
        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                token: generateToken(user._id),
            },
            message: 'Tài khoản đã được kích hoạt!'
        });

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
            if (!user.isVerified) {
                return res.status(401).json({ message: 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email.' });
            }

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



module.exports = { registerUser, loginUser, forgotPassword, resetPassword, verifyEmail };