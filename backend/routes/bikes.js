import express from 'express';
import Bike from '../models/Bike.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import User from '../models/User.js';
import { transformBike } from '../utils/transform.js';
import Rental from '../models/Rental.js';
import { logErrorIfNotConnection } from '../utils/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// Get all bikes (optionally filter by location)
router.get('/', catchAsync(async (req, res) => {
  const { locationId } = req.query;
  let query = {};
  if (locationId) {
    query.locationId = locationId;
  }
  const bikes = await Bike.find(query).populate('locationId', 'name city state');
  // Transform _id to id for frontend compatibility
  res.json(bikes.map(transformBike));
}));

// Get available bikes for a time window
router.get('/available', catchAsync(async (req, res) => {
  const { start, end, locationId } = req.query;
  if (!start || !end) {
    return res.status(400).json({ message: 'start and end query params are required (ISO dates)' });
  }
  const startTime = new Date(start);
  const endTime = new Date(end);
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || endTime <= startTime) {
    return res.status(400).json({ message: 'Invalid time range' });
  }

  // Find all rentals that overlap with the requested time
  const rentals = await Rental.find({
    status: { $in: ['confirmed', 'ongoing'] },
  }).select('bikeId startTime endTime pickupTime dropoffTime status');

  const occupiedBikeIds = new Set(
    rentals
      .filter((r) => {
        const rentalStart = r.pickupTime || r.startTime;
        if (!rentalStart) return false;

        const rentalEnd = r.dropoffTime || r.endTime || (r.status === 'ongoing' ? new Date(8640000000000000) : null);
        if (!rentalEnd) return rentalStart < endTime;

        return rentalStart < endTime && rentalEnd > startTime;
      })
      .map((r) => r.bikeId.toString())
  );

  const query = { status: 'available' };
  if (locationId) query.locationId = locationId;

  const bikes = await Bike.find(query).populate('locationId', 'name city state');
  const available = bikes.filter(b => !occupiedBikeIds.has(b._id.toString()));
  res.json(available.map(transformBike));
}));

// Get unique brands and models
router.get('/specs', catchAsync(async (req, res) => {
  const specs = await Bike.aggregate([
    { $group: { _id: '$brand', models: { $addToSet: '$name' } } },
    { $project: { brand: '$_id', models: 1, _id: 0 } },
    { $sort: { brand: 1 } }
  ]);
  res.json(specs);
}));

// Get bike by ID
router.get('/:id', catchAsync(async (req, res) => {
  const bike = await Bike.findById(req.params.id).populate('locationId', 'name city state');
  if (!bike) {
    return res.status(404).json({ message: 'Bike not found' });
  }
  // Transform _id to id for frontend compatibility
  res.json(transformBike(bike));
}));

// Create bike (admin only)
router.post('/', authenticateToken, authorize(['admin', 'superadmin']), catchAsync(async (req, res) => {
  const {
    name,
    type,
    brand,
    year,
    locationId
  } = req.body;

  if (!name || !type || !locationId || !brand) {
    return res.status(400).json({ message: 'Required fields missing: name, type, brand, locationId' });
  }

  // Basic validation for year if provided
  if (year) {
    const yearInt = parseInt(year);
    const currentYear = new Date().getFullYear();
    if (isNaN(yearInt) || yearInt < 1900 || yearInt > currentYear + 1) {
      return res.status(400).json({ message: 'Invalid year' });
    }
  }

  const newBike = new Bike({
    ...req.body,
    year: year ? parseInt(year) : undefined
  });

  const savedBike = await newBike.save();
  res.status(201).json(transformBike(savedBike));
}));

// Update bike (admin only)
router.put('/:id', authenticateToken, authorize(['admin', 'superadmin']), catchAsync(async (req, res) => {
  const updatedBike = await Bike.findByIdAndUpdate(
    req.params.id,
    { ...req.body },
    { new: true, runValidators: true }
  );

  if (!updatedBike) {
    return res.status(404).json({ message: 'Bike not found' });
  }

  res.json(transformBike(updatedBike));
}));

// Delete bike (admin only)
router.delete('/:id', authenticateToken, authorize(['admin', 'superadmin']), catchAsync(async (req, res) => {
  const bike = await Bike.findByIdAndDelete(req.params.id);
  if (!bike) {
    return res.status(404).json({ message: 'Bike not found' });
  }
  res.json({ message: 'Bike deleted successfully' });
}));

export default router;
