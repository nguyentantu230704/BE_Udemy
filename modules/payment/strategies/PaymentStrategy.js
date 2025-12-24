class PaymentStrategy {
  async initiatePayment({
    amount,
    orderId,
    description,
    returnUrl,
    ipAddress,
  }) {
    throw new Error('initiatePayment must be implemented');
  }

  async verifyCallback(queryParams) {
    throw new Error('verifyCallback must be implemented');
  }

  async refund(transactionId, amount) {
    throw new Error(
      'refund() is optional but must be implemented if supported',
    );
  }
}

module.exports = PaymentStrategy;
