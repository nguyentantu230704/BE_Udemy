const PayoutRequest = require('../models/PayoutRequest');
const Course = require('../models/Course');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');


// @desc    Lấy thống kê tổng quan (Dashboard)
const getInstructorDashboard = async (req, res) => {
    try {
        const instructorId = req.user._id;

        // Tỷ lệ hiện tại (Chỉ dùng để hiển thị mức rank hiện tại)
        const instructor = await User.findById(instructorId).select('adminCommissionRate');
        const currentAdminRate = instructor.adminCommissionRate !== undefined ? instructor.adminCommissionRate : 30;

        const myCourses = await Course.find({ instructor: instructorId }).select('_id title price totalStudents thumbnail');
        const myCourseIds = myCourses.map(c => c._id.toString());

        if (myCourseIds.length === 0) {
            return res.json({ success: true, data: { grossRevenue: 0, netRevenue: 0, commissionRate: currentAdminRate, totalStudents: 0, monthlyRevenue: [], bestSellers: [], salesHistory: [] } });
        }

        const transactions = await PaymentTransaction.find({
            status: 'paid',
            items: { $in: myCourseIds }
        })
            .populate('items', '_id title')
            .populate('user', 'name email avatar')
            .sort({ createdAt: -1 });

        let grossRevenue = 0;
        let netRevenue = 0;
        let monthlyStats = {};
        let salesHistory = [];

        transactions.forEach(trans => {
            // 💡 CHỈ TÌM TRONG KÉT SẮT NHỮNG KHOẢN CHIA CỦA GIẢNG VIÊN NÀY
            const mySplits = trans.revenueSplits.filter(s => s.instructor.toString() === instructorId.toString());

            mySplits.forEach(split => {
                const totalCourseRevenue = split.instructorEarning + split.adminEarning;
                grossRevenue += totalCourseRevenue;
                netRevenue += split.instructorEarning; // Tiền thực nhận lưu trong két

                const date = new Date(trans.paidAt || trans.updatedAt || trans.createdAt);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                if (!monthlyStats[monthKey]) monthlyStats[monthKey] = 0;
                monthlyStats[monthKey] += split.instructorEarning;

                // Lấy tên khóa học để hiển thị
                const courseObj = trans.items.find(c => c._id.toString() === split.course.toString());

                salesHistory.push({
                    _id: trans._id.toString() + split.course.toString(),
                    date: date,
                    student: trans.user ? { name: trans.user.name, email: trans.user.email, avatar: trans.user.avatar } : { name: 'Khách', email: '' },
                    courseTitle: courseObj ? courseObj.title : 'Khóa học',
                    grossAmount: Math.round(totalCourseRevenue),
                    netAmount: Math.round(split.instructorEarning),
                    appliedRate: split.adminCommissionRate // 💡 Gửi tỷ lệ LÚC BÁN xuống Frontend
                });
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
                commissionRate: currentAdminRate, // Tỷ lệ hiện tại
                totalStudents,
                monthlyRevenue,
                bestSellers,
                salesHistory
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

// --- HÀM PHỤ: Tính toán số dư khả dụng ---
const calculateBalance = async (instructorId) => {
    const myCourses = await Course.find({ instructor: instructorId }).select('_id');
    const myCourseIds = myCourses.map(c => c._id.toString());

    const transactions = await PaymentTransaction.find({
        status: 'paid',
        items: { $in: myCourseIds }
    });

    let totalEarned = 0;
    transactions.forEach(trans => {
        // Đọc từ két sắt thay vì tính lại
        const mySplits = trans.revenueSplits.filter(s => s.instructor.toString() === instructorId.toString());
        mySplits.forEach(split => {
            totalEarned += split.instructorEarning;
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