import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import HeroImage from '../models/HeroImage.js';
import User from '../models/User.js';

const router = express.Router();

// Helper middleware for superadmin check
const requireSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error verifying permissions' });
  }
};

// Public: Get all hero images
// Optional query param ?active=true to get only active images
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.active === 'true') {
      query.isActive = true;
    }
    
    const images = await HeroImage.find(query).sort({ order: 1 });
    
    const transformed = images.map(img => ({
      ...img.toObject(),
      id: img._id
    }));
    
    res.json(transformed);
  } catch (error) {
    console.error('Get hero images error:', error);
    res.status(500).json({ message: 'Error fetching hero images' });
  }
});

// Superadmin: Create new hero image
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { imageUrl, title, subtitle, order, isActive } = req.body;
    
    const newImage = new HeroImage({
      imageUrl,
      title,
      subtitle,
      order,
      isActive
    });

    await newImage.save();
    
    res.status(201).json({
      ...newImage.toObject(),
      id: newImage._id
    });
  } catch (error) {
    console.error('Create hero image error:', error);
    res.status(500).json({ message: 'Error creating hero image' });
  }
});

// Superadmin: Update hero image
router.put('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { imageUrl, title, subtitle, order, isActive } = req.body;
    
    const image = await HeroImage.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    if (imageUrl !== undefined) image.imageUrl = imageUrl;
    if (title !== undefined) image.title = title;
    if (subtitle !== undefined) image.subtitle = subtitle;
    if (order !== undefined) image.order = order;
    if (isActive !== undefined) image.isActive = isActive;

    await image.save();

    res.json({
      ...image.toObject(),
      id: image._id
    });
  } catch (error) {
    console.error('Update hero image error:', error);
    res.status(500).json({ message: 'Error updating hero image' });
  }
});

// Superadmin: Delete hero image
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const image = await HeroImage.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    await image.deleteOne();
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete hero image error:', error);
    res.status(500).json({ message: 'Error deleting hero image' });
  }
});

export default router;
