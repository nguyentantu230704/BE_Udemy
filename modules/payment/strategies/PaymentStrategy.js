class PaymentStrategy {
  /**
   * Khởi tạo giao dịch thanh toán
   * @param {Object} payload
   * @param {number} payload.amount - Tổng tiền (VND)
   * @param {string} payload.orderId - Mã đơn hàng duy nhất
   * @param {string} payload.description - Mô tả giao dịch
   * @param {string} payload.returnUrl - URL để Gateway gọi lại sau khi thanh toán
   * @param {string} payload.ipAddress - IP của người dùng (quan trọng với VNPay)
   * @param {string} payload.userId - ID người dùng mua hàng (Mới)
   * @param {Array} payload.items - Danh sách ID các khóa học trong giỏ (Mới)
   */
  async initiatePayment({
    amount,
    orderId,
    description,
    returnUrl,
    ipAddress,
    userId, // <--- THÊM MỚI
    items,  // <--- THÊM MỚI
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