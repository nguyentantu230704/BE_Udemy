const { VNPay } = require('vnpay');
const config = require('../../../config/vnpay');
const PaymentStrategy = require('./PaymentStrategy');

class VNPayStrategy extends PaymentStrategy {
  constructor() {
    super();
    if (!config.hashSecret) {
      throw new Error(
        'CRITICAL: VNP_HASH_SECRET is undefined. Check .env file!',
      );
    }
    this.vnpay = new VNPay({
      tmnCode: config.tmnCode,
      secureSecret: config.hashSecret,
      vnpayHost:
        config.baseUrl || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      testMode: true,
    });
  }
  async initiatePayment({
    amount,
    orderId,
    description,
    returnUrl,
    ipAddress,
  }) {
    const vnpIpAddr =
      ipAddress === '::1' ? '127.0.0.1' : ipAddress || '127.0.0.1';
    const redirectUrl = this.vnpay.buildPaymentUrl({
      vnp_Amount: Math.round(Number(amount)),
      vnp_TxnRef: String(orderId),
      vnp_OrderInfo: description || `Thanh toan don hang ${orderId}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: config.returnUrl || returnUrl,
      vnp_IpAddr: vnpIpAddr,
      vnp_Locale: 'vn',
      vnp_CreateDate: new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(0, 14),
    });
    console.log(redirectUrl);
    return { redirectUrl };
  }

  async verifyCallback(queryParams) {
    try {
      const verifyStatus = this.vnpay.verifyReturnUrl(queryParams);

      if (!verifyStatus.isSuccess) {
        return {
          success: false,
          message: 'Sai chu ky hoac du lieu khong hop le',
        };
      }

      return {
        success: queryParams.vnp_ResponseCode === '00',
        orderId: queryParams.vnp_TxnRef,
        transactionId: queryParams.vnp_TransactionNo,
        message:
          queryParams.vnp_ResponseCode === '00'
            ? 'Giao dich thanh cong'
            : 'Giao dich that bai',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Loi trong qua trinh xac thuc ' + error.message,
      };
    }
  }
}

module.exports = VNPayStrategy;
