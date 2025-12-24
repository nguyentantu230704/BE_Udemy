module.exports = (req, res, next) => {
  const { method, amount, orderId } = req.body;

  if (!method || !amount || !orderId) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin bắt buộc: method, amount, orderId',
    });
  }

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Số tiền không hợp lệ',
    });
  }

  next();
};
