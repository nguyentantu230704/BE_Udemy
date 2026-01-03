const paymentService = require('../service/paymentService');
const User = require('../models/User');
const PaymentTransaction = require('../models/PaymentTransaction');
const Coupon = require('../models/Coupon');
const Course = require('../models/Course');
/**
 * Tạo payment (VNPay / PayPal / ...)
 * Hỗ trợ thanh toán toàn bộ giỏ hàng
 */
exports.createPayment = async (req, res) => {
  try {
    const {
      method, // 'vnpay', 'paypal'
      description,
      // amount, // KHÔNG DÙNG: Không tin tưởng số tiền từ client gửi lên
      // orderId, // Có thể tự sinh ở backend
    } = req.body;

    const userId = req.user._id;

    // 1. Lấy giỏ hàng từ Database để tính tiền (Bảo mật)
    const user = await User.findById(userId).populate('cart');

    if (!user || !user.cart || user.cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Giỏ hàng trống, không thể thanh toán',
      });
    }

    // 2. Tính tổng tiền từ danh sách khóa học trong giỏ
    // (Giả sử model Course có trường 'price')
    const totalAmount = user.cart.reduce((acc, course) => acc + (course.price || 0), 0);

    // Lấy danh sách ID các khóa học để lưu vào Transaction
    const courseIds = user.cart.map((c) => c._id);

    // 3. Tạo mã đơn hàng (nếu không có)
    const generatedOrderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const finalDescription = description || `Thanh toan don hang ${generatedOrderId}`;

    // 4. Lấy IP client (chuẩn VNPay)
    let ipAddr =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      '127.0.0.1';

    if (typeof ipAddr === 'string' && ipAddr.includes(',')) {
      ipAddr = ipAddr.split(',')[0].trim();
    }
    if (ipAddr === '::1') ipAddr = '127.0.0.1';

    // 5. Gọi Service tạo URL thanh toán
    const result = await paymentService.createPayment({
      method,
      amount: totalAmount, // Số tiền đã tính toán từ DB
      orderId: generatedOrderId,
      description: finalDescription,
      ipAddress: ipAddr,
      userId: userId,     // Quan trọng: Để biết ai mua
      items: courseIds,   // Quan trọng: Để biết mua những khóa nào
      returnUrl: `${req.protocol}://${req.get('host')}/api/payment/callback/${method}`,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Create payment error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Create payment failed',
    });
  }
};

/**
 * Callback từ payment gateway
 * Xử lý kết quả trả về từ VNPay/PayPal
 */
exports.paymentCallback = async (req, res) => {
  try {
    const { method } = req.params; // vnpay / paypal
    const queryParams = req.query;

    // Service thực hiện xác thực và cập nhật DB
    const result = await paymentService.verifyPayment(method, queryParams);

    // --- SỬA ĐỔI Ở ĐÂY: Dùng FE_URL để redirect về Client ---
    // Lấy URL frontend từ biến môi trường (hoặc mặc định là localhost:3000)
    const clientUrl = process.env.FE_URL || 'http://localhost:3000';

    if (result.success) {
      // Chuyển hướng về trang THÀNH CÔNG của Frontend
      return res.redirect(`${clientUrl}/payment/success?orderId=${result.orderId}`);
    }

    // Chuyển hướng về trang THẤT BẠI của Frontend
    return res.redirect(
      `${clientUrl}/payment/failed?message=${encodeURIComponent(result.message)}`
    );

  } catch (err) {
    console.error('Payment callback error:', err);

    // Trường hợp lỗi Crash cũng redirect về Frontend báo lỗi
    const clientUrl = process.env.FE_URL || 'http://localhost:3000';
    return res.redirect(
      `${clientUrl}/payment/failed?message=${encodeURIComponent('Hệ thống gặp lỗi khi xử lý thanh toán')}`
    );
  }
};

