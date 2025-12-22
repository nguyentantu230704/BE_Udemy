const { cloudinary } = require('../config/cloudinary');
const User = require('../models/User');
const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const bcrypt = require('bcryptjs');

// Hàm hỗ trợ lấy public_id từ URL Cloudinary
const getPublicIdFromUrl = (url) => {
    try {
        // URL mẫu: https://res.cloudinary.com/.../upload/v123456/udemy-clone/abc.jpg

        // 1. Tách chuỗi dựa trên dấu '/'
        const splitUrl = url.split('/');

        // 2. Lấy phần cuối cùng (tên file + đuôi): "abc.jpg"
        const filenameWithExt = splitUrl[splitUrl.length - 1];

        // 3. Lấy tên folder (phần tử kế cuối): "udemy-clone"
        const folder = splitUrl[splitUrl.length - 2];

        // 4. Bỏ đuôi file (.jpg, .png)
        const filename = filenameWithExt.split('.')[0];

        // 5. Ghép lại thành public_id chuẩn: "udemy-clone/abc"
        return `${folder}/${filename}`;
    } catch (error) {
        return null;
    }
};

// @desc    Lấy số liệu thống kê (Dashboard)
// @route   GET /api/admin/stats
const getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalCourses = await Course.countDocuments();
        // Tính tổng doanh thu (giả sử trường price trong Course)
        // Lưu ý: Logic này chỉ tính tổng giá khóa học, thực tế cần tính dựa trên Order/Payment
        const courses = await Course.find({ isPublished: true }).select('price');
        const totalRevenue = courses.reduce((acc, curr) => acc + (curr.price || 0), 0);

        res.json({
            success: true,
            data: {
                totalUsers,
                totalCourses,
                totalRevenue
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Lấy danh sách tất cả Users
// @route   GET /api/admin/users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            // Populate thêm khóa học đã mua để hiển thị ở Admin
            .populate('enrolledCourses', 'title thumbnail slug price')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Xóa User và Avatar trên Cloudinary
// @route   DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
    try {
        // 1. Tìm User trước (để lấy link avatar)
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User không tồn tại" });
        }

        // 2. Xóa Avatar trên Cloudinary (Nếu có)
        // Lưu ý: Chỉ xóa nếu đó là ảnh trên Cloudinary (có chứa 'res.cloudinary.com')
        // Để tránh xóa nhầm ảnh Google hoặc ảnh mặc định
        if (user.avatar && user.avatar.includes('cloudinary')) {
            const publicId = getPublicIdFromUrl(user.avatar);
            if (publicId) {
                try {
                    await cloudinary.uploader.destroy(publicId);
                } catch (err) {
                    console.error("Lỗi xóa avatar trên Cloudinary:", err.message);
                    // Không return lỗi, vẫn tiếp tục xóa user trong DB
                }
            }
        }

        // 3. Xóa User trong Database
        await User.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: "Đã xóa người dùng và ảnh đại diện" });

    } catch (error) {
        console.error("Lỗi deleteUser:", error);
        res.status(500).json({ success: false, message: "Lỗi xóa user" });
    }
};

// @desc    Tạo User mới (Admin tạo)
// @route   POST /api/admin/users
const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // 1. Validate
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đủ thông tin" });
        }

        // 2. Check trùng email
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: "Email này đã tồn tại" });
        }

        // 3. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Tạo User
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'student' // Mặc định là student nếu không chọn
        });

        res.status(201).json({ success: true, data: user, message: "Tạo người dùng thành công" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Cập nhật User (Đổi Role, Tên...)
// @route   PUT /api/admin/users/:id
const updateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            // Cập nhật Role (Cấp quyền)
            if (req.body.role) {
                user.role = req.body.role;
            }

            // Nếu muốn đổi pass cho user luôn thì thêm logic hash password ở đây (tùy chọn)

            const updatedUser = await user.save();

            res.json({ success: true, data: updatedUser, message: "Cập nhật thành công" });
        } else {
            res.status(404).json({ success: false, message: "Không tìm thấy User" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


// @desc    Quét và xóa các ID khóa học không tồn tại trong User
// @route   POST /api/admin/cleanup
const cleanupEnrollments = async (req, res) => {
    try {
        // 1. Lấy tất cả users
        const users = await User.find({});

        let updatedCount = 0;

        // 2. Duyệt qua từng user
        for (const user of users) {
            if (user.enrolledCourses && user.enrolledCourses.length > 0) {
                // Lọc lại mảng: Chỉ giữ lại những ID nào mà Khóa học đó còn tồn tại trong DB
                // Cách này hơi chậm nếu data lớn, nhưng chạy 1 lần thì OK.

                const validCourses = [];
                for (const courseId of user.enrolledCourses) {
                    const exists = await Course.exists({ _id: courseId });
                    if (exists) {
                        validCourses.push(courseId);
                    }
                }

                // Nếu số lượng thay đổi (tức là có rác), thì update lại DB
                if (validCourses.length !== user.enrolledCourses.length) {
                    user.enrolledCourses = validCourses;
                    await user.save();
                    updatedCount++;
                }
            }
        }

        res.json({
            success: true,
            message: `Đã dọn dẹp xong. Cập nhật lại ${updatedCount} người dùng có dữ liệu rác.`
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi dọn dẹp" });
    }
};


// @desc    Gỡ khóa học khỏi User (MỚI)
// @route   DELETE /api/admin/users/:userId/courses/:courseId
const removeUserCourse = async (req, res) => {
    try {
        const { userId, courseId } = req.params;

        // 1. Xóa courseId khỏi mảng enrolledCourses của User
        await User.findByIdAndUpdate(userId, {
            $pull: { enrolledCourses: courseId }
        });

        // 2. Xóa tiến độ học tập
        await CourseProgress.findOneAndDelete({
            user: userId,
            course: courseId
        });

        // --- 3. LOGIC MỚI: ĐẾM LẠI SỐ HỌC VIÊN THỰC TẾ ---
        // Thay vì trừ 1, ta đếm xem hiện tại có bao nhiêu user đang giữ courseId này
        const actualStudentCount = await User.countDocuments({
            enrolledCourses: courseId
        });

        // Cập nhật con số chính xác vào Course
        await Course.findByIdAndUpdate(courseId, {
            totalStudents: actualStudentCount
        });
        // -------------------------------------------------

        res.json({ success: true, message: "Đã gỡ khóa học và cập nhật lại sĩ số" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


module.exports = { getAdminStats, getAllUsers, deleteUser, createUser, updateUser, cleanupEnrollments, removeUserCourse };