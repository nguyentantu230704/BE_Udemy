const express = require('express');
const router = express.Router();

const {
  createPayment,
  paymentCallback,
} = require('../controllers/paymentController');
const validateCreatePayment = require('../middleware/validateCreatePayment');

router.post('/create', validateCreatePayment, createPayment);

// Callback từ gateway (VNPay / PayPal)
// router.get('/callback/:method', paymentCallback);
router.get('/vnpay_return', paymentCallback);

module.exports = router;
