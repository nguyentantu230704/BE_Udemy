const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 1. Cấu hình Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Cấu hình kho lưu trữ
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'udemy-clone',
        allowed_formats: ['jpg', 'png', 'jpeg', 'mp4', 'mkv'],
        resource_type: 'auto',
    },
});

const upload = multer({ storage: storage });

// --- SỬA DÒNG NÀY ---
// Xuất ra cả 2 biến dưới dạng Object
module.exports = { upload, cloudinary };