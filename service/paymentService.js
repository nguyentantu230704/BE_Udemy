const PaymentFactory = require('../modules/payment/paymentFactory');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const Course = require('../models/Course');
const sendEmail = require('../utils/sendEmail');


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

  // Logic kích hoạt khóa học & Gửi mail
  if (verifyResult.success && transaction.items && transaction.items.length > 0) {
    try {
      // 1. Kích hoạt khóa học
      await User.findByIdAndUpdate(transaction.user, {
        $addToSet: { enrolledCourses: { $each: transaction.items } },
        $set: { cart: [] }
      });

      await Course.updateMany(
        { _id: { $in: transaction.items } },
        { $inc: { totalStudents: 1 } }
      );

      // --- 2. GỬI MAIL HÓA ĐƠN (MỚI) ---
      const currentUser = await User.findById(transaction.user);

      // Populate items để lấy tên khóa học và giá
      const populatedTrans = await PaymentTransaction.findById(transaction._id).populate('items');

      const listItemsHtml = populatedTrans.items.map(item =>
        `<li>${item.title} - <b>${(item.price || 0).toLocaleString('vi-VN')} đ</b></li>`
      ).join('');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #6b21a8;">Cảm ơn bạn đã mua khóa học!</h2>
            <p>Xin chào <b>${currentUser.name}</b>,</p>
            <p>Đơn hàng <b>${transaction.orderId}</b> đã được thanh toán thành công.</p>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Chi tiết đơn hàng:</h3>
                <ul>${listItemsHtml}</ul>
                <p style="font-size: 18px; font-weight: bold; margin-top: 10px;">
                   Tổng thanh toán: ${transaction.amount.toLocaleString('vi-VN')} đ
                </p>
            </div>

            <p>Bạn có thể truy cập khóa học ngay bây giờ tại trang "Khóa học của tôi".</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Udemy Clone Team</p>
        </div>
      `;

      // Gửi mail không chặn luồng chính (không await hoặc catch riêng)
      sendEmail({
        email: currentUser.email,
        subject: `[Hóa đơn] Xác nhận đơn hàng #${transaction.orderId}`,
        message: `Thanh toán thành công đơn hàng ${transaction.orderId}`,
        html: emailHtml
      }).catch(err => console.error("Lỗi gửi mail hóa đơn:", err));

    } catch (err) {
      console.error("Lỗi kích hoạt/gửi mail:", err);
    }
  }

  return {
    success: verifyResult.success,
    orderId: transaction.orderId,
    message: verifyResult.message,
  };
};

module.exports = { createPayment, verifyPayment };