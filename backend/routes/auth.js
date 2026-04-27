import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { transformUser } from '../utils/transform.js';
import crypto from 'crypto';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';

const router = express.Router();
console.log("🔥 AUTH ROUTES LOADED");

// Helper function to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Rate limiter for forgot password to prevent abuse
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: { message: 'Too many password reset attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Send Email OTP
router.post('/send-email-otp', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: req.user.userId } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use by another account' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    user.emailOTP = otp;
    user.emailOTPExpires = Date.now() + 600000; // 10 minutes
    await user.save();

    // Send actual email
    try {
      const { sendEmail } = await import('../utils/email.js');
      await sendEmail({
        to: email,
        subject: 'RideFlow Email Verification',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Email Verification</h2>
            <p>Your OTP for email verification is:</p>
            <h1 style="color: #ff6600; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
        `,
        text: `Your RideFlow verification code is: ${otp}`
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // In development, we can still provide the OTP for convenience
    }

    const response = { message: 'OTP sent to email' };
    if (process.env.NODE_ENV !== 'production') {
      response.devOTP = otp;
    }

    res.json(response);
  } catch (error) {
    console.error('Send email OTP error:', error);
    res.status(500).json({ message: 'Error sending email OTP' });
  }
});

// Verify Email OTP
router.post('/verify-email-otp', authenticateToken, async (req, res) => {
  console.log('POST /api/auth/verify-email-otp hit');
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({
      _id: req.user.userId,
      emailOTP: otp,
      emailOTPExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.email = email;
    user.emailVerified = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully', user: transformUser(user) });
  } catch (error) {
    console.error('Verify email OTP error:', error);
    res.status(500).json({ message: 'Error verifying email OTP' });
  }
});

// Send Mobile OTP
router.post('/send-mobile-otp', authenticateToken, async (req, res) => {
  console.log('POST /api/auth/send-mobile-otp hit');
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: 'Mobile number is required' });

    // Check if mobile is already taken by another user
    const existingUser = await User.findOne({ mobile, _id: { $ne: req.user.userId } });
    if (existingUser) {
      return res.status(400).json({ message: 'Mobile number already in use by another account' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    user.mobileOTP = otp;
    user.mobileOTPExpires = Date.now() + 600000; // 10 minutes
    await user.save();

    let smsSent = false;
    let smsErrorMessage = null;

    // Send actual SMS via Twilio
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // Ensure mobile number has country code for Twilio (assuming India +91 if not present)
      let formattedMobile = mobile.trim();
      if (!formattedMobile.startsWith('+')) {
        // If it's a 10-digit number, assume India (+91)
        if (formattedMobile.length === 10) {
          formattedMobile = `+91${formattedMobile}`;
        } else {
          // Otherwise, just add a + if it's missing (might be another country)
          formattedMobile = `+${formattedMobile}`;
        }
      }

      await client.messages.create({
        body: `Your RideFlow verification code is: ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedMobile
      });
      console.log(`✅ SMS sent successfully to ${formattedMobile}`);
      smsSent = true;
    } catch (smsError) {
      console.error('❌ Failed to send verification SMS:', smsError.message);
      if (smsError.code === 21614) {
        smsErrorMessage = 'Twilio Trial: The number is not verified. Please verify the recipient number in the Twilio console or upgrade your account.';
        console.warn(`⚠️ ${smsErrorMessage}`);
      } else {
        smsErrorMessage = `SMS failed: ${smsError.message}`;
      }
    }

    // Fallback: Send mobile OTP via email if SMS fails
    let emailSent = false;
    if (!smsSent) {
      try {
        const { sendEmail } = await import('../utils/email.js');
        await sendEmail({
          to: user.email,
          subject: 'RideFlow Mobile Verification OTP (Fallback)',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2>Mobile Verification OTP</h2>
              <p>We tried to send an SMS to <strong>${mobile}</strong> but it failed.</p>
              <p>Your verification code is:</p>
              <h1 style="color: #ff6600; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          `,
          text: `Your RideFlow mobile verification code (fallback) is: ${otp}`
        });
        console.log(`✅ Fallback OTP sent to email: ${user.email}`);
        emailSent = true;
      } catch (emailError) {
        console.error('❌ Failed to send fallback verification email:', emailError.message);
      }
    }

    // Logging for development only
    if (process.env.NODE_ENV !== 'production') {
      console.log('==========================================');
      console.log(`MOBILE OTP FOR ${mobile}: ${otp}`);
      console.log('==========================================');
    }

    if (smsSent) {
      res.json({ message: 'OTP sent to mobile successfully', devOTP: process.env.NODE_ENV !== 'production' ? otp : undefined });
    } else if (emailSent) {
      res.json({ 
        message: 'SMS delivery failed. OTP has been sent to your registered email instead.', 
        error: smsErrorMessage,
        devOTP: process.env.NODE_ENV !== 'production' ? otp : undefined 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to deliver OTP via SMS and email. Please try again later or contact support.',
        error: smsErrorMessage
      });
    }
  } catch (error) {
    console.error('Send mobile OTP error:', error);
    res.status(500).json({ message: 'Error sending mobile OTP' });
  }
});

// Verify Mobile OTP
router.post('/verify-mobile-otp', authenticateToken, async (req, res) => {
  console.log('POST /api/auth/verify-mobile-otp hit');
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) return res.status(400).json({ message: 'Mobile and OTP are required' });

    const user = await User.findOne({
      _id: req.user.userId,
      mobileOTP: otp,
      mobileOTPExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.mobile = mobile;
    user.mobileVerified = true;
    user.mobileOTP = undefined;
    user.mobileOTPExpires = undefined;
    await user.save();

    res.json({ message: 'Mobile number verified successfully', user: transformUser(user) });
  } catch (error) {
    console.error('Verify mobile OTP error:', error);
    res.status(500).json({ message: 'Error verifying mobile OTP' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user (password will be hashed by pre-save hook)
    const newUser = new User({
      email,
      name,
      password,
      role: 'user',
      walletBalance: 500, // Welcome bonus
      documents: []
    });

    await newUser.save();

    // Generate token
    const token = jwt.sign(
      { userId: newUser._id.toString(), email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: transformUser(newUser),
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'invalid email' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'invalid password' });
    }

    // Generate token
    const token = jwt.sign(
      { 
        userId: user._id.toString(), 
        email: user.email, 
        role: user.role,
        locationId: user.locationId?.toString() 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: transformUser(user),
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Forgot Password (Secured for Super Admin)
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const genericMessage = 'If a user with this email exists and is a registered superadmin, an OTP has been sent.';

    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Only proceed if user exists and is a superadmin
    if (user && user.role === 'superadmin') {
      // Generate 6-digit OTP
      const otp = generateOTP();
      
      // Hash OTP before storing for security
      const hashedOTP = await bcrypt.hash(otp, 10);
      user.resetPasswordOTP = hashedOTP;
      user.resetPasswordOTPExpires = Date.now() + 300000; // 5 minutes expiry

      await user.save();

      // Send OTP via email
      try {
        const { sendEmail } = await import('../utils/email.js');
        await sendEmail({
          to: email,
          subject: 'RideFlow Super Admin Password Reset OTP',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #ff6600;">Super Admin Password Reset</h2>
              <p>You requested a password reset for your RideFlow Super Admin account.</p>
              <p>Your OTP for password reset is:</p>
              <h1 style="color: #ff6600; font-size: 32px; letter-spacing: 5px; text-align: center; background: #fff5ed; padding: 10px; border-radius: 5px;">${otp}</h1>
              <p>This code will expire in <b>5 minutes</b>.</p>
              <p style="color: #666; font-size: 12px; margin-top: 20px; text-align: center;">If you didn't request this, please secure your account immediately.</p>
            </div>
          `,
        });
        console.log(`OTP generated for superadmin ${email}`);
      } catch (emailError) {
        console.error('Error sending OTP email:', emailError);
      }
    } else if (user) {
      console.warn(`Password reset attempt for non-superadmin email: ${email}`);
    }

    // Always return the same generic message to prevent account enumeration
    res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Error processing request' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOTPExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid OTP or OTP has expired' });
    }

    // Verify the hashed OTP
    const isOTPValid = await bcrypt.compare(otp, user.resetPasswordOTP);
    if (!isOTPValid) {
      return res.status(400).json({ message: 'Invalid OTP or OTP has expired' });
    }

    // Update password (pre-save hook will hash it)
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;

    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(transformUser(user));
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

export default router;
