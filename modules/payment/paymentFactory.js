const VNPayStrategy = require('./strategies/vnpayStrategy');
const PayPalStrategy = require('./strategies/paypalStrategy');

const strategies = {
  vnpay: new VNPayStrategy(),
  paypal: new PayPalStrategy(),
};

const getStrategy = (method) => {
  const strategy = strategies[method];
  if (!strategy) throw new Error(`Unsupported payment method: ${method}`);
  return strategy;
};

module.exports = { getStrategy };
