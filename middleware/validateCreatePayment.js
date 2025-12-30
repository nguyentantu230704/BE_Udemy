module.exports = (req, res, next) => {
  // 1. Kiểm tra body có tồn tại không
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is missing',
    });
  }

  const { method } = req.body;

  // 2. Logic MỚI: Chỉ bắt buộc phải có method
  // (amount và orderId đã được chuyển sang xử lý tự động tại Controller)
  if (!method) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin bắt buộc: method',
    });
  }

  // 3. Kiểm tra method có hợp lệ không
  const validMethods = ['vnpay', 'paypal'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({
      success: false,
      message: 'Phương thức thanh toán không hợp lệ (chỉ chấp nhận: vnpay, paypal)',
    });
  }

  next();
};