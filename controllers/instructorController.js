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

        // 1. Tìm tất cả khóa học của giảng viên này
        const myCourses = await Course.find({ instructor: instructorId }).select('_id title price totalStudents thumbnail');
        const myCourseIds = myCourses.map(c => c._id);

        if (myCourseIds.length === 0) {
            return res.json({ success: true, data: { totalRevenue: 0, totalStudents: 0, monthlyRevenue: [], bestSellers: [] } });
        }

        // 2. Tìm tất cả giao dịch ĐÃ THANH TOÁN có chứa khóa học của giảng viên
        const transactions = await PaymentTransaction.find({
            status: 'paid',
            items: { $in: myCourseIds }
        }).populate('items', 'price _id instructor');
        // Populate để lấy giá tiền lúc mua (hoặc giá hiện tại)

        // 3. Tính toán doanh thu
        let totalRevenue = 0;
        let monthlyStats = {}; // { "2023-10": 1500000, "2023-11": 2000000 }

        transactions.forEach(trans => {
            // Một giao dịch có thể chứa khóa học của người khác, nên phải lọc lại item
            trans.items.forEach(course => {
                if (course.instructor.toString() === instructorId.toString()) {
                    // Tính doanh thu thực nhận (70%)
                    const earning = (course.price || 0) * INSTRUCTOR_SHARE;
                    totalRevenue += earning;

                    // Group theo tháng
                    const date = new Date(trans.paidAt || trans.createdAt);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                    if (!monthlyStats[monthKey]) monthlyStats[monthKey] = 0;
                    monthlyStats[monthKey] += earning;
                }
            });
        });

        // 4. Chuyển đổi monthlyStats sang mảng cho biểu đồ
        const monthlyRevenue = Object.keys(monthlyStats).map(key => ({
            month: key,
            revenue: monthlyStats[key]
        })).sort((a, b) => a.month.localeCompare(b.month)); // Sắp xếp theo tháng

        // 5. Tìm khóa học bán chạy nhất (Dựa vào totalStudents có sẵn trong Course)
        const bestSellers = myCourses
            .sort((a, b) => b.totalStudents - a.totalStudents)
            .slice(0, 5); // Top 5

        // 6. Tính tổng học viên
        const totalStudents = myCourses.reduce((acc, curr) => acc + curr.totalStudents, 0);

        res.json({
            success: true,
            data: {
                totalRevenue: Math.round(totalRevenue), // Làm tròn
                totalStudents,
                monthlyRevenue, // Dùng vẽ biểu đồ
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

module.exports = { getInstructorDashboard, getInstructorCoursesSelect };