exports.getTransactionDetail = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Tìm giao dịch và populate thông tin khóa học (items)
    const transaction = await PaymentTransaction.findOne({ orderId })
      .populate('items', 'title thumbnail price slug') // Chỉ lấy các trường cần thiết
      .populate('user', 'name email');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    // Bảo mật: Chỉ trả về nếu đúng user (nếu cần) hoặc public tùy logic của bạn
    // Ở đây mình trả về luôn để hiển thị cho nhanh

    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error("Get Transaction Error:", error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// @desc    Kiểm tra mã giảm giá (Logic chi tiết: Tồn tại -> Hết hạn -> Khóa học)
// @route   POST /api/payment/check-coupon
exports.checkCoupon = async (req, res) => {
  try {
    const { code, courseIds } = req.body;

    // 1. Tìm mã giảm giá (Chưa check ngày hết hạn vội)
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
      // expiryDate: { $gt: Date.now() } <--- BỎ DÒNG NÀY ĐI
    }).populate('course');

    // 2. Check: Mã có tồn tại không?
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại' });
    }

    // 3. Check: Mã có hết hạn không? (Logic MỚI)
    if (new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({
        success: false,
        message: 'Tiếc quá! Mã giảm giá này đã hết hạn sử dụng.'
      });
    }

    // 4. Check: Mã có áp dụng cho khóa học trong giỏ không?
    if (!courseIds.includes(coupon.course._id.toString())) {
      return res.status(400).json({
        success: false,
        message: `Mã này chỉ áp dụng cho khóa học: ${coupon.course.title}`
      });
    }

    // 5. Nếu mọi thứ OK
    res.json({
      success: true,
      data: {
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        courseId: coupon.course._id
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.createPaymentUrl = async (req, res) => {
  try {
    const { method, items, couponCode } = req.body;

    // 1. Xử lý IP Address chuẩn
    let ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    if (typeof ipAddr === 'string' && ipAddr.includes(',')) ipAddr = ipAddr.split(',')[0].trim();
    if (ipAddr === '::1') ipAddr = '127.0.0.1';

    // 2. Tính tiền từ DB
    const courses = await Course.find({ _id: { $in: items } });
    if (courses.length === 0) return res.status(400).json({ message: 'Không tìm thấy khóa học' });

    let totalAmount = courses.reduce((acc, course) => acc + course.price, 0);
    let discountAmount = 0;
    let finalCouponCode = null;

    // Logic Coupon
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        expiryDate: { $gt: Date.now() }
      });

      if (coupon) {
        const targetCourse = courses.find(c => c._id.toString() === coupon.course.toString());
        if (targetCourse) {
          const discount = (targetCourse.price * coupon.discountPercent) / 100;
          discountAmount = discount;
          totalAmount = totalAmount - discount;
          finalCouponCode = couponCode;
        }
      }
    }

    if (totalAmount < 0) totalAmount = 0;

    // 3. FIX LỖI Ở ĐÂY: Tạo returnUrl động
    // URL để VNPay gọi lại sau khi thanh toán xong
    const returnUrl = `${req.protocol}://${req.get('host')}/api/payment/callback/${method}`;

    // 4. Chuẩn bị payload khớp chính xác với vnpayStrategy.js
    const payload = {
      method,
      amount: totalAmount,
      orderId: `ORDER_${new Date().getTime()}`,

      // SỬA TÊN BIẾN CHO KHỚP STRATEGY:
      description: `Thanh toan don hang ${items.length} khoa hoc`, // Cũ là 'orderInfo' -> Sai
      ipAddress: ipAddr,                                          // Cũ là 'ipAddr' -> Sai
      returnUrl: returnUrl,                                       // Cũ bị thiếu -> Gây lỗi 03

      items,
      userId: req.user._id,
      couponCode: finalCouponCode,
      discountAmount: discountAmount
    };

    const result = await paymentService.createPayment(payload);

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi tạo thanh toán: ' + error.message });
  }
};