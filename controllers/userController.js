const User = require('../models/User');
const Course = require('../models/Course');
const bcrypt = require('bcryptjs');
const CourseProgress = require('../models/CourseProgress');


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




module.exports = { enrollCourse, getMyCourses, updateUserProfile, getCart, addToCart, removeFromCart };