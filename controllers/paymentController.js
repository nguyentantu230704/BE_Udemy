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

// @desc    Callback xử lý sau khi thanh toán thành công
exports.paymentCallback = async (req, res) => {
  try {
    const { method } = req.params;
    const queryParams = req.query;
    const result = await paymentService.verifyPayment(method, queryParams);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (result.success) {
      try {
        const trans = await PaymentTransaction.findOne({ orderId: result.orderId }).populate('items');

        if (trans && trans.revenueSplits.length === 0) {
          let splits = [];

          // 💡 LẶP QUA TỪNG KHÓA HỌC ĐỂ CHIA TIỀN CHÍNH XÁC
          for (const course of trans.items) {

            // Tìm xem khóa này có dùng mã không?
            const applied = trans.appliedCoupons?.find(c => c.course.toString() === course._id.toString());
            const discountAmt = applied ? applied.discountAmount : 0;

            // GIÁ THỰC TẾ KHÁCH TRẢ CHO KHÓA NÀY = Giá gốc - Giảm giá
            const courseActualPricePaid = (course.price || 0) - discountAmt;


            const instructor = await User.findById(course.instructor).select('adminCommissionRate');
            const adminRate = instructor?.adminCommissionRate !== undefined ? instructor.adminCommissionRate : 30;
            const instructorShareRate = (100 - adminRate) / 100;

            // Tính tiền dựa trên giá ĐÃ TRỪ MÃ (Cực kỳ công bằng!)
            const earning = courseActualPricePaid * instructorShareRate;
            const adminEarning = courseActualPricePaid - earning;

            splits.push({
              course: course._id,
              instructor: course.instructor,
              coursePriceAtPurchase: course.price,
              courseActualPricePaid: courseActualPricePaid,
              adminCommissionRate: adminRate,
              instructorEarning: earning,
              adminEarning: adminEarning,
              appliedCoupon: applied ? applied.code : null // Ghi chú lại mã vào lịch sử
            });
          }

          trans.revenueSplits = splits;
          trans.paidAt = new Date();

          // 💡 VÒNG LẶP GHI NHẬT KÝ CHO NHIỀU MÃ GIẢM GIÁ
          if (trans.appliedCoupons && trans.appliedCoupons.length > 0) {
            for (const ac of trans.appliedCoupons) {
              const alreadyLogged = await Coupon.findOne({
                code: ac.code,
                'usedBy.orderId': trans.orderId
              });

              if (!alreadyLogged) {
                await Coupon.findOneAndUpdate(
                  { code: ac.code },
                  {
                    $inc: { usedCount: 1 },
                    $push: {
                      usedBy: { user: trans.user, orderId: trans.orderId, usedAt: new Date() }
                    }
                  }
                );
              }
            }
          }

          await trans.save();
        }
      } catch (snapshotError) {
        console.error('Lỗi khi chốt sổ chia tiền:', snapshotError);
      }
      return res.redirect(`${clientUrl}/payment/success?orderId=${result.orderId}`);
    }

    return res.redirect(`${clientUrl}/payment/failed?message=${encodeURIComponent(result.message)}`);
  } catch (err) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    return res.redirect(`${clientUrl}/payment/failed?message=Lỗi hệ thống`);
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

// @desc    Kiểm tra mã giảm giá CHO TỪNG KHÓA HỌC
// @route   POST /api/payment/check-coupon
exports.checkCoupon = async (req, res) => {
  try {
    const { code, courseId } = req.body; // 💡 Nhận chính xác 1 ID khóa học

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    }).populate('course');

    if (!coupon) return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại' });

    if (new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ success: false, message: 'Tiếc quá! Mã giảm giá này đã hết hạn.' });
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Mã giảm giá này đã hết lượt sử dụng.' });
    }

    // Check xem mã có đúng của khóa học này không
    if (coupon.course._id.toString() !== courseId) {
      return res.status(400).json({ success: false, message: `Mã này chỉ áp dụng cho khóa học: ${coupon.course.title}` });
    }

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


