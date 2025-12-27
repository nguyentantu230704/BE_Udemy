const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

const validateCreatePayment = require('../middleware/validateCreatePayment');

router.post('/create', validateCreatePayment, paymentController.createPayment);
router.get('/api/payment/callback/:method', paymentController.paymentCallback);

module.exports = router;
