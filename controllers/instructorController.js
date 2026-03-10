const PayoutRequest = require('../models/PayoutRequest');
const Course = require('../models/Course');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');


// @desc    Lấy thống kê tổng quan (Dashboard)
const getInstructorDashboard = async (req, res) => {
    try {
        const instructorId = req.user._id;

        const instructor = await User.findById(instructorId).select('adminCommissionRate');
        const adminRate = instructor.adminCommissionRate !== undefined ? instructor.adminCommissionRate : 30;
        const instructorShareRate = (100 - adminRate) / 100;

        const myCourses = await Course.find({ instructor: instructorId }).select('_id title price totalStudents thumbnail');
        const myCourseIds = myCourses.map(c => c._id.toString());

        if (myCourseIds.length === 0) {
            return res.json({ success: true, data: { grossRevenue: 0, netRevenue: 0, commissionRate: adminRate, totalStudents: 0, monthlyRevenue: [], bestSellers: [], salesHistory: [] } });
        }

        // --- BỔ SUNG: Populate thêm 'title' cho khóa học và 'user' để lấy tên học viên ---
        const transactions = await PaymentTransaction.find({
            status: 'paid',
            items: { $in: myCourseIds }
        })
            .populate('items', 'price _id instructor title') // Lấy thêm title của khóa học
            .populate('user', 'name email avatar')           // Lấy thông tin người mua
            .sort({ createdAt: -1 });                        // Sắp xếp mới nhất lên đầu

        let grossRevenue = 0;
        let netRevenue = 0;
        let monthlyStats = {};

        // --- MỚI: Mảng chứa lịch sử giao dịch ---
        let salesHistory = [];

        transactions.forEach(trans => {
            const cartOriginalTotal = trans.items.reduce((sum, item) => sum + (item.price || 0), 0);
            if (cartOriginalTotal === 0 && trans.amount > 0) return;

            trans.items.forEach(course => {
                if (course.instructor.toString() === instructorId.toString()) {
                    let portionPaid = 0;
                    let earning = 0;

                    if (trans.amount > 0) {
                        portionPaid = (course.price / cartOriginalTotal) * trans.amount;
                        earning = portionPaid * instructorShareRate;
                    }

                    grossRevenue += portionPaid;
                    netRevenue += earning;

                    const date = new Date(trans.updatedAt || trans.createdAt);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                    if (!monthlyStats[monthKey]) monthlyStats[monthKey] = 0;
                    monthlyStats[monthKey] += earning;

                    // --- MỚI: Đẩy thông tin giao dịch vào mảng ---
                    salesHistory.push({
                        _id: trans._id.toString() + course._id.toString(), // Tạo ID giả cho list key
                        date: date,
                        student: trans.user ? { name: trans.user.name, email: trans.user.email, avatar: trans.user.avatar } : { name: 'Khách', email: '' },
                        courseTitle: course.title,
                        grossAmount: Math.round(portionPaid),
                        netAmount: Math.round(earning)
                    });
                }
            });
        });

        const monthlyRevenue = Object.keys(monthlyStats).map(key => ({
            month: key,
            revenue: Math.round(monthlyStats[key])
        })).sort((a, b) => a.month.localeCompare(b.month));

        const bestSellers = myCourses.sort((a, b) => b.totalStudents - a.totalStudents).slice(0, 5);
        const totalStudents = myCourses.reduce((acc, curr) => acc + curr.totalStudents, 0);

        res.json({
            success: true,
            data: {
                grossRevenue: Math.round(grossRevenue),
                netRevenue: Math.round(netRevenue),
                commissionRate: adminRate,
                totalStudents,
                monthlyRevenue,
                bestSellers,
                salesHistory // --- Trả mảng này về cho Frontend ---
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

// --- HÀM PHỤ: Tính toán số dư khả dụng (Sửa lại logic 70% cứng) ---
const calculateBalance = async (instructorId) => {
    // Lấy tỉ lệ từ DB
    const instructor = await User.findById(instructorId).select('adminCommissionRate');
    const adminRate = instructor.adminCommissionRate !== undefined ? instructor.adminCommissionRate : 30;
    const instructorShareRate = (100 - adminRate) / 100;

    const myCourses = await Course.find({ instructor: instructorId }).select('_id price');
    const myCourseIds = myCourses.map(c => c._id.toString());

    const transactions = await PaymentTransaction.find({
        status: 'paid',
        items: { $in: myCourseIds }
    }).populate('items', 'price instructor');

    let totalEarned = 0; // TỔNG THỰC NHẬN
    transactions.forEach(trans => {
        const cartTotal = trans.items.reduce((sum, item) => sum + (item.price || 0), 0);
        if (cartTotal === 0 && trans.amount > 0) return;

        trans.items.forEach(item => {
            if (item.instructor && item.instructor.toString() === instructorId.toString()) {
                let earning = 0;
                if (trans.amount > 0) {
                    const portion = (item.price / cartTotal) * trans.amount;
                    earning = portion * instructorShareRate; // Dùng tỉ lệ động
                }
                totalEarned += earning;
            }
        });
    });

    const payouts = await PayoutRequest.find({
        instructor: instructorId,
        status: { $in: ['approved', 'pending'] }
    });

    const totalWithdrawn = payouts.reduce((acc, curr) => acc + curr.amount, 0);
    const availableBalance = totalEarned - totalWithdrawn;

    return {
        totalEarned: Math.round(totalEarned),
        totalWithdrawn,
        availableBalance: Math.round(availableBalance)
    };
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