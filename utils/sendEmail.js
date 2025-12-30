const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Tạo transporter (Cấu hình server mail)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true cho port 465, false cho các port khác
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    // 2. Định nghĩa nội dung mail
    const message = {
        from: `${process.env.FROM_NAME} <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message, // Fallback text
        html: options.html // HTML template đẹp mắt
    };

    // 3. Gửi mail
    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
};

module.exports = sendEmail;