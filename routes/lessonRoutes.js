const express = require('express');
const router = express.Router();
const { createLesson, deleteLesson, generateQuizByAI, debugGeminiModels, summarizePDF } = require('../controllers/lessonController');
const { upload } = require('../config/cloudinary'); // Dùng lại bộ upload cũ
const { protect, authorize } = require('../middleware/authMiddleware');


// --- ROUTE DEBUG LÊN TRÊN CÙNG ---
router.get('/debug-ai', debugGeminiModels);

// Route: POST /api/lessons/generate-quiz
router.post('/generate-quiz', protect, authorize('instructor', 'admin'), generateQuizByAI);
router.post('/summarize-pdf', protect, summarizePDF);

// Route upload video: Field name là 'video'
// Lưu ý: Upload video lâu hơn ảnh, đừng tắt Postman vội khi đang quay
router.post('/', protect, authorize('instructor', 'admin'), upload.single('file'), createLesson);
router.delete('/:id', deleteLesson);

module.exports = router;