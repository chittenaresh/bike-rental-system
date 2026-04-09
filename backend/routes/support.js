import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';
import SupportTicket from '../models/SupportTicket.js';
import User from '../models/User.js';
import Rental from '../models/Rental.js';
import Bike from '../models/Bike.js';
import SupportReply from '../models/SupportReply.js';
import { sendEmail } from '../utils/email.js';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'support');

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

// Send email reply to guest/user
router.post('/email-reply/:id', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const ticket = await SupportTicket.findById(req.params.id).populate('userId');
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const admin = await User.findById(req.user.userId);
    if (!['admin', 'superadmin'].includes(admin.role)) {
      return res.status(403).json({ message: 'Only admins can send email replies' });
    }

    const recipientEmail = ticket.contactEmail || ticket.guestEmail || (ticket.userId ? ticket.userId.email : null);
    const recipientName = ticket.contactName || ticket.guestName || (ticket.userId ? ticket.userId.name : 'User');

    if (!recipientEmail) {
      return res.status(400).json({ message: 'No email found for this ticket' });
    }

    // 1. Send Email
    try {
      await sendEmail({
        to: recipientEmail,
        subject: `Re: [Ticket #${ticket._id.toString().slice(-8)}] ${ticket.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #F97316;">Support Reply</h2>
            <p>Hi ${recipientName},</p>
            <p>Our team has replied to your support ticket:</p>
            <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #F97316; margin: 20px 0;">
              ${content.replace(/\n/g, '<br>')}
            </div>
            <p>Ticket Details:</p>
            <ul>
              <li><b>Ticket ID:</b> ${ticket._id}</li>
              <li><b>Subject:</b> ${ticket.subject}</li>
              <li><b>Status:</b> Replied</li>
            </ul>
            <p>If you have any further questions, feel free to reply to this email or visit our website.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">This is an automated message from RideFlow Support.</p>
          </div>
        `,
        text: `Hi ${recipientName},\n\nOur team has replied to your support ticket:\n\n${content}\n\nTicket Details:\nTicket ID: ${ticket._id}\nSubject: ${ticket.subject}\nStatus: Replied`
      });
    } catch (emailError) {
      console.error('Email delivery failed:', emailError);
      return res.status(500).json({ 
        message: 'Failed to send email', 
        details: emailError.message,
        code: emailError.code || 'UNKNOWN_ERROR'
      });
    }

    // 2. Save to support_replies (SupportReply model)
    const reply = new SupportReply({
      ticketId: ticket._id,
      adminId: admin._id,
      content,
      sentVia: 'email'
    });
    await reply.save();

    // 3. Update ticket messages and status
    ticket.messages.push({
      senderId: admin._id,
      senderRole: admin.role,
      content: `[EMAIL REPLY SENT TO ${recipientEmail}]\n\n${content}`,
      createdAt: Date.now()
    });
    
    ticket.status = 'replied';
    ticket.updatedAt = Date.now();
    await ticket.save();

    const updatedTicket = await SupportTicket.findById(req.params.id)
      .populate('userId', 'name email mobile')
      .populate({ 
        path: 'rentalId',
        populate: { path: 'bikeId', select: 'name brand image locationId' }
      })
      .populate('messages.senderId', 'name role');

    res.json({
      message: 'Email reply sent successfully',
      ticket: updatedTicket
    });

  } catch (error) {
    console.error('Email reply error:', error);
    res.status(500).json({ message: 'Error sending email reply', error: error.message });
  }
});

