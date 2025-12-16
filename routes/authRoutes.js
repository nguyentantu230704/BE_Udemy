const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');

// Định nghĩa 2 đường dẫn
router.post('/register', registerUser);
router.post('/login', loginUser);

module.exports = router;