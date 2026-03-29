const User = require('../models/User');
const Course = require('../models/Course');
const bcrypt = require('bcryptjs');
const CourseProgress = require('../models/CourseProgress');
const sendEmail = require('../utils/sendEmail');

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

        // Dùng .some() và .toString() để so sánh an toàn giữa String và ObjectId
        const isEnrolled = user.enrolledCourses.some(id => id.toString() === courseId);

        if (isEnrolled) {
            return res.status(400).json({ success: false, message: "Bạn đã đăng ký khóa học này rồi" });
        }

        // 3. Thêm courseId vào mảng enrolledCourses của User
        user.enrolledCourses.push(courseId);
        await user.save();

        // --- 4. TĂNG SỐ LƯỢNG HỌC VIÊN CỦA KHÓA HỌC (MỚI) ---
        // Dùng lệnh $inc của MongoDB để tăng số đếm lên 1 một cách nguyên tử (atomic)
        await Course.findByIdAndUpdate(courseId, {
            $inc: { totalStudents: 1 }
        });
        // ----------------------------------------------------

        res.status(200).json({
            success: true,
            message: "Đăng ký thành công",
            data: user.enrolledCourses
        });

    } catch (error) {
        console.error("Lỗi enrollCourse:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Lấy danh sách khóa học của tôi (Đã mua + Tự dạy + Kèm tiến độ)
// @route   GET /api/users/my-courses
const getMyCourses = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Lấy khóa học ĐÃ MUA (Enrolled)
        const user = await User.findById(userId).populate({
            path: 'enrolledCourses',
            select: 'title slug thumbnail instructor price sections',
            populate: [
                { path: 'instructor', select: 'name' },
                {
                    path: 'sections',
                    select: 'lessons',
                    populate: { path: 'lessons', select: '_id' } // Lấy ID để đếm bài học
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2. [THÊM MỚI] Lấy khóa học TỰ DẠY (Taught)
        // Cần populate giống hệt bên trên để logic tính tiến độ bên dưới hoạt động được
        const taughtCourses = await Course.find({ instructor: userId })
            .select('title slug thumbnail instructor price sections')
            .populate('instructor', 'name')
            .populate({
                path: 'sections',
                select: 'lessons',
                populate: { path: 'lessons', select: '_id' }
            });

        // 3. [THÊM MỚI] Gộp danh sách và Loại bỏ trùng lặp
        let allCourses = user.enrolledCourses || [];

        if (taughtCourses.length > 0) {
            const courseMap = new Map();

            // Ưu tiên khóa đã mua (để giữ nguyên thứ tự hoặc logic nếu cần)
            allCourses.forEach(c => courseMap.set(c._id.toString(), c));

            // Thêm khóa tự dạy (nếu chưa có trong list mua)
            taughtCourses.forEach(c => {
                if (!courseMap.has(c._id.toString())) {
                    courseMap.set(c._id.toString(), c);
                }
            });

            allCourses = Array.from(courseMap.values());
        }

        // 4. Tính toán tiến độ cho DANH SÁCH TỔNG HỢP (allCourses)
        const coursesWithProgress = await Promise.all(allCourses.map(async (course) => {
            if (!course) return null;

            // --- Logic tính tiến độ (GIỮ NGUYÊN TỪ CODE CỦA BẠN) ---

            // 4.1. Lấy danh sách TẤT CẢ ID bài học hợp lệ
            let validLessonIds = [];
            if (course.sections && Array.isArray(course.sections)) {
                course.sections.forEach(sec => {
                    if (sec.lessons && Array.isArray(sec.lessons)) {
                        sec.lessons.forEach(lesson => {
                            validLessonIds.push(lesson._id.toString());
                        });
                    }
                });
            }

            const totalLessons = validLessonIds.length;

            // 4.2. Lấy bảng tiến độ của user
            const progressDoc = await CourseProgress.findOne({
                user: userId,
                course: course._id
            });

            let completedCount = 0;
            if (progressDoc && progressDoc.completedLessons) {
                // Lọc chỉ đếm những bài thực sự tồn tại (Fix lỗi > 100%)
                const cleanCompletedLessons = progressDoc.completedLessons.filter(completedId =>
                    validLessonIds.includes(completedId.toString())
                );
                completedCount = cleanCompletedLessons.length;
            }

            // 4.3. Tính phần trăm
            let progressPercent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
            if (progressPercent > 100) progressPercent = 100;

            return {
                ...course.toObject(),
                progress: progressPercent
            };
        }));

        const validCourses = coursesWithProgress.filter(c => c !== null);

        res.json({
            success: true,
            data: validCourses
        });

    } catch (error) {
        console.error("Lỗi getMyCourses:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


// @desc    Lấy thông tin user (Profile) để hiển thị
// @route   GET /api/users/profile
const getUserProfile = async (req, res) => {
    try {
        // req.user._id có được nhờ middleware 'protect'
        const user = await User.findById(req.user._id).select('-password');

        if (user) {
            res.json({
                success: true,
                data: user
            });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};


// @desc    Cập nhật thông tin cá nhân (Tên, Avatar, Password)
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            // 1. Cập nhật thông tin text
            user.name = req.body.name || user.name;
            user.headline = req.body.headline || user.headline;
            user.bio = req.body.bio || user.bio;

            // Cập nhật Mạng xã hội (nếu có)
            user.website = req.body.website || user.website;
            user.twitter = req.body.twitter || user.twitter;
            user.linkedin = req.body.linkedin || user.linkedin;
            user.youtube = req.body.youtube || user.youtube;

            // 2. Cập nhật Avatar (Logic CŨ -> Đã được kiểm chứng là hoạt động)
            // Middleware upload.single('avatar') đã xử lý việc up lên Cloudinary trước khi vào hàm này
            if (req.file) {
                user.avatar = req.file.path; // Lưu link Cloudinary vào DB
            }
            // Nếu không upload ảnh mới, nhưng frontend gửi link ảnh cũ (dạng string)
            else if (req.body.avatar && typeof req.body.avatar === 'string' && req.body.avatar.trim() !== '') {
                // Logic này để phòng trường hợp user tự paste link ảnh
                user.avatar = req.body.avatar;
            }

            // (Đã xóa phần mật khẩu theo yêu cầu)

            const updatedUser = await user.save();

            res.json({
                success: true,
                message: "Cập nhật hồ sơ thành công",
                data: {
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    avatar: updatedUser.avatar,
                    headline: updatedUser.headline,
                    bio: updatedUser.bio
                }
            });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error("Lỗi cập nhật profile:", error);
        // Trả về lỗi 400 nếu Validation fail, thay vì 500
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};


// @desc    Lấy giỏ hàng của user
// @route   GET /api/users/cart
const getCart = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'cart',
            select: 'title slug price thumbnail instructor', // Lấy các trường cần thiết để hiển thị
            populate: { path: 'instructor', select: 'name' }
        });

        res.json({ success: true, data: user.cart });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Thêm vào giỏ hàng
// @route   POST /api/users/cart
const addToCart = async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);

        // 1. Kiểm tra đã mua chưa
        if (user.enrolledCourses.includes(courseId)) {
            return res.status(400).json({ success: false, message: "Bạn đã sở hữu khóa học này rồi" });
        }

        // 2. Thêm vào cart (dùng $addToSet để tránh trùng lặp)
        await User.findByIdAndUpdate(userId, {
            $addToSet: { cart: courseId }
        });

        res.json({ success: true, message: "Đã thêm vào giỏ hàng" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Xóa khỏi giỏ hàng
// @route   DELETE /api/users/cart/:courseId
const removeFromCart = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user._id;

        await User.findByIdAndUpdate(userId, {
            $pull: { cart: courseId }
        });

        res.json({ success: true, message: "Đã xóa khỏi giỏ hàng" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


// @desc    BƯỚC 1: Yêu cầu đổi mật khẩu (Gửi OTP qua email)
// @route   POST /api/users/request-change-password
const requestChangePassword = async (req, res) => {
    try {
        const { currentPassword } = req.body;

        // 1. Tìm user và lấy password hash
        const user = await User.findById(req.user._id).select('+password');

        // 2. Kiểm tra mật khẩu cũ
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không đúng" });
        }

        // 3. Tạo mã OTP 6 số ngẫu nhiên
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 4. Lưu OTP vào DB với hạn sử dụng 5 phút
        user.otpCode = otp;
        user.otpExpire = Date.now() + 5 * 60 * 1000;
        await user.save();

        // 5. Gửi email chứa mã OTP
        const message = `Mã OTP xác nhận đổi mật khẩu của bạn là: ${otp}. Mã này có hiệu lực trong 5 phút.`;
        const html = `
        <div style="font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background-color: #9333ea; padding: 20px; text-align: center;">
                    <h2 style="color: #ffffff; margin: 0;">Xác thực bảo mật 2FA</h2>
                </div>
                <div style="padding: 30px; text-align: center; color: #374151;">
                    <p style="font-size: 16px; margin-bottom: 20px;">Bạn đang thực hiện yêu cầu đổi mật khẩu. Vui lòng sử dụng mã OTP dưới đây để xác nhận:</p>
                    <div style="background-color: #f3e8ff; border: 2px dashed #9333ea; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #7e22ce;">${otp}</span>
                    </div>
                    <p style="font-size: 14px; color: #ef4444;">* Mã này sẽ hết hạn sau 5 phút.</p>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Nếu bạn không thực hiện yêu cầu này, vui lòng đổi mật khẩu tài khoản email ngay lập tức để bảo đảm an toàn.</p>
                </div>
            </div>
        </div>
        `;

        await sendEmail({
            email: user.email,
            subject: 'Mã OTP Xác Nhận Đổi Mật Khẩu - SmartLMS',
            message,
            html
        });

        res.json({ success: true, message: "Mã OTP đã được gửi đến email" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    BƯỚC 2: Xác nhận OTP và lưu mật khẩu mới
// @route   PUT /api/users/verify-change-password
const verifyChangePassword = async (req, res) => {
    try {
        const { otp, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        // 1. Kiểm tra mã OTP có khớp và còn hạn không
        if (!user.otpCode || user.otpCode !== otp) {
            return res.status(400).json({ success: false, message: "Mã OTP không đúng" });
        }

        if (user.otpExpire < Date.now()) {
            return res.status(400).json({ success: false, message: "Mã OTP đã hết hạn" });
        }

        // 2. Mã hóa và lưu mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // 3. Xóa dấu vết OTP sau khi dùng xong
        user.otpCode = undefined;
        user.otpExpire = undefined;
        await user.save();

        res.json({ success: true, message: "Đổi mật khẩu thành công" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};



module.exports = {
    enrollCourse, getMyCourses, updateUserProfile, getCart,
    addToCart, removeFromCart, getUserProfile,
    requestChangePassword, verifyChangePassword // <--- Thêm vào đây
};
