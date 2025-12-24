const crypto = require('crypto');
const qs = require('qs');
const config = require('../../../config/vnpay');
const PaymentStrategy = require('./PaymentStrategy');

const sortObject = (obj) => {
  return Object.keys(obj)
    .filter(
      (key) => obj[key] !== null && obj[key] !== undefined && obj[key] !== '',
    )
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
};

class VNPayStrategy extends PaymentStrategy {
  async initiatePayment({
    amount,
    orderId,
    description,
    returnUrl,
    ipAddress,
  }) {
    const secretKey = config.hashSecret;

    let params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.tmnCode,
      // VNPay expects amount in smallest currency unit (VND * 100). Ensure integer.
      vnp_Amount: Math.round(Number(amount) * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: String(orderId).substring(0, 50),
      // Encode order info to avoid malformed query strings when description contains special chars.
      vnp_OrderInfo: encodeURIComponent(
        (description || `Thanh toan don hanh ${orderId}`).substring(0, 255),
      ),
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      // Ensure return URL is present and ends with a '?' when it has no query marker.
      // Some VNPay flows append parameters using '&' unconditionally, so providing
      // a trailing '?' avoids producing a malformed path like '/api/vnpay_return&vnp_TxnRef=...'.
      vnp_ReturnUrl: (() => {
        const r = config.returnUrl || returnUrl || '';
        if (!r) return r;
        // If there's already a '?' (existing query), keep as-is. Otherwise append '?'.
        return r.includes('?') ? r : r + '?';
      })(),
      vnp_IpAddr: ipAddress || '127.0.0.1',
      vnp_CreateDate: new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(0, 14),
    };

    params = sortObject(params);

    const signData = qs.stringify(params, { encode: false });
    const secureHash = crypto
      .createHmac('sha512', secretKey)
      .update(signData)
      .digest('hex');

    params.vnp_SecureHash = secureHash;

    const redirectUrl =
      config.baseUrl + '?' + qs.stringify(params, { encode: false });
    console.log('VNPay redirectUrl:', redirectUrl);

    return { redirectUrl };
  }

  async verifyCallback(queryParams) {
    const secretKey = config.hashSecret;
    const secureHash = queryParams.vnp_SecureHash;

    delete queryParams.vnp_SecureHash;
    delete queryParams.vnp_SecureHashType;

    const sortedParams = sortObject(queryParams);
    const signData = qs.stringify(sortedParams, { encode: false });

    const checkHash = crypto
      .createHmac('sha512', secretKey)
      .update(signData)
      .digest('hex');

    if (secureHash !== checkHash) {
      return {
        success: false,
        message: 'Invalid secure hash',
      };
    }

    return {
      success: queryParams.vnp_ResponseCode === '00',
      orderId: queryParams.vnp_TxnRef,
      transactionId: queryParams.vnp_TransactionNo,
      message:
        queryParams.vnp_ResponseCode === '00'
          ? 'Payment success'
          : 'Payment failed',
    };
  }
}

module.exports = VNPayStrategy;
