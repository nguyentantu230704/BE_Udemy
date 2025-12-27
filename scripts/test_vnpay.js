// Temporary env defaults for local testing (override in .env for real runs)
process.env.VNPAY_TMN_CODE = process.env.VNPAY_TMN_CODE || 'TESTTMNCODE';
process.env.VNP_HASH_SECRET = process.env.VNP_HASH_SECRET || 'TESTSECRET';
process.env.VNP_BASE_URL =
  process.env.VNP_BASE_URL ||
  'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

const VNPayStrategy = require('../modules/payment/strategies/vnpayStrategy');
const config = require('../config/vnpay');

(async () => {
  const strategy = new VNPayStrategy();
  const result = await strategy.initiatePayment({
    amount: 100000,
    orderId: 'TEST123456',
    description: 'Test payment',
    returnUrl: config.returnUrl,
    ipAddress: '127.0.0.1',
  });

  console.log('Generated redirectUrl:');
  console.log(result.redirectUrl);
})();
