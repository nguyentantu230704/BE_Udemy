const PaymentStrategy = require('./PaymentStrategy');
const paypalClient = require('../../../config/paypal');
const { OrdersController } = require('@paypal/paypal-server-sdk');

class PaypalStrategy extends PaymentStrategy {
  constructor() {
    super();
    this.ordersController = new OrdersController(paypalClient);
  }

  async initiatePayment({ amount, orderId, description, returnUrl }) {
    const EXCHANGE_RATE = 24500;
    const amountInUSD = (Number(amount) / EXCHANGE_RATE).toFixed(2);

    const response = await this.ordersController.createOrder({
      body: {
        intent: 'CAPTURE',
        purchaseUnits: [
          {
            referenceId: orderId,
            description: description,
            amount: {
              currencyCode: 'USD',
              value: amountInUSD,
            },
          },
        ],
        applicationContext: {
          returnUrl,
          cancelUrl: `${returnUrl}?cancel=true`,
          userAction: 'PAY_NOW',
          brandName: 'SmartLMS',
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
    if (queryParams.cancel === 'true') {
      return {
        success: false,
        message: "Giao dịch đã bị hủy bởi người dùng",
        orderId: queryParams.token
      };
    }

    const token = queryParams.token;

    try {
      const capture = await this.ordersController.captureOrder({
        id: token,
        prefer: "return=representation"
      });

      // Kiểm tra trạng thái: COMPLETED hoặc PENDING (đều tính là đã có giao dịch)
      const status = capture.result.status;
      const success = status === 'COMPLETED' || status === 'PENDING';

      let captureId = null;

      // --- SỬA LỖI CAMELCASE TẠI ĐÂY ---
      // SDK trả về 'purchaseUnits' (không phải 'purchase_units')
      if (capture.result.purchaseUnits && capture.result.purchaseUnits.length > 0) {
        const purchaseUnit = capture.result.purchaseUnits[0];

        // Kiểm tra payments -> captures
        if (purchaseUnit.payments && purchaseUnit.payments.captures && purchaseUnit.payments.captures.length > 0) {
          captureId = purchaseUnit.payments.captures[0].id;
        }
      }

      // Fallback: Nếu không tìm thấy, thử tìm ID gốc
      if (!captureId && capture.result.id) {
        captureId = capture.result.id;
      }

      console.log("------------------------------------------------");
      console.log("🔹 Token (Order ID):", token);
      console.log("✅ Transaction ID (Capture ID):", captureId);
      console.log("⚠️ Trạng thái:", status); // Log thêm trạng thái để bạn biết
      console.log("------------------------------------------------");

      return {
        success: success,
        orderId: token,
        transactionId: captureId,
        message: success ? 'Thanh toán PayPal thành công' : 'Thanh toán thất bại hoặc chờ xử lý',
      };

    } catch (error) {
      console.error("🔥 PayPal Capture Error:", error);
      return {
        success: false,
        message: "Lỗi hệ thống khi xác nhận PayPal",
        orderId: token
      };
    }
  }
}

module.exports = PaypalStrategy;