require('dotenv').config();
const vnpayConfig = {
  tmnCode: process.env.VNP_TMN_CODE,
  hashSecret: process.env.VNP_HASH_SECRET,
  returnUrl: process.env.VNP_RETURN_URL,
  baseUrl:
    process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
};

module.exports = vnpayConfig;