// Upload attachment
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('[SUPPORT UPLOAD] Request received from user:', req.user?.userId || req.user?.id);
    if (!req.file) {
      console.warn('[SUPPORT UPLOAD] No file provided');
      return res.status(400).json({ message: 'No file provided' });
    }

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const userId = req.user?.userId || req.user?.id || 'guest';
    const fileName = `${userId}-${Date.now()}.${ext}`;
    
    // Try AWS S3 upload first
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

        const key = `support/${fileName}`;
        console.log('[SUPPORT UPLOAD] Uploading to S3 with key:', key);

        const command = new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        });

        await s3.send(command);
        const fileUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
        console.log('[SUPPORT UPLOAD] S3 Upload successful, file URL:', fileUrl);
        return res.json({ imageUrl: fileUrl });
      } catch (s3Error) {
        console.error('[SUPPORT UPLOAD] S3 upload failed, falling back to local storage:', s3Error.message);
      }
    } else {
      console.warn('[SUPPORT UPLOAD] S3 configuration incomplete, using local storage fallback');
    }

    // Fallback: Local Storage
    const localFilePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(localFilePath, req.file.buffer);
    
    // Construct local URL
    const baseUrl = getPublicBaseUrl(req);
    const fileUrl = `${baseUrl}/uploads/support/${fileName}`;
    
    console.log('[SUPPORT UPLOAD] Local file path:', localFilePath);
    console.log('[SUPPORT UPLOAD] Local upload successful, file URL:', fileUrl);
    res.json({ imageUrl: fileUrl });

  } catch (error) {
    console.error('[SUPPORT UPLOAD] Final Error:', error);
    res.status(500).json({ message: 'Error uploading file', details: error.message });
  }
});

// Get all tickets
// - Users see only their own tickets
// - Admins see tickets for bikes in their assigned location
// - Superadmins see all tickets
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    let query = {};
    
    if (user.role === 'user') {
      query = { userId: req.user.userId };
    }

    let tickets = await SupportTicket.find(query)
      .populate('userId', 'name email mobile')
      .populate({ 
        path: 'rentalId',
        populate: { path: 'bikeId', select: 'name brand image locationId' }
      })
      .sort({ updatedAt: -1 });

    // For admins, filter tickets by location
    if (user.role === 'admin' && user.locationId) {
      const adminLocationId = user.locationId.toString();
      tickets = tickets.filter((ticket) => {
        // First check ticket.locationId
        if (ticket.locationId && ticket.locationId.toString() === adminLocationId) {
          return true;
        }

        // Then check rental's bike location
        const rental = ticket.rentalId;
        if (!rental || !rental.bikeId) return false;
        const bike = rental.bikeId;
        const loc = bike.locationId;
        const bikeLocationId =
          (loc && typeof loc === 'object' && loc._id)
            ? loc._id.toString()
            : (loc && loc.toString ? loc.toString() : loc);
        return bikeLocationId === adminLocationId;
      });
    }

    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ message: 'Error fetching tickets' });
  }
});

