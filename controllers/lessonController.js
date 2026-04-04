const Lesson = require('../models/Lesson');
const Section = require('../models/Section');

const { GoogleGenerativeAI } = require('@google/generative-ai');

const { cloudinary } = require('../config/cloudinary');

// @desc    Tạo bài học mới (Hỗ trợ Video, Text, Quiz)
// @route   POST /api/lessons
// @access  Private (Instructor)
const createLesson = async (req, res) => {
    try {
        const { title, sectionId, type, content, quizQuestions, isPreview, passPercent } = req.body;

        if (!title || !sectionId) {
            return res.status(400).json({ success: false, message: "Tiêu đề và Chương học là bắt buộc" });
        }

        const lessonData = {
            title,
            section: sectionId,
            type: type || 'video',
            isPreview: isPreview === 'true',
            passPercent: passPercent ? Number(passPercent) : 80
        };

        // Xử lý theo loại
        if (type === 'video') {
            if (req.file) {

                // 🛡️ BẢO MẬT VIDEO (HLS TỰ ĐỘNG BẰNG CLOUDINARY)
                // Ép Cloudinary biến file .mp4 thành hàng trăm file nhỏ .ts 
                // và tạo ra 1 file danh sách phát .m3u8 để chặn IDM/Cốc Cốc tải trộm
                const secureHlsUrl = cloudinary.url(req.file.filename, {
                    resource_type: 'video',
                    format: 'm3u8',             // Đuôi HLS
                    streaming_profile: 'auto'   // Tự tối ưu chất lượng theo mạng (Adaptive Bitrate)
                });

                lessonData.video = {
                    url: secureHlsUrl,          // 💡 Lưu link HLS vào DB thay vì link .mp4 gốc
                    public_id: req.file.filename,
                    duration: req.body.duration || 0
                };
            }
        } else if (type === 'document') {
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
        // Sử dụng model gemini-2.5-flash vì nó cực kỳ nhanh và phù hợp cho text/json
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

// @desc    Đọc và tóm tắt file PDF bằng Gemini AI
// @route   POST /api/lessons/summarize-pdf
// @access  Private
const summarizePDF = async (req, res) => {
    try {
        const { pdfUrl } = req.body;

        if (!pdfUrl) {
            return res.status(400).json({ success: false, message: "Không tìm thấy đường dẫn PDF" });
        }

        // 1. Tải file PDF từ URL (Cloudinary/Drive) về dưới dạng ArrayBuffer
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error("Không thể tải file PDF từ URL");

        const arrayBuffer = await response.arrayBuffer();

        // 2. Chuyển đổi sang Base64 để gửi cho Gemini
        const base64Data = Buffer.from(arrayBuffer).toString('base64');

        // 3. Khởi tạo Gemini AI (Dùng 2.5-flash vì chúng hỗ trợ đọc File rất tốt)
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 4. Prompt yêu cầu tóm tắt
        const prompt = `
        Đóng vai một gia sư tận tâm. Hãy đọc tài liệu PDF đính kèm này và tóm tắt những ý chính quan trọng nhất bằng tiếng Việt.
        Yêu cầu:
        - Trình bày rõ ràng, chia thành các gạch đầu dòng dễ hiểu.
        - Giọng văn bám sát nội dung học thuật, súc tích.
        - Bôi đậm (dùng dấu **) các từ khóa quan trọng.
        `;

        // 5. Gửi Prompt kèm dữ liệu File PDF nội tuyến (inlineData)
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "application/pdf"
                }
            }
        ]);

        const summaryText = await result.response.text();

        res.status(200).json({
            success: true,
            summary: summaryText
        });

    } catch (error) {
        console.error("Lỗi tóm tắt PDF bằng AI:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi gọi AI phân tích PDF. Đảm bảo file không quá lớn.",
            error: error.message
        });
    }
};

// Cập nhật dòng module.exports ở cuối file:
module.exports = { createLesson, deleteLesson, generateQuizByAI, debugGeminiModels, summarizePDF };