const express = require('express');
const router = express.Router();
const { registerUser, loginUser, forgotPassword, resetPassword, verifyEmail } = require('../controllers/authController');

// Định nghĩa 2 đường dẫn
router.post('/register', registerUser);
router.post('/login', loginUser);

// --- ROUTES MỚI ---
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.put('/verifyemail/:token', verifyEmail);


module.exports = router;