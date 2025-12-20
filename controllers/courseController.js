const Course = require('../models/Course');
const slugify = require('slugify'); // Thư viện tạo URL thân thiện

// @desc    Tạo khóa học mới
// @route   POST /api/courses/create
// @access  Private (Chỉ giảng viên/admin)
const createCourse = async (req, res) => {
    try {
        // 1. Lấy dữ liệu từ Client gửi lên
        // Lưu ý: 'category' gửi lên phải là ID của danh mục (ObjectId)
        const { title, description, price, category } = req.body;

        // Validation cơ bản
        if (!title || !description || !category) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ tên, mô tả và danh mục"
            });
        }

        // 2. Xử lý Slug (URL thân thiện)
        // Ví dụ: "Lập trình Node.js" -> "lap-trinh-nodejs"
        const slug = slugify(title, {
            lower: true,      // Chuyển thành chữ thường
            locale: 'vi',     // Hỗ trợ tiếng Việt
            strict: true      // Loại bỏ ký tự đặc biệt
        });

        // Kiểm tra xem slug đã tồn tại chưa (tránh trùng tên khóa học)
        const courseExists = await Course.findOne({ slug });
        if (courseExists) {
            return res.status(400).json({
                success: false,
                message: "Tên khóa học đã tồn tại, vui lòng chọn tên khác"
            });
        }

        // 3. Xử lý Thumbnail (Ảnh bìa)
        // Cấu trúc mới: Lưu cả URL và Public_ID để sau này xóa ảnh được
        let thumbnailObj = {
            url: "https://via.placeholder.com/150", // Ảnh mặc định nếu không upload
            public_id: null
        };

        if (req.file) {
            thumbnailObj = {
                url: req.file.path,        // Link ảnh trên Cloudinary
                public_id: req.file.filename // ID dùng để xóa ảnh sau này
            };
        }

        // 4. Tạo Object khóa học mới
        const newCourse = new Course({
            title,
            slug,
            description,
            price,
            category, // Client phải gửi ID của Category
            thumbnail: thumbnailObj, // Lưu dạng Object
            instructor: req.user._id, // Lấy ID giảng viên từ token
        });

        // 5. Lưu vào Database
        const savedCourse = await newCourse.save();

        // 6. Trả kết quả thành công
        res.status(201).json({
            success: true,
            data: savedCourse
        });

    } catch (error) {
        console.error("Error creating course:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi tạo khóa học",
            error: error.message
        });
    }
};

// @desc    Lấy chi tiết khóa học theo Slug (URL)
// @route   GET /api/courses/:slug
// @access  Public (Ai cũng xem được)
const getCourseBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        // Tìm khóa học theo slug
        const course = await Course.findOne({ slug })
            // 1. Lấy thông tin Giảng viên (chỉ lấy tên và avatar, không lấy password)
            .populate('instructor', 'name avatar')
            // 2. Lấy thông tin Danh mục
            .populate('category', 'name slug')
            // 3. QUAN TRỌNG: Lấy Sections và lồng bên trong là Lessons
            .populate({
                path: 'sections',
                populate: {
                    path: 'lessons',
                    select: 'title slug video.duration isPreview' // Chỉ lấy thông tin cần thiết
                }
            });

        if (!course) {
            return res.status(404).json({ success: false, message: "Không tìm thấy khóa học" });
        }

        res.json({
            success: true,
            data: course
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


// @desc    Lấy danh sách khóa học
// @route   GET /api/courses
const getAllCourses = async (req, res) => {
    try {
        // 1. Thêm tham số isPublished vào query
        const { keyword, category, isPublished } = req.query;

        let query = {}; // KHÔNG ĐỂ mặc định { isPublished: true } nữa

        // 2. Logic tìm kiếm (giữ nguyên)
        if (keyword) {
            query.title = { $regex: keyword, $options: 'i' };
        }

        if (category) {
            query.category = category;
        }

        // 3. Logic lọc Public/Draft (Mới)
        // Nếu client gửi lên ?isPublished=true thì mới lọc
        if (isPublished) {
            query.isPublished = isPublished === 'true';
        }

        const courses = await Course.find(query)
            .populate('instructor', 'name avatar')
            .populate('category', 'name')
            .select('-sections')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: courses.length,
            data: courses
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

module.exports = { createCourse, getCourseBySlug, getAllCourses };