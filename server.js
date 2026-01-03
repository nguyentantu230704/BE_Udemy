require('dotenv').config(); // load biến môi trường trước
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const sectionRoutes = require('./routes/sectionRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const progressRoutes = require('./routes/progressRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
// Config
connectDB();

const app = express();

// Middlewares
app.use(express.json()); // Để đọc JSON từ body request
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Cho phép Frontend gọi API
app.use(morgan('dev')); // Log request
app.use('/api/categories', categoryRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/instructor', instructorRoutes);


app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);

// Error Handling (Cơ bản)
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});


app.get('/payment/success', (req, res) => {
  res.send(`
        <div style="text-align: center; padding-top: 50px;">
            <h1 style="color: green;">✅ Thanh toán thành công!</h1>
            <p>Mã đơn hàng: <b>${req.query.orderId}</b></p>
            <p>Khóa học đã được kích hoạt.</p>
        </div>
    `);
});

app.get('/payment/failed', (req, res) => {
  res.send(`
        <div style="text-align: center; padding-top: 50px;">
            <h1 style="color: red;">❌ Thanh toán thất bại</h1>
            <p>Lý do: <b style="color: red;">${req.query.message}</b></p>
        </div>
    `);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ✅`);
});