// @desc    Tạo link thanh toán VNPay
exports.createPaymentUrl = async (req, res) => {
  try {
    // 💡 Nhận danh sách mã giảm giá từ FE dưới dạng mảng: [{ courseId: '...', code: 'REACT50' }]
    const { method, items, appliedCoupons = [] } = req.body;

    let ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    if (typeof ipAddr === 'string' && ipAddr.includes(',')) ipAddr = ipAddr.split(',')[0].trim();
    if (ipAddr === '::1') ipAddr = '127.0.0.1';

    const courses = await Course.find({ _id: { $in: items } });
    if (courses.length === 0) return res.status(400).json({ message: 'Không tìm thấy khóa học' });

    let finalTotalAmount = 0;
    let validatedCoupons = []; // Lưu các mã hợp lệ để nhét vào Database

    // 💡 TÍNH TOÁN ĐỘC LẬP TỪNG KHÓA HỌC
    for (const course of courses) {
      let coursePrice = course.price;

      // Tìm xem khóa học này có mã giảm giá gửi lên không
      const applied = appliedCoupons.find(c => c.courseId === course._id.toString());

      if (applied) {
        const coupon = await Coupon.findOne({
          code: applied.code.toUpperCase(),
          course: course._id,
          isActive: true,
          expiryDate: { $gt: Date.now() } // Chỉ tính mã còn hạn
        });

        // Nếu mã hợp lệ và còn lượt
        if (coupon && coupon.usedCount < coupon.usageLimit) {
          const discountAmt = (course.price * coupon.discountPercent) / 100;
          coursePrice = course.price - discountAmt; // Trừ tiền khóa này

          validatedCoupons.push({
            course: course._id,
            code: coupon.code,
            discountAmount: discountAmt
          });
        }
      }
      finalTotalAmount += coursePrice; // Cộng vào tổng hóa đơn
    }

    if (finalTotalAmount < 0) finalTotalAmount = 0;

    const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const returnUrl = `${serverUrl}/api/payment/callback/${method}`;

    const payload = {
      method,
      amount: finalTotalAmount,
      orderId: `ORDER_${new Date().getTime()}`,
      description: `Thanh toan don hang ${items.length} khoa hoc`,
      ipAddress: ipAddr,
      returnUrl: returnUrl,
      items,
      userId: req.user._id,

      // 💡 Gửi mảng mã giảm giá hợp lệ xuống Service để lưu vào Transaction
      appliedCoupons: validatedCoupons
    };

    const result = await paymentService.createPayment(payload);
    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi tạo thanh toán: ' + error.message });
  }
};

// @desc    Đăng ký khóa học MIỄN PHÍ (Bỏ qua cổng thanh toán VNPay/PayPal)
// @route   POST /api/payment/enroll-free
exports.enrollFreeCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user._id;

    // 1. Kiểm tra khóa học có tồn tại không
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Khóa học không tồn tại' });
    }

    // 2. CHỐT CHẶN BẢO MẬT: Phải thực sự là khóa học miễn phí (giá = 0)
    if (course.price > 0) {
      return res.status(400).json({
        success: false,
        message: 'Khóa học này có phí. Hành vi gian lận đã bị từ chối!'
      });
    }

    // 3. Lấy thông tin User
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    // 4. Kiểm tra xem học viên đã ghi danh chưa
    if (user.enrolledCourses.includes(courseId)) {
      return res.status(400).json({ success: false, message: 'Bạn đã đăng ký khóa học này rồi' });
    }

    // --- BẮT ĐẦU QUÁ TRÌNH GHI DANH ---

    // 5. Thêm khóa học vào danh sách đã mua
    user.enrolledCourses.push(courseId);

    // 6. Tự động xóa khóa học này khỏi giỏ hàng (nếu khách lỡ thêm vào trước đó)
    if (user.cart && user.cart.length > 0) {
      user.cart = user.cart.filter(id => id.toString() !== courseId.toString());
    }
    await user.save();

    // 7. Tăng số lượng học viên của khóa học lên 1
    course.totalStudents += 1;
    await course.save();

    // 8. (Tùy chọn chuyên nghiệp) Lưu một lịch sử giao dịch 0đ để dễ thống kê sau này
    const generatedOrderId = `FREE_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    try {
      const newTransaction = new PaymentTransaction({
        user: userId,
        items: [courseId],
        amount: 0,
        method: 'free', // Đánh dấu phương thức là free
        orderId: generatedOrderId,
        status: 'completed',
        paidAt: new Date(),
        revenueSplits: [{
          course: course._id,
          instructor: course.instructor,
          coursePriceAtPurchase: 0,
          courseActualPricePaid: 0,
          adminCommissionRate: 0,
          instructorEarning: 0,
          adminEarning: 0,
          appliedCoupon: null
        }]
      });
      await newTransaction.save();
    } catch (err) {
      console.error("Lỗi tạo log giao dịch free (Không ảnh hưởng tiến trình):", err);
    }

    return res.status(200).json({
      success: true,
      message: 'Đăng ký khóa học miễn phí thành công!',
      orderId: generatedOrderId
    });

  } catch (error) {
    console.error("Lỗi enrollFreeCourse:", error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};