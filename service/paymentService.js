const PaymentFactory = require('../modules/payment/paymentFactory');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const Course = require('../models/Course');

const createPayment = async (payload) => {
  const strategy = PaymentFactory.getStrategy(payload.method);
  const result = await strategy.initiatePayment(payload);

  if (!result?.redirectUrl) {
    throw new Error('Payment gateway did not return redirectUrl');
  }

  // Tạo transaction với Token tạm (VD: 5E1...)
  await PaymentTransaction.create({
    orderId: payload.orderId,      // Mã nội bộ (ORDER_...)
    transactionId: result.orderId, // Token PayPal (5E1...)
    user: payload.userId,
    items: payload.items,
    provider: payload.method,
    amount: payload.amount,
    status: 'pending',
  });

  return result;
};

const verifyPayment = async (method, queryParams) => {
  const strategy = PaymentFactory.getStrategy(method);
  const verifyResult = await strategy.verifyCallback(queryParams);

  // 1. Tìm Transaction bằng cả 2 loại mã (để hỗ trợ cả VNPay và PayPal)
  const transaction = await PaymentTransaction.findOne({
    $or: [
      { orderId: verifyResult.orderId },      // VNPay trả về mã nội bộ
      { transactionId: verifyResult.orderId } // PayPal trả về Token
    ]
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status === 'paid') {
    return { success: true, orderId: transaction.orderId, message: 'Already paid' };
  }

  // 2. Cập nhật trạng thái
  transaction.status = verifyResult.success ? 'paid' : 'failed';

  // --- CẬP NHẬT MÃ GIAO DỊCH THẬT (FIX LỖI MÃ KHÔNG KHỚP) ---
  if (verifyResult.success && verifyResult.transactionId) {
    // Ghi đè Token (5E1...) bằng Transaction ID thật (89E...)
    transaction.transactionId = verifyResult.transactionId;
  }
  // ---------------------------------------------------------

  transaction.rawResponse = queryParams;
  transaction.paidAt = verifyResult.success ? new Date() : null;
  await transaction.save();

  // Logic kích hoạt khóa học
  if (verifyResult.success && transaction.items && transaction.items.length > 0) {
    try {
      await User.findByIdAndUpdate(transaction.user, {
        $addToSet: { enrolledCourses: { $each: transaction.items } },
        $set: { cart: [] }
      });

      await Course.updateMany(
        { _id: { $in: transaction.items } },
        { $inc: { totalStudents: 1 } }
      );
    } catch (err) {
      console.error("Lỗi kích hoạt khóa học:", err);
    }
  }

  return {
    success: verifyResult.success,
    orderId: transaction.orderId,
    message: verifyResult.message,
  };
};

module.exports = { createPayment, verifyPayment };