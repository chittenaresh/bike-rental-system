import express from 'express';
import mongoose from 'mongoose';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Location from '../models/Location.js';
import { createPresignedUpload } from '../utils/s3.js';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'documents');

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

// Get user documents (or all documents if admin)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If admin, return all documents from all users with user info
    if (['admin', 'superadmin'].includes(currentUser.role)) {
      let query = {};

      // If admin (not superadmin), filter by location
      if (currentUser.role === 'admin' && currentUser.locationId) {
        try {
          const loc = await Location.findById(currentUser.locationId).select('city');
          if (loc?.city) {
            const esc = String(loc.city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const cityRegex = new RegExp(`^${esc}(\\b|\\s|\\s-| -)?`, 'i');
            query.$or = [
              { currentLocationId: currentUser.locationId },
              { currentAddress: cityRegex },
            ];
          } else {
            query.currentLocationId = currentUser.locationId;
          }
        } catch {
          query.currentLocationId = currentUser.locationId;
        }
      }

      const users = await User.find(query).select('name email documents currentLocationId currentAddress');
      const allDocuments = [];
      
      users.forEach(user => {
        if (user.documents && user.documents.length > 0) {
          user.documents.forEach(doc => {
            allDocuments.push({
              id: doc._id.toString(),
              name: doc.name,
              type: doc.type,
              url: doc.url,
              status: doc.status,
              rejectionReason: doc.rejectionReason,
              uploadedAt: doc.uploadedAt,
              userId: user._id.toString(),
              userName: user.name,
              userEmail: user.email,
            });
          });
        }
      });
      
      return res.json(allDocuments);
    }

    // Regular users get only their documents
    res.json(currentUser.documents || []);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// Generate S3 presigned upload URL
router.post('/upload-url', authenticateToken, async (req, res) => {
  try {
    const { name, type, contentType } = req.body;
    if (!name || !type || !contentType) {
      return res.status(400).json({ message: 'Name, type and contentType are required' });
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/jpg'];
    const normalized = contentType === 'image/jpg' ? 'image/jpeg' : contentType;
    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ message: 'Unsupported content type' });
    }
    const { uploadUrl, fileUrl, key } = await createPresignedUpload(req.user.userId, name, normalized);
    res.json({ uploadUrl, fileUrl, key });
  } catch (error) {
    const msg = (error && (error.message || String(error))) || 'Error creating upload URL';
    console.error('Presign error:', msg);
    res.status(500).json({ message: msg });
  }
});

// Fallback upload endpoint (avoids S3 CORS by uploading via backend)
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { name, type } = req.body;
    const file = req.file;
    if (!file || !name || !type) {
      return res.status(400).json({ message: 'file, name and type are required' });
    }

    // Validation for bike images
    if (type === 'bike_image') {
      const allowedFormats = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedFormats.includes(file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type. Only JPG, PNG and WEBP are supported.' });
      }

      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        return res.status(400).json({ message: 'File too large. Maximum size is 2MB.' });
      }
    }

    const ext = (name.split('.').pop() || 'bin').toLowerCase();
    const fileName = `${req.user.userId}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
    
    // Try S3 first
    const REGION = process.env.AWS_REGION;
    const BUCKET = process.env.AWS_S3_BUCKET;
    const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
    const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

    if (REGION && BUCKET && ACCESS_KEY_ID && SECRET_ACCESS_KEY) {
      try {
        const s3 = new S3Client({
          region: REGION,
          credentials: {
            accessKeyId: ACCESS_KEY_ID,
            secretAccessKey: SECRET_ACCESS_KEY,
          },
        });

        const key = `documents/${req.user.userId}/${fileName}`;
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }));
        const fileUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
        console.log('[DOC UPLOAD] S3 upload successful:', fileUrl);
        return res.json({ fileUrl, key });
      } catch (s3Error) {
        console.warn('[DOC UPLOAD] S3 upload failed, falling back to local storage:', s3Error.message);
      }
    }

    // Fallback: Local Storage
    const localFilePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(localFilePath, file.buffer);
    
    const baseUrl = getPublicBaseUrl(req);
    const fileUrl = `${baseUrl}/uploads/documents/${fileName}`;
    const key = `documents/${fileName}`;
    
    console.log('[DOC UPLOAD] Local file path:', localFilePath);
    console.log('[DOC UPLOAD] Local upload successful:', fileUrl);
    res.json({ fileUrl, key });
  } catch (error) {
    console.error('Upload error:', error?.message || error);
    res.status(500).json({ message: error?.message || 'Error uploading file' });
  }
});

// Save document record
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, type, url } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove any existing documents of this type (pending/approved/rejected) to avoid duplicates
    user.documents = (user.documents || []).filter(doc => doc.type !== type);

    // Create the single document entry for this type
    const newDocument = {
      name,
      type,
      url: url || '/documents/placeholder.pdf',
      status: 'pending',
      uploadedAt: new Date()
    };

    user.documents.push(newDocument);
    await user.save();

    const savedDoc = user.documents[user.documents.length - 1];
    res.status(201).json(savedDoc);
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ message: 'Error uploading document' });
  }
});

// Update document status (superadmin only)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const currentUser = await User.findById(req.user.userId);
    if (!['admin', 'superadmin'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Find user with this document
    let user = await User.findOne({ 'documents._id': req.params.id });
    
    if (!user) {
      // Try finding by the document id directly if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        user = await User.findOne({ 'documents._id': new mongoose.Types.ObjectId(req.params.id) });
      }
    }

    if (!user) {
      console.log(`Document ${req.params.id} not found in any user profile`);
      return res.status(404).json({ message: 'Document not found' });
    }

    const doc = user.documents.id(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document content not found' });
    }
    doc.status = status;
    
    // Add rejection reason if status is rejected
    if (status === 'rejected') {
      doc.rejectionReason = reason || 'No reason provided';
    } else if (status === 'approved') {
      doc.rejectionReason = null; // Clear reason if approved later
    }

    // Explicitly mark documents as modified for subdocument updates
    user.markModified('documents');
    await user.save();

    res.json(doc);
  } catch (error) {
    console.error('Update document status error:', error);
    res.status(500).json({ message: error.message || 'Error updating document status' });
  }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const doc = user.documents.id(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    doc.deleteOne();
    await user.save();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ message: 'Error deleting document' });
  }
});

export default router;
