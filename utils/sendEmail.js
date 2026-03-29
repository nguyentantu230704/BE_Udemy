const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Tạo transporter (Cấu hình server mail)
    // Nâng cấp: Tự động đổi secure = true nếu dùng port 465
    const smptPort = process.env.SMTP_PORT || 587;
    const isSecure = smptPort == 465;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smptPort,
        secure: isSecure, // Thông minh tự đổi thành true nếu là 465
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    const message = {
        from: `${process.env.FROM_NAME} <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
    };

    // 3. Gửi mail
    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
};

module.exports = sendEmail;