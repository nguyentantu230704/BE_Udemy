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

module.exports = { protect };