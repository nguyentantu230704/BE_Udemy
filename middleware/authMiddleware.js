const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Lấy token từ header (Dạng: "Bearer <token>")
            token = req.headers.authorization.split(' ')[1];

            // Giải mã token lấy ID
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Tìm user từ ID đó và gán vào request
            req.user = await User.findById(decoded.id).select('-password');

            next(); // Cho phép đi tiếp
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Middleware 2: Phân quyền
// Nhận vào danh sách các role được phép. VD: authorize('instructor', 'admin')
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        }

        // Kiểm tra role của user có nằm trong danh sách cho phép không
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} không được phép truy cập`
            });
        }
        next();
    };
};

module.exports = { protect, authorize };