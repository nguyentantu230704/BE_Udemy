const Course = require('../models/Course');
const slugify = require('slugify'); // Thư viện tạo URL thân thiện
const Section = require('../models/Section');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');

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
                    select: 'title slug video isPreview duration type content quizQuestions order'
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


// @desc    Lấy danh sách khóa học (Hỗ trợ lọc Public/Draft, Tìm kiếm, Danh mục)
// @route   GET /api/courses
const getAllCourses = async (req, res) => {
    try {
        // 1. Lấy tham số từ Query String
        const { keyword, category, isPublished } = req.query;

        // Khởi tạo query rỗng (Lấy tất cả nếu không có lọc)
        let query = {};

        // 2. Logic tìm kiếm theo tên (Keyword)
        if (keyword) {
            query.title = { $regex: keyword, $options: 'i' };
        }

        // 3. Logic lọc theo Danh mục
        if (category) {
            query.category = category;
        }

        // 4. Logic lọc Public/Draft (QUAN TRỌNG)
        // Chỉ khi client gửi tham số isPublished lên thì mới lọc
        if (isPublished !== undefined) {
            query.isPublished = isPublished === 'true';
        }

        const courses = await Course.find(query)
            .populate('instructor', 'name avatar') // Lấy thông tin giảng viên
            .populate('category', 'name slug')     // Lấy thông tin danh mục
            .select('-sections')                   // Bỏ qua sections cho nhẹ
            .sort({ createdAt: -1 });              // Mới nhất lên đầu

        res.json({
            success: true,
            count: courses.length,
            data: courses
        });

    } catch (error) {
        console.error("Lỗi getAllCourses:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


// @desc    Bật/Tắt trạng thái xuất bản của khóa học
// @route   PUT /api/courses/:id/publish
// @access  Private (Instructor/Admin)
const togglePublishStatus = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ success: false, message: "Không tìm thấy khóa học" });
        }

        // Kiểm tra quyền sở hữu (Giảng viên chỉ được sửa khóa của mình)
        if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Bạn không có quyền sửa khóa học này" });
        }

        // Đảo ngược trạng thái hiện tại
        course.isPublished = !course.isPublished;
        await course.save();

        res.json({
            success: true,
            message: course.isPublished ? "Đã xuất bản khóa học" : "Đã chuyển về bản nháp",
            data: course
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
}

// @desc    Cập nhật thông tin khóa học (Tên, giá, ảnh bìa...)
// @route   PUT /api/courses/:id
// @access  Private (Instructor/Admin)
const updateCourse = async (req, res) => {
    try {
        let course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ success: false, message: "Không tìm thấy khóa học" });
        }

        // Kiểm tra quyền sở hữu
        if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Bạn không có quyền sửa khóa học này" });
        }

        // Cập nhật các trường thông tin cơ bản (nếu có gửi lên)
        const { title, description, price, category } = req.body;
        if (title) course.title = title;
        if (description) course.description = description;
        if (price) course.price = price;
        if (category) course.category = category;

        // Xử lý ảnh bìa mới (nếu có upload)
        if (req.file) {
            // (Nâng cao: Nên xóa ảnh cũ trên Cloudinary trước khi lưu ảnh mới để tiết kiệm dung lượng)
            // Ở đây làm đơn giản là ghi đè link ảnh mới.
            course.thumbnail = {
                url: req.file.path,
                public_id: req.file.filename
            };
        }

        await course.save();

        // Populate lại dữ liệu cần thiết để trả về frontend
        const updatedCourse = await Course.findById(course._id)
            .populate('instructor', 'name')
            .populate('category', 'name');

        res.json({
            success: true,
            message: "Cập nhật khóa học thành công",
            data: updatedCourse
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
}

// @desc    Xóa khóa học (DB + Cloudinary: Ảnh bìa & Video)
// @route   DELETE /api/courses/:id
const deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ success: false, message: "Không tìm thấy khóa học" });
        }

        // Check quyền chủ sở hữu
        if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Không có quyền xóa khóa học này" });
        }

        // --- 1. XÓA ẢNH BÌA KHÓA HỌC TRÊN CLOUDINARY ---
        if (course.thumbnail && course.thumbnail.public_id) {
            try {
                await cloudinary.uploader.destroy(course.thumbnail.public_id);
            } catch (err) {
                console.error("Lỗi xóa ảnh bìa:", err);
                // Không return lỗi ở đây để code chạy tiếp tục xóa DB
            }
        }

        // --- 2. TÌM VÀ XÓA VIDEO BÀI HỌC ---

        // Tìm tất cả các Chương (Section)
        const sections = await Section.find({ course: course._id });
        const sectionIds = sections.map(sec => sec._id);

        if (sectionIds.length > 0) {
            // Tìm tất cả bài học (Lesson) để lấy public_id của video TRƯỚC KHI xóa
            const lessons = await Lesson.find({ section: { $in: sectionIds } });

            // Lặp qua từng bài học để xóa video trên Cloudinary
            // Dùng Promise.all để xóa song song cho nhanh
            const deleteVideoPromises = lessons.map(async (lesson) => {
                if (lesson.video && lesson.video.public_id) {
                    return cloudinary.uploader.destroy(lesson.video.public_id, {
                        resource_type: 'video' // <--- BẮT BUỘC PHẢI CÓ DÒNG NÀY CHO VIDEO
                    });
                }
            });

            try {
                await Promise.all(deleteVideoPromises);
            } catch (err) {
                console.error("Lỗi xóa video trên Cloud:", err);
            }

            // --- 3. XÓA DỮ LIỆU TRONG DB ---
            // Xóa Lessons
            await Lesson.deleteMany({ section: { $in: sectionIds } });
            // Xóa Sections
            await Section.deleteMany({ _id: { $in: sectionIds } });
        }

        // --- 3. [MỚI] XÓA ID KHÓA HỌC KHỎI DANH SÁCH MUA CỦA TẤT CẢ USER ---
        // Tìm tất cả user nào có chứa courseId này trong mảng enrolledCourses
        // Và dùng $pull để rút nó ra
        await User.updateMany(
            { enrolledCourses: courseId },
            { $pull: { enrolledCourses: courseId } }
        );

        // --- 4. CUỐI CÙNG: XÓA KHÓA HỌC ---
        await Course.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: "Đã xóa khóa học và toàn bộ dữ liệu liên quan (DB & Cloud)" });

    } catch (error) {
        console.error("Lỗi xóa khóa học:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};


module.exports = { createCourse, getCourseBySlug, getAllCourses, togglePublishStatus, updateCourse, deleteCourse };