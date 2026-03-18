const express = require('express');
const router = express.Router();
const { createNote, getNotesByLesson, updateNote, deleteNote } = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/notes - Tạo ghi chú mới
router.post('/', protect, createNote);

// GET /api/notes/:lessonId - Lấy ghi chú của 1 bài học
router.get('/:lessonId', protect, getNotesByLesson);

// PUT /api/notes/:id - Sửa ghi chú
router.put('/:id', protect, updateNote);

// DELETE /api/notes/:id - Xóa ghi chú
router.delete('/:id', protect, deleteNote);

module.exports = router;