const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    // 1. Mã định danh duy nhất (VD: UC-A1B2C3D4) - Dùng để tra cứu
    certificateId: {
        type: String,
        required: true,
        unique: true,
        index: true, // Đánh index để tra cứu cực nhanh
        uppercase: true
    },

    // 2. Mối quan hệ gốc (Để dễ dàng query sau này)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },

    // 3. 💡 DỮ LIỆU SNAPSHOT (Đóng băng tại thời điểm cấp phát)
    // Dù sau này khóa học đổi tên hay học viên đổi tên, chứng chỉ vẫn giữ nguyên
    studentName: { type: String, required: true },
    courseTitle: { type: String, required: true },
    instructorName: { type: String, required: true },

    // 4. Thời gian và Trạng thái
    issueDate: { type: Date, default: Date.now },

    // Khả năng thu hồi chứng chỉ (Nếu phát hiện học viên gian lận sau khi đã cấp)
    isValid: { type: Boolean, default: true },

    // 5. Nơi lưu trữ tài sản (File PDF và Mã QR tải lên Cloudinary)
    pdfUrl: { type: String }, // Link file chứng chỉ đã in sẵn tên và mã QR
    qrCodeUrl: { type: String } // Link ảnh mã QR độc lập (nếu cần dùng chỗ khác)

}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);