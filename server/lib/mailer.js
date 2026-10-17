const fs = require('fs');
const nodemailer = require('nodemailer');

// Sends an admin alert. When TGE_MAIL_LOG is set, appends a JSON line to that file instead (test seam).
async function sendAdminMail(subject, text) {
    const to = process.env.ADMIN_ALERT_EMAIL || 'admin@milleniumrx.biz';
    if (process.env.TGE_MAIL_LOG) {
        fs.appendFileSync(process.env.TGE_MAIL_LOG, JSON.stringify({ to, subject, text }) + '\n');
        return true;
    }
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) {
        console.error('[Mailer] SMTP credentials not configured. Skipping email.');
        return false;
    }
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'mail.milleniumrx.biz',
            port: parseInt(process.env.SMTP_PORT) || 465,
            secure: true,
            auth: { user, pass },
        });
        await transporter.sendMail({ from: `"TGE Server" <${user}>`, to, subject, text });
        return true;
    } catch (err) {
        console.error('[Mailer] send failed:', err.message);
        return false;
    }
}

module.exports = { sendAdminMail };
