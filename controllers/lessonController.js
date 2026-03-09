const Lesson = require('../models/Lesson');
const Section = require('../models/Section');

const { GoogleGenerativeAI } = require('@google/generative-ai');


// @desc    Tạo bài học mới (Hỗ trợ Video, Text, Quiz)
// @route   POST /api/lessons
// @access  Private (Instructor)
const createLesson = async (req, res) => {
    try {
        // Lấy dữ liệu từ req.body (Do dùng multer nên data text cũng nằm trong body)
        const { title, sectionId, type, content, quizQuestions, isPreview, passPercent } = req.body;

        if (!title || !sectionId) {
            return res.status(400).json({ success: false, message: "Tiêu đề và Chương học là bắt buộc" });
        }

        const lessonData = {
            title,
            section: sectionId,
            type: type || 'video', // Nhận type từ form
            isPreview: isPreview === 'true',
            passPercent: passPercent ? Number(passPercent) : 80
        };

        // Xử lý theo loại
        if (type === 'video') {
            if (req.file) {
                lessonData.video = {
                    url: req.file.path,
                    public_id: req.file.filename,
                    duration: req.body.duration || 0
                };
            }
        } else if (type === 'document') {
            // THÊM ĐOẠN NÀY CHO PDF
            if (req.file) {
                lessonData.document = {
                    url: req.file.path,
                    public_id: req.file.filename
                };
            }
        } else if (type === 'text') {
            lessonData.content = content;
        } else if (type === 'quiz') {
            if (quizQuestions) {
                lessonData.quizQuestions = JSON.parse(quizQuestions);
            }
        }

        const lesson = await Lesson.create(lessonData);

        // Cập nhật Section
        await Section.findByIdAndUpdate(sectionId, {
            $push: { lessons: lesson._id }
        });

        res.status(201).json({ success: true, data: lesson });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Xóa bài học (MỚI)
// @route   DELETE /api/lessons/:id
const deleteLesson = async (req, res) => {
    try {
        const lesson = await Lesson.findById(req.params.id);
        if (!lesson) {
            return res.status(404).json({ success: false, message: "Không tìm thấy bài học" });
        }

        // 1. Nếu là video, xóa trên Cloudinary
        if (lesson.type === 'video' && lesson.video && lesson.video.public_id) {
            try {
                // Cloudinary resource_type: 'video' là bắt buộc khi xóa video
                await cloudinary.uploader.destroy(lesson.video.public_id, { resource_type: 'video' });
            } catch (err) {
                console.log("Lỗi xóa video trên Cloudinary:", err);
            }
        }
        else if (lesson.type === 'document' && lesson.document && lesson.document.public_id) {
            try {
                // Cloudinary mặc định lưu PDF dưới dạng 'image' hoặc 'raw' khi để auto. 
                // Không truyền resource_type thì nó sẽ tự hiểu là image (đúng với PDF)
                await cloudinary.uploader.destroy(lesson.document.public_id);
            } catch (err) {
                console.log("Lỗi xóa PDF trên Cloudinary:", err);
            }
        }


        // 2. Xóa ID bài học khỏi mảng lessons trong Section
        await Section.findByIdAndUpdate(lesson.section, {
            $pull: { lessons: lesson._id }
        });

        // 3. Xóa bài học trong DB
        await Lesson.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: "Đã xóa bài học" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Lỗi xóa bài học" });
    }
};


// ==========================================
// MỚI: TẠO QUIZ TỰ ĐỘNG BẰNG AI (GEMINI)
// ==========================================
// @desc    Gửi nội dung cho AI và nhận về mảng câu hỏi trắc nghiệm JSON
// @route   POST /api/lessons/generate-quiz
// @access  Private (Instructor)
const generateQuizByAI = async (req, res) => {
    try {
        const { prompt, numQuestions = 3 } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, message: "Vui lòng cung cấp nội dung để AI tạo câu hỏi" });
        }

        // Khởi tạo Gemini API
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Sử dụng model gemini-1.5-flash vì nó cực kỳ nhanh và phù hợp cho text/json
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        // Câu lệnh (Prompt) ép AI trả về chuẩn JSON format của Model Lesson
        const aiPrompt = `
        Đóng vai một chuyên gia giáo dục. Dựa vào nội dung bài giảng dưới đây, hãy tạo ra ${numQuestions} câu hỏi trắc nghiệm.
        
        NỘI DUNG BÀI GIẢNG:
        "${prompt}"

        YÊU CẦU ĐỊNH DẠNG BẮT BUỘC:
        Chỉ trả về ĐÚNG MỘT MẢNG JSON, không có markdown (không dùng \`\`\`json), không có text dư thừa, cấu trúc phải chính xác 100% như sau:
        [
          {
            "question": "Nội dung câu hỏi 1?",
            "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
            "correctAnswer": 0 
          }
        ]
        Lưu ý: "correctAnswer" là số nguyên từ 0 đến 3, tương ứng với vị trí (index) của đáp án đúng trong mảng "options". Các câu hỏi phải xoay quanh nội dung bài giảng.
        `;

        // Gọi AI
        const result = await model.generateContent(aiPrompt);
        const response = await result.response;
        let text = response.text();

        // Xử lý chuỗi (Đề phòng AI vẫn bọc markdown ```json ... ``` vào kết quả)
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Chuyển chuỗi thành Object JavaScript
        const quizData = JSON.parse(text);

        res.status(200).json({
            success: true,
            message: "Tạo câu hỏi thành công",
            data: quizData
        });

    } catch (error) {
        console.error("Lỗi tạo Quiz bằng AI:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi gọi AI. Có thể do nội dung quá phức tạp hoặc lỗi parse JSON.",
            error: error.message
        });
    }
};


// ==========================================
// HÀM DEBUG: KIỂM TRA API KEY VÀ DANH SÁCH MODEL
// ==========================================
const debugGeminiModels = async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        // 1. Kiểm tra xem server đã đọc được file .env chưa
        if (!apiKey) {
            return res.status(400).json({
                success: false,
                message: "Server chưa đọc được GEMINI_API_KEY. Bạn đã khởi động lại server sau khi lưu file .env chưa?"
            });
        }

        // 2. Gọi API trực tiếp của Google để lấy danh sách Model
        // (Dùng fetch mặc định của Node.js 18+)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            return res.status(400).json({
                success: false,
                message: "API Key bị lỗi hoặc Google từ chối truy cập",
                error: data.error
            });
        }

        // 3. Lọc ra danh sách tên các model hỗ trợ generateContent
        const availableModels = data.models
            .filter(m => m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace('models/', '')); // Cắt chữ 'models/' đi cho dễ nhìn

        res.json({
            success: true,
            message: "Đây là danh sách các Model mà API Key của bạn được phép dùng:",
            models: availableModels,
            yourApiKey: apiKey.substring(0, 10) + "..." // In ra 10 ký tự đầu để đối chiếu
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { createLesson, deleteLesson, generateQuizByAI, debugGeminiModels };