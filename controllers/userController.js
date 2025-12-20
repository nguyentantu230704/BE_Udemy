const User = require('../models/User');
const Course = require('../models/Course');
const bcrypt = require('bcryptjs');

// @desc    Đăng ký khóa học (Miễn phí / Enroll)
// @route   POST /api/users/enroll
// @access  Private
const enrollCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.user._id;

        // 1. Kiểm tra khóa học có tồn tại không
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: "Khóa học không tồn tại" });
        }

        // 2. Kiểm tra user đã mua chưa
        const user = await User.findById(userId);
        if (user.enrolledCourses.includes(courseId)) {
            return res.status(400).json({ success: false, message: "Bạn đã đăng ký khóa học này rồi" });
        }

        // 3. Thêm courseId vào mảng enrolledCourses của User
        user.enrolledCourses.push(courseId);
        await user.save();

        // (Optional) Thêm userId vào mảng students của Course để đếm số lượng học viên
        // course.students.push(userId);
        // await course.save();

        res.status(200).json({
            success: true,
            message: "Đăng ký thành công",
            data: user.enrolledCourses
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// Hàm lấy danh sách khóa học đã mua (My Learning)
const getMyCourses = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: 'enrolledCourses',
                populate: { path: 'instructor', select: 'name avatar' } // Lồng nhau để lấy cả tên giảng viên
            });
        res.json({
            success: true,
            data: user.enrolledCourses
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Cập nhật thông tin cá nhân (Tên, Avatar, Password)
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        // 1. Tìm user và lấy cả trường password (đề phòng model set select: false)
        const user = await User.findById(req.user._id).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: "Không tìm thấy User" });
        }

        // 2. Cập nhật Tên
        user.name = req.body.name || user.name;

        // 3. Cập nhật Avatar (Nếu có upload ảnh mới từ Cloudinary)
        if (req.file) {
            user.avatar = req.file.path;
        }

        // 4. Xử lý Đổi mật khẩu (Quan trọng)
        if (req.body.newPassword) {
            // Kiểm tra xem có gửi mật khẩu cũ không
            if (!req.body.currentPassword) {
                return res.status(400).json({ success: false, message: "Vui lòng nhập mật khẩu hiện tại để xác thực" });
            }

            // So sánh mật khẩu cũ nhập vào với mật khẩu mã hóa trong DB
            const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không đúng" });
            }

            // --- MÃ HÓA MẬT KHẨU MỚI NGAY TẠI ĐÂY ---
            // Để đảm bảo 100% không bị lỗi lưu plain text
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(req.body.newPassword, salt);
        }

        // 5. Lưu vào DB
        const updatedUser = await user.save();

        // 6. Trả về kết quả (Loại bỏ password ra khỏi data trả về cho an toàn)
        res.json({
            success: true,
            message: "Cập nhật thông tin thành công",
            data: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                avatar: updatedUser.avatar,
                // Không trả về password và token (token client tự lưu rồi, không cần gửi lại trừ khi refresh token)
            }
        });

    } catch (error) {
        console.error("Lỗi cập nhật profile:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


module.exports = { enrollCourse, getMyCourses, updateUserProfile };