const paymentService = require('../service/paymentService');

// Tạo payment
exports.createPayment = async (req, res) => {
  try {
    const {
      method,
      amount,
      orderId,
      description = 'Thanh toán đơn hàng',
    } = req.body;

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    const paymentResult = await paymentService.createPayment({
      method,
      amount: parseFloat(amount),
      orderId,
      description,
      userId: req.user?._id || 'demo-user',
      ipAddress,
      returnUrl: `${req.protocol}://${req.get(
        'host',
      )}/api/payment/callback/${method}`,
    });

    return res.status(200).json({
      success: true,
      data: paymentResult,
      message: 'Tạo thanh toán thành công',
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo thanh toán',
      error: error.message,
    });
  }
};

// Callback từ gateway
exports.paymentCallback = async (req, res) => {
  try {
    // const { method } = req.params;
    const queryParams = req.query;

    const result = await paymentService.verifyPayment('vnpay', queryParams);

    if (result.success) {
      return res.redirect('/payment/success?orderId=' + result.orderId);
    }

    return res.redirect(
      '/payment/failed?message=' + encodeURIComponent(result.message),
    );
  } catch (error) {
    console.error('Payment callback error:', error);
    res.redirect(
      '/payment/failed?message=' + encodeURIComponent('Lỗi xử lý callback'),
    );
  }
};
