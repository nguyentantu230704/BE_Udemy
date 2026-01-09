const PayoutRequest = require('../models/PayoutRequest');
const Course = require('../models/Course');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');

// Giả sử phí sàn là 30%, Giảng viên nhận 70%
const INSTRUCTOR_SHARE = 0.7;

// @desc    Lấy thống kê tổng quan (Dashboard)
// @route   GET /api/instructor/dashboard
const getInstructorDashboard = async (req, res) => {
    try {
        const instructorId = req.user._id;
        const INSTRUCTOR_SHARE = 0.7; // 70%

        // 1. Tìm tất cả khóa học của giảng viên này
        const myCourses = await Course.find({ instructor: instructorId }).select('_id title price totalStudents thumbnail');
        const myCourseIds = myCourses.map(c => c._id.toString());

        if (myCourseIds.length === 0) {
            return res.json({ success: true, data: { totalRevenue: 0, totalStudents: 0, monthlyRevenue: [], bestSellers: [] } });
        }

        // 2. Tìm tất cả giao dịch ĐÃ THANH TOÁN có chứa khóa học của giảng viên
        const transactions = await PaymentTransaction.find({
            status: 'paid',
            items: { $in: myCourseIds }
        }).populate('items', 'price _id instructor');

        // 3. Tính toán doanh thu
        let totalRevenue = 0;
        let monthlyStats = {};

        transactions.forEach(trans => {
            // --- BƯỚC QUAN TRỌNG: Tính tổng giá gốc của cả đơn hàng này ---
            // Để làm mẫu số phân chia tỷ lệ tiền
            const cartOriginalTotal = trans.items.reduce((sum, item) => sum + (item.price || 0), 0);

            // Nếu đơn hàng 0đ hoặc lỗi dữ liệu thì bỏ qua để tránh chia cho 0
            if (cartOriginalTotal === 0 && trans.amount > 0) return;

            trans.items.forEach(course => {
                // Chỉ tính doanh thu cho khóa học CỦA MÌNH
                if (course.instructor.toString() === instructorId.toString()) {

                    let earning = 0;

                    if (trans.amount === 0) {
                        // Trường hợp khóa học miễn phí hoặc đơn hàng 0đ
                        earning = 0;
                    } else {
                        // --- SỬA LOGIC TẠI ĐÂY ---
                        // Tính tỷ trọng: (Giá khóa này / Tổng giá gốc giỏ hàng) * Số tiền khách thực trả
                        const portionPaid = (course.price / cartOriginalTotal) * trans.amount;

                        // Giảng viên nhận 70% của phần tiền thực trả đó
                        earning = portionPaid * INSTRUCTOR_SHARE;
                    }

                    totalRevenue += earning;

                    // Group theo tháng
                    const date = new Date(trans.updatedAt || trans.createdAt); // Nên dùng updatedAt (thời điểm thanh toán xong)
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                    if (!monthlyStats[monthKey]) monthlyStats[monthKey] = 0;
                    monthlyStats[monthKey] += earning;
                }
            });
        });

        // 4. Chuyển đổi monthlyStats sang mảng cho biểu đồ
        const monthlyRevenue = Object.keys(monthlyStats).map(key => ({
            month: key,
            revenue: Math.round(monthlyStats[key])
        })).sort((a, b) => a.month.localeCompare(b.month));

        // 5. Tìm khóa học bán chạy nhất
        const bestSellers = myCourses
            .sort((a, b) => b.totalStudents - a.totalStudents)
            .slice(0, 5);

        // 6. Tính tổng học viên
        const totalStudents = myCourses.reduce((acc, curr) => acc + curr.totalStudents, 0);

        res.json({
            success: true,
            data: {
                totalRevenue: Math.round(totalRevenue), // Làm tròn số tiền cuối cùng
                totalStudents,
                monthlyRevenue,
                bestSellers
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi thống kê" });
    }
};

// @desc    Lấy danh sách khóa học của giảng viên (Để hiển thị dropdown chọn)
// @route   GET /api/instructor/courses-select
const getInstructorCoursesSelect = async (req, res) => {
    try {
        // Chỉ tìm khóa học do user hiện tại tạo
        const courses = await Course.find({ instructor: req.user._id })
            .select('_id title') // Chỉ lấy ID và Tên cho nhẹ
            .sort({ createdAt: -1 });

        res.json({ success: true, data: courses });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// --- HÀM PHỤ: Tính toán số dư khả dụng (Dùng chung) ---
const calculateBalance = async (instructorId) => {
    // 1. Tính TỔNG THU NHẬP (Logic 70% chuẩn)
    const myCourses = await Course.find({ instructor: instructorId }).select('_id price');
    const myCourseIds = myCourses.map(c => c._id.toString());

    const transactions = await PaymentTransaction.find({
        status: 'paid',
        items: { $in: myCourseIds }
    }).populate('items', 'price instructor');

    let totalEarned = 0;
    transactions.forEach(trans => {
        const cartTotal = trans.items.reduce((sum, item) => sum + (item.price || 0), 0);
        if (cartTotal === 0 && trans.amount > 0) return;

        trans.items.forEach(item => {
            if (item.instructor && item.instructor.toString() === instructorId.toString()) {
                let earning = 0;
                if (trans.amount > 0) {
                    const portion = (item.price / cartTotal) * trans.amount;
                    earning = Math.round(portion * 0.7); // 70%
                }
                totalEarned += earning;
            }
        });
    });

    // 2. Tính TỔNG ĐÃ RÚT (Bao gồm 'approved' VÀ 'pending')
    // Phải trừ cả tiền đang chờ duyệt để tránh rút trùng
    const payouts = await PayoutRequest.find({
        instructor: instructorId,
        status: { $in: ['approved', 'pending'] }
    });

    const totalWithdrawn = payouts.reduce((acc, curr) => acc + curr.amount, 0);

    // 3. Số dư khả dụng
    const availableBalance = totalEarned - totalWithdrawn;

    return { totalEarned, totalWithdrawn, availableBalance };
};

// @desc    Gửi yêu cầu rút tiền (CÓ KIỂM TRA SỐ DƯ)
// @route   POST /api/instructor/payouts
const createPayoutRequest = async (req, res) => {
    try {
        const { amount, bankInfo } = req.body;
        const instructorId = req.user._id;

        // Validation cơ bản
        if (!amount || amount < 50000) { // Ví dụ: Tối thiểu 50k
            return res.status(400).json({ success: false, message: "Số tiền rút tối thiểu là 50.000đ" });
        }

        if (!bankInfo || !bankInfo.bankName || !bankInfo.accountNumber) {
            return res.status(400).json({ success: false, message: "Vui lòng cung cấp thông tin ngân hàng đầy đủ" });
        }

        // --- KIỂM TRA SỐ DƯ ---
        const { availableBalance } = await calculateBalance(instructorId);

        if (amount > availableBalance) {
            return res.status(400).json({
                success: false,
                message: `Số dư không đủ. Bạn chỉ có thể rút tối đa ${Math.floor(availableBalance).toLocaleString('vi-VN')}đ`
            });
        }

        // Tạo yêu cầu
        const payout = await PayoutRequest.create({
            instructor: instructorId,
            amount,
            paymentInfo: bankInfo,
            status: 'pending'
        });

        res.json({ success: true, message: "Gửi yêu cầu thành công!", data: payout });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi xử lý yêu cầu rút tiền" });
    }
};

// @desc    Lấy thông tin ví tiền (Để hiển thị lên UI)
// @route   GET /api/instructor/payouts/balance
const getPayoutBalance = async (req, res) => {
    try {
        const data = await calculateBalance(req.user._id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi lấy số dư" });
    }
};


module.exports = { getInstructorDashboard, getInstructorCoursesSelect, createPayoutRequest, getPayoutBalance };