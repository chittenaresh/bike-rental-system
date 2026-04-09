import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import SiteSettings from '../models/SiteSettings.js';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'settings');

const getPublicBaseUrl = (req) => {
  const raw = process.env.PUBLIC_BASE_URL || process.env.APP_URL || '';
  if (raw) return String(raw).replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Middleware to ensure superadmin access
const requireSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    req.userRole = user.role;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error verifying access' });
  }
};

// Get home hero settings (public)
router.get('/home-hero', async (req, res) => {
  try {
    const setting = await SiteSettings.findOne({ key: 'home_hero_image' });
    res.json({ imageUrl: setting ? setting.value : null });
  } catch (error) {
    console.error('Get home hero settings error:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// Update home hero settings (Super Admin only)
router.put('/home-hero', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    const setting = await SiteSettings.findOneAndUpdate(
      { key: 'home_hero_image' },
      { value: imageUrl },
      { upsert: true, new: true }
    );

    res.json({ imageUrl: setting.value });
  } catch (error) {
    console.error('Update home hero settings error:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// Upload image (Super Admin only)
router.post('/upload', authenticateToken, requireSuperAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const REGION = process.env.AWS_REGION;
    const BUCKET = process.env.AWS_S3_BUCKET;
    const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
    const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const fileName = `home-hero-${Date.now()}.${ext}`;

    if (REGION && BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY) {
      try {
        const s3 = new S3Client({
          region: REGION,
          credentials: {
            accessKeyId: ACCESS_KEY_ID,
            secretAccessKey: SECRET_ACCESS_KEY,
          },
        });

        const key = `settings/${fileName}`;

        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        });

        await s3.send(command);
        const fileUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
        console.log('[SETTINGS UPLOAD] S3 upload successful:', fileUrl);
        return res.json({ imageUrl: fileUrl });
      } catch (s3Error) {
        console.warn('[SETTINGS UPLOAD] S3 upload failed, falling back to local storage:', s3Error.message);
      }
    }

    // Fallback: Local Storage
    const localFilePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(localFilePath, req.file.buffer);

    const baseUrl = getPublicBaseUrl(req);
    const fileUrl = `${baseUrl}/uploads/settings/${fileName}`;

    console.log('[SETTINGS UPLOAD] Local file path:', localFilePath);
    console.log('[SETTINGS UPLOAD] Local upload successful:', fileUrl);
    res.json({ imageUrl: fileUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

export default router;
