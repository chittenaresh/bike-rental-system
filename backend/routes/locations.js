import express from 'express';
import Location from '../models/Location.js';
import { authenticateToken } from './auth.js';
import User from '../models/User.js';
import { logErrorIfNotConnection } from '../utils/errorHandler.js';

const router = express.Router();

// Get all locations (public)
router.get('/', async (req, res) => {
  try {
    const { all } = req.query;
    let locations;

    if (all === 'true') {
      // Return all active locations (e.g., for Super Admin)
      locations = await Location.find({ isActive: true }).sort({ name: 1 });
    } else {
      // Only return locations that have at least one admin associated with them (for general users)
      const adminLocationIds = await User.find({ role: 'admin' }).distinct('locationId');
      
      locations = await Location.find({ 
        isActive: true,
        _id: { $in: adminLocationIds }
      }).sort({ name: 1 });
    }

    const transformedLocations = locations.map(loc => ({
      id: loc._id.toString(),
      name: loc.name,
      city: loc.city,
      state: loc.state,
      country: loc.country,
    }));
    res.json(transformedLocations);
  } catch (error) {
    logErrorIfNotConnection('Get locations error', error);
    res.status(500).json({ message: 'Error fetching locations. Please try again later.' });
  }
});

// Get location by ID
router.get('/:id', async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    res.json({
      id: location._id.toString(),
      name: location.name,
      city: location.city,
      state: location.state,
      country: location.country,
    });
  } catch (error) {
    logErrorIfNotConnection('Get location error', error);
    res.status(500).json({ message: 'Error fetching location. Please try again later.' });
  }
});

// Create location (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { name, city, state, country } = req.body;

    if (!name || !city || !state) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const newLocation = new Location({
      name,
      city,
      state,
      country: country || 'India',
      isActive: true,
    });

    await newLocation.save();
    res.status(201).json({
      id: newLocation._id.toString(),
      name: newLocation.name,
      city: newLocation.city,
      state: newLocation.state,
      country: newLocation.country,
    });
  } catch (error) {
    console.error('Create location error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Location already exists' });
    }
    res.status(500).json({ message: 'Error creating location' });
  }
});

// Update location (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const location = await Location.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        isActive: req.body.isActive
      },
      { new: true, runValidators: true }
    );

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    res.json({
      id: location._id.toString(),
      name: location.name,
      city: location.city,
      state: location.state,
      country: location.country,
      isActive: location.isActive,
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Error updating location' });
  }
});

// Delete location (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const location = await Location.findByIdAndDelete(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ message: 'Error deleting location' });
  }
});

export default router;



