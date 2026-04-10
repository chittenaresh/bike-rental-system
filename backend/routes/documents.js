import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// =====================================
// ✅ MULTER CONFIG (Memory Storage)
// =====================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// =====================================
// ✅ AWS S3 CLIENT
// =====================================
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// =====================================
// ✅ FILE VALIDATION
// =====================================
const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

// =====================================
// ✅ UPLOAD TO S3 (MAIN)
// =====================================
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { name, type } = req.body;
    const file = req.file;

    if (!file || !name || !type) {
      return res.status(400).json({ message: 'Missing file/name/type' });
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    if (!process.env.AWS_S3_BUCKET) {
      return res.status(500).json({ message: 'S3 not configured' });
    }

    const ext = name.split('.').pop();
    const fileName = `${req.user.userId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const key = `documents/${req.user.userId}/${fileName}`;

    // ✅ Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.json({
      success: true,
      fileUrl,
      key,
    });

  } catch (err) {
    console.error('❌ S3 Upload Error:', err);
    return res.status(500).json({ message: 'Upload failed' });
  }
});

// =====================================
// ✅ GET DOCUMENTS
// =====================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (['admin', 'superadmin'].includes(user.role)) {
      const users = await User.find().select('name email documents');

      const docs = users.flatMap(u =>
        (u.documents || []).map(doc => ({
          ...doc.toObject(),
          userId: u._id,
          userName: u.name,
          userEmail: u.email,
        }))
      );

      return res.json(docs);
    }

    res.json(user.documents || []);
  } catch (err) {
    console.error('GET DOC ERROR:', err);
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// =====================================
// ✅ SAVE DOCUMENT
// =====================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, type, url } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.documents = user.documents.filter(d => d.type !== type);

    const doc = {
      name,
      type,
      url,
      status: 'pending',
      uploadedAt: new Date(),
    };

    user.documents.push(doc);
    await user.save();

    res.status(201).json(user.documents[user.documents.length - 1]);
  } catch (err) {
    console.error('SAVE DOC ERROR:', err);
    res.status(500).json({ message: 'Error saving document' });
  }
});

// =====================================
// ✅ UPDATE STATUS
// =====================================
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, reason } = req.body;

    const user = await User.findOne({ 'documents._id': req.params.id });
    if (!user) return res.status(404).json({ message: 'Not found' });

    const doc = user.documents.id(req.params.id);
    doc.status = status;
    doc.rejectionReason = status === 'rejected' ? reason : null;

    user.markModified('documents');
    await user.save();

    res.json(doc);
  } catch (err) {
    console.error('STATUS ERROR:', err);
    res.status(500).json({ message: 'Error updating status' });
  }
});

// =====================================
// ✅ DELETE DOCUMENT
// =====================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    const doc = user.documents.id(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    doc.deleteOne();
    await user.save();

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('DELETE ERROR:', err);
    res.status(500).json({ message: 'Error deleting document' });
  }
});

export default router;