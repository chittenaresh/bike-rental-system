import nodemailer from 'nodemailer';

export function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!user || !pass) {
    console.warn('⚠️ SMTP not configured. Emails will not be sent.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false // Often needed for Gmail on some networks
    }
  });
}

export async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransporter();
  if (!transporter) {
    throw new Error('SMTP credentials not configured in .env');
  }

  const mailOptions = {
    from: `"RideFlow Support" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error; // Throw the actual error so the route can catch it
  }
}
