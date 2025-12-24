const PaymentFactory = require('../modules/payment/paymentFactory');
const PaymentTransaction = require('../models/PaymentTransaction');

const createPayment = async (payload) => {
  const strategy = PaymentFactory.getStrategy(payload.method);

  const result = await strategy.initiatePayment(payload);

  if (!result?.redirectUrl) {
    throw new Error('Payment gateway did not return redirectUrl');
  }

  await PaymentTransaction.create({
    orderId: payload.orderId,
    userId: payload.userId,
    method: payload.method,
    amount: payload.amount,
    status: 'pending',
  });

  return result;
};

const verifyPayment = async (method, queryParams) => {
  const strategy = PaymentFactory.getStrategy(method);

  const verifyResult = await strategy.verifyCallback(queryParams);

  const transaction = await PaymentTransaction.findOne({
    orderId: verifyResult.orderId,
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status === 'PAID') {
    return {
      success: true,
      orderId: transaction.orderId,
      message: 'Already paid',
    };
  }

  transaction.status = verifyResult.success ? 'paid' : 'failed';
  transaction.gatewayTransactionId = verifyResult.transactionId;
  transaction.rawResponse = queryParams;

  await transaction.save();

  return {
    success: verifyResult.success,
    orderId: transaction.orderId,
    message: verifyResult.message,
  };
};

module.exports = { createPayment, verifyPayment };
