const paymentService = require('../service/paymentService');

/**
 * Tạo payment (VNPay / PayPal / ...)
 */
exports.createPayment = async (req, res) => {
  try {
    const {
      method, // 'vnpay', 'paypal', ...
      amount,
      orderId,
      description,
    } = req.body;

    // Lấy IP client (chuẩn VNPay)
    let ipAddr =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      '127.0.0.1';

    if (typeof ipAddr === 'string' && ipAddr.includes(',')) {
      ipAddr = ipAddr.split(',')[0].trim();
    }

    if (ipAddr === '::1') ipAddr = '127.0.0.1';

    const result = await paymentService.createPayment({
      method,
      amount: Number(amount),
      orderId,
      description,
      ipAddress: ipAddr,
      returnUrl: `${req.protocol}://${req.get(
        'host',
      )}/api/payment/callback/${method}`,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Create payment error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Create payment failed',
    });
  }
};

/**
 * Callback từ payment gateway
 */
exports.paymentCallback = async (req, res) => {
  try {
    const { method } = req.params; // vnpay / paypal
    const queryParams = req.query;

    const result = await paymentService.verifyPayment(method, queryParams);

    if (result.success) {
      return res.redirect(`/payment/success?orderId=${result.orderId}`);
    }

    return res.redirect(
      `/payment/failed?message=${encodeURIComponent(result.message)}`,
    );
  } catch (err) {
    console.error('Payment callback error:', err);
    return res.redirect(
      `/payment/failed?message=${encodeURIComponent('Callback error')}`,
    );
  }
};
