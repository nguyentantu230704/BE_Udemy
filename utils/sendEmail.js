const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Tự động nhận diện Port: Nếu không cấu hình thì mặc định là 587
    const smptPort = process.env.SMTP_PORT || 587;
    // Bắt buộc secure = true nếu dùng port 465 (SSL)
    const isSecure = smptPort == 465;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smptPort,
        secure: isSecure,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
        // Thêm timeout để nếu lỗi mạng thì nhả lỗi ngay lập tức, không làm treo web
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
    });

    const message = {
        from: `${process.env.FROM_NAME} <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html
    };

    await transporter.sendMail(message);
};

module.exports = sendEmail;