// Create a new ticket
router.post('/', async (req, res) => {
  try {
    const { subject, category, description, rentalId, images, locationId, guestName, guestEmail } = req.body;
    console.log('[SUPPORT CREATE] Request body:', { subject, category, rentalId, imagesCount: images?.length, locationId, hasGuestName: !!guestName });
    
    // Server-side validation
    if (category === 'contact') {
      console.log('[SUPPORT CREATE] Validating guest contact request');
      if (!guestEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(guestEmail)) {
        return res.status(400).json({ message: 'A valid email address is required.' });
      }
      if (guestEmail.length > 100) {
        return res.status(400).json({ message: 'Email cannot exceed 100 characters.' });
      }
      if (!description || description.trim().length === 0) {
        return res.status(400).json({ message: 'Message content is required.' });
      }
      if (description.length > 500) {
        return res.status(400).json({ message: 'Message cannot exceed 500 characters.' });
      }
      if (!guestName || guestName.trim().length === 0) {
        return res.status(400).json({ message: 'Name is required.' });
      }
    }

    // Check for auth token manually to handle both guest and logged-in users
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    let userId = null;
    let userRole = 'guest';
    let finalLocationId = locationId;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('[SUPPORT CREATE] Decoded token:', decoded);
        const tokenUserId = decoded.userId || decoded.id; // Support both userId and id field in token
        
        if (tokenUserId) {
          // If we have a valid ID from token, we trust it for userId
          try {
            userId = new mongoose.Types.ObjectId(tokenUserId);
            console.log('[SUPPORT CREATE] Using userId from token:', userId);
          } catch (e) {
            console.warn('[SUPPORT CREATE] Invalid ObjectId in token:', tokenUserId);
            userId = null;
          }
          
          if (userId) {
            // Still try to find user to get role and location, but don't null out userId if user not found immediately
            const user = await User.findById(userId);
            if (user) {
              userRole = user.role;
              // If no locationId provided in body, use user's current location
              if (!locationId && user.currentLocationId) {
                finalLocationId = user.currentLocationId.toString();
              }
            }
          }
        }
      } catch (e) {
        console.warn('[SUPPORT CREATE] Invalid token provided for ticket creation, proceeding as guest:', e.message);
        userId = null; // Token invalid
      }
    }

    // If rentalId is provided, try to get location from the bike's location
    if (!finalLocationId && rentalId) {
      try {
        const rental = await Rental.findById(rentalId).populate('bikeId');
        if (rental && rental.bikeId) {
          finalLocationId = rental.bikeId.locationId;
          console.log('[SUPPORT CREATE] Found locationId from rental:', finalLocationId);
        }
      } catch (e) {
        console.warn('[SUPPORT CREATE] Failed to fetch rental/bike for location info:', e.message);
      }
    }

    const ticketData = {
      userId: userId || undefined,
      rentalId: rentalId || undefined,
      locationId: finalLocationId || undefined,
      guestName: guestName || undefined,
      guestEmail: guestEmail || undefined,
      contactName: guestName || undefined,
      contactEmail: guestEmail || undefined,
      subject,
      category,
      priority: ['breakdown', 'accident'].includes(category) ? 'critical' : 'medium',
      messages: [{
        senderId: userId || undefined,
        guestName: guestName || undefined,
        guestEmail: guestEmail || undefined,
        contactName: guestName || undefined,
        contactEmail: guestEmail || undefined,
        senderRole: userRole,
        content: description,
        attachments: images || []
      }]
    };

    console.log('[SUPPORT CREATE] Creating ticket with data:', JSON.stringify(ticketData, null, 2));
    const ticket = new SupportTicket(ticketData);
    await ticket.save();
    console.log('[SUPPORT CREATE] Ticket saved successfully:', ticket._id);
    res.status(201).json(ticket);
  } catch (error) {
    console.error('[SUPPORT CREATE] Error details:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      message: 'Error creating ticket',
      details: error.message 
    });
  }
});

// Get specific ticket
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('userId', 'name email mobile')
      .populate({ 
        path: 'rentalId',
        populate: { path: 'bikeId', select: 'name brand image locationId' }
      })
      .populate('messages.senderId', 'name role');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const user = await User.findById(req.user.userId);
    if (user.role === 'user') {
      const ticketUserId = ticket.userId?._id?.toString() || ticket.userId?.toString();
      if (ticketUserId !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(ticket);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ message: 'Error fetching ticket' });
  }
});

// Add message to ticket
router.post('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { content, attachments } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    const user = await User.findById(req.user.userId);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ message: 'Cannot reply to a closed ticket' });
    }

    if (user.role === 'user' && ticket.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    ticket.messages.push({
      senderId: req.user.userId,
      senderRole: user.role,
      content,
      attachments: attachments || []
    });

    // If user replies, maybe change status to open/in_progress?
    // If admin replies, change status to in_progress/resolved?
    // Let's keep it simple: just update timestamp.
    ticket.updatedAt = Date.now();
    
    await ticket.save();
    
    // Return the new message with sender info populated
    // We can just return the updated ticket or the new message.
    // Let's return the full updated ticket for simplicity in frontend state update.
    const updatedTicket = await SupportTicket.findById(req.params.id)
      .populate('userId', 'name email mobile')
      .populate({ 
        path: 'rentalId',
        populate: { path: 'bikeId', select: 'name brand image locationId' }
      })
      .populate('messages.senderId', 'name role');
      
    res.json(updatedTicket);
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ message: 'Error adding message' });
  }
});

// Get reply history for a ticket
router.get('/:id/replies', authenticateToken, async (req, res) => {
  try {
    const replies = await SupportReply.find({ ticketId: req.params.id })
      .populate('adminId', 'name email role')
      .sort({ createdAt: 1 });
    res.json(replies);
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ message: 'Error fetching replies' });
  }
});

// Update ticket status (Admin only)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, priority } = req.body;
    const user = await User.findById(req.user.userId);

    if (!['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Error updating status' });
  }
});

export default router;
