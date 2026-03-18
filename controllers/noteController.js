const Note = require('../models/Note');

// @desc    Tạo ghi chú mới tại một mốc thời gian
// @route   POST /api/notes
// @access  Private
const createNote = async (req, res) => {
    try {
        const { lessonId, time, content } = req.body;

        if (!lessonId || time === undefined || !content) {
            return res.status(400).json({ success: false, message: "Thiếu thông tin ghi chú" });
        }

        const newNote = await Note.create({
            user: req.user._id, // Lấy từ middleware protect
            lesson: lessonId,
            time: time,
            content: content
        });

        res.status(201).json({ success: true, data: newNote });
    } catch (error) {
        console.error("Lỗi tạo ghi chú:", error);
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

// @desc    Lấy tất cả ghi chú của 1 user trong 1 bài học
// @route   GET /api/notes/:lessonId
// @access  Private
const getNotesByLesson = async (req, res) => {
    try {
        // Tìm note của đúng user đó, trong bài học đó, sắp xếp theo thời gian (time: 1 là tăng dần)
        const notes = await Note.find({
            user: req.user._id,
            lesson: req.params.lessonId
        }).sort({ time: 1 });

        res.status(200).json({ success: true, data: notes });
    } catch (error) {
        console.error("Lỗi lấy ghi chú:", error);
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

// @desc    Sửa nội dung ghi chú
// @route   PUT /api/notes/:id
// @access  Private
const updateNote = async (req, res) => {
    try {
        const { content } = req.body;
        let note = await Note.findById(req.params.id);

        if (!note) {
            return res.status(404).json({ success: false, message: "Không tìm thấy ghi chú" });
        }

        // BẢO MẬT: Kiểm tra xem user đăng nhập có phải là chủ của ghi chú này không
        if (note.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Bạn không có quyền sửa ghi chú này" });
        }

        note.content = content;
        await note.save();

        res.status(200).json({ success: true, data: note });
    } catch (error) {
        console.error("Lỗi cập nhật ghi chú:", error);
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

// @desc    Xóa ghi chú
// @route   DELETE /api/notes/:id
// @access  Private
const deleteNote = async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);

        if (!note) {
            return res.status(404).json({ success: false, message: "Không tìm thấy ghi chú" });
        }

        // BẢO MẬT: Kiểm tra quyền sở hữu
        if (note.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Bạn không có quyền xóa ghi chú này" });
        }

        await Note.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: "Đã xóa ghi chú thành công" });
    } catch (error) {
        console.error("Lỗi xóa ghi chú:", error);
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

module.exports = { createNote, getNotesByLesson, updateNote, deleteNote };