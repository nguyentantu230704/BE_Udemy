const PayoutRequest = require('../models/PayoutRequest');
// Lưu ý: Cần import logic tính doanh thu ở đây để kiểm tra số dư khả dụng (Ở mức độ cơ bản mình sẽ bỏ qua check số dư thực tế, cho phép tạo request trước)

// @desc    Gửi yêu cầu rút tiền
// @route   POST /api/payouts
const createPayoutRequest = async (req, res) => {
    try {
        const { amount, paymentInfo } = req.body;

        // Validate cơ bản
        if (amount < 500000) { // Ví dụ tối thiểu 500k
            return res.status(400).json({ success: false, message: "Số tiền rút tối thiểu là 500.000đ" });
        }

        // Kiểm tra xem có yêu cầu nào đang pending không (tránh spam)
        const pendingRequest = await PayoutRequest.findOne({
            instructor: req.user._id,
            status: 'pending'
        });

        if (pendingRequest) {
            return res.status(400).json({ success: false, message: "Bạn đang có yêu cầu chờ xử lý, vui lòng đợi." });
        }

        const request = await PayoutRequest.create({
            instructor: req.user._id,
            amount,
            paymentInfo
        });

        res.status(201).json({ success: true, data: request, message: "Đã gửi yêu cầu rút tiền" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

// @desc    Lấy lịch sử rút tiền
// @route   GET /api/payouts
const getPayoutHistory = async (req, res) => {
    try {
        const history = await PayoutRequest.find({ instructor: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

module.exports = { createPayoutRequest, getPayoutHistory };