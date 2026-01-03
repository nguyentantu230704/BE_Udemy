const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Middleware validate dữ liệu đầu vào (nếu bạn có dùng)
const validateCreatePayment = require('../middleware/validateCreatePayment');

// Middleware xác thực user (Token)
const { protect } = require('../middleware/authMiddleware');
router.post('/check-coupon', protect, paymentController.checkCoupon);
// 1. Tạo thanh toán (Bắt buộc phải đăng nhập -> protect)
router.post('/create_payment_url', protect, paymentController.createPaymentUrl);
// 2. Callback xử lý kết quả (Public - vì VNPay/PayPal server gọi về)
router.get('/callback/:method', paymentController.paymentCallback);

// 3. Lấy chi tiết giao dịch theo Order ID (MỚI)
// Route này dùng để Frontend gọi lấy thông tin hiển thị lên trang Success
router.get('/transaction/:orderId', paymentController.getTransactionDetail);



module.exports = router;