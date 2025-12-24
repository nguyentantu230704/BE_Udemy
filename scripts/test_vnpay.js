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
