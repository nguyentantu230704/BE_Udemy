const express = require('express');
const router = express.Router();
const { registerUser, loginUser, forgotPassword, resetPassword, verifyEmail, googleLogin } = require('../controllers/authController');

// Định nghĩa 2 đường dẫn
router.post('/register', registerUser);
router.post('/login', loginUser);

router.post('/google', googleLogin);

// --- ROUTES MỚI ---
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);
router.put('/verifyemail/:token', verifyEmail);


module.exports = router;