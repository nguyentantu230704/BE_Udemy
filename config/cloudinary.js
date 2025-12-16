const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Cấu hình Cloudinary với các key từ file .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Cấu hình kho lưu trữ (Storage)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'udemy-clone', // Tên folder trên Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'mp4', 'mkv'], // Cho phép ảnh và video
        resource_type: 'auto', // Tự động nhận diện (ảnh hay video)
    },
});

// 3. Khởi tạo middleware upload
// Đoạn code trên tạo ra một biến upload. Sau này, ở bất cứ Route nào cần upload file (ví dụ: tạo khóa học), ta chỉ cần "gài" biến upload này vào là xong.
const upload = multer({ storage: storage });

module.exports = upload;