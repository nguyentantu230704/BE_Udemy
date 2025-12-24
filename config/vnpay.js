require('dotenv').config();

const vnpayConfig = {
  tmnCode: process.env.VNPAY_TMN_CODE,
  hashSecret: process.env.VNP_HASH_SECRET,
  returnUrl: process.env.VNP_RETURN_URL,
  // VNPay gateway base URL. If you use sandbox/testing, set VNP_BASE_URL in .env.
  // Official production URL: 'https://pay.vnpay.vn/vpcpay.html'
  // Sandbox/testing URL (commonly used): 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
  baseUrl:
    process.env.VNP_BASE_URL ||
    'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
};

module.exports = vnpayConfig;
