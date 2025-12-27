const PaymentStrategy = require('./PaymentStrategy');
const paypalClient = require('../../../config/paypal');
const { OrdersController } = require('@paypal/paypal-server-sdk');

class PaypalStrategy extends PaymentStrategy {
  constructor() {
    super();
    this.ordersController = new OrdersController(paypalClient);
  }

  async initiatePayment({ amount, orderId, description, returnUrl }) {
    const response = await this.ordersController.createOrder({
      body: {
        intent: 'CAPTURE',
        purchaseUnits: [
          {
            referenceId: orderId,
            amount: {
              currencyCode: 'USD',
              value: amount.toFixed(2),
            },
          },
        ],
        applicationContext: {
          returnUrl,
          cancelUrl: `${returnUrl}?cancel=true`,
          userAction: 'PAY_NOW',
        },
      },
    });

    const approveLink = response.result.links.find((l) => l.rel === 'approve');

    return {
      orderId: response.result.id,
      redirectUrl: approveLink.href,
    };
  }

  async verifyCallback(queryParams) {
    const orderId = queryParams.token;

    const capture = await this.ordersController.captureOrder(orderId);

    return {
      success: capture.result.status === 'COMPLETED',
      orderId,
      transactionId: capture.result.purchase_units[0].payments.captures[0].id,
      message: 'Thanh toán PayPal thành công',
    };
  }
}

module.exports = PaypalStrategy;
