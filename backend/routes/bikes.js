import express from 'express';
import Bike from '../models/Bike.js';
import { authenticateToken, optionalAuthenticateToken, authorize } from '../middleware/auth.js';
import User from '../models/User.js';
import { validateBrandModelMatch, getBrandForModel } from '../utils/bikeSpecs.js';
import { transformBike } from '../utils/transform.js';
import Rental from '../models/Rental.js';
import { logErrorIfNotConnection } from '../utils/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';

const router = express.Router();

// Helper to validate numeric fields
const validateNumericFields = (fields, data) => {
  const constraints = {
    weekdayRate: { maxLen: 5, maxVal: 99999 },
    weekendRate: { maxLen: 5, maxVal: 99999 },
    kmLimitPerHour: { maxLen: 3, maxVal: 999 },
    kmLimit: { maxLen: 3, maxVal: 999 },
    excessKmCharge: { maxLen: 4, maxVal: 9999 },
    minBookingHours: { maxLen: 2, maxVal: 24 },
    gstPercentage: { maxLen: 3, maxVal: 100 }
  };

  for (const field of fields) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      const val = parseFloat(data[field]);
      if (isNaN(val) || val < 0) {
        return `${field} must be a valid positive number`;
      }

      const config = constraints[field];
      if (config) {
        const strVal = String(data[field]).split('.')[0];
        if (strVal.length > config.maxLen) {
          return `${field} exceeds maximum digit limit of ${config.maxLen}`;
        }
        if (val > config.maxVal) {
          return `${field} exceeds maximum value of ${config.maxVal}`;
        }
      }

      // Check for scientific notation or other invalid characters if it was a string
      if (typeof data[field] === 'string' && (/[eE\+\-]/.test(data[field]) || !/^\d*\.?\d*$/.test(data[field]))) {
        return `${field} contains invalid characters`;
      }
    }
  }
  return null;
};

// Get all bikes (optionally filter by location)
router.get('/', optionalAuthenticateToken, catchAsync(async (req, res) => {
  const { locationId, q } = req.query;
  const query = {};

  // For admin users, strictly enforce their assigned location
  if (req.user && req.user.role === 'admin' && req.user.locationId) {
    query.locationId = req.user.locationId;
  } else if (locationId) {
    query.locationId = locationId;
  }

  if (q && typeof q === 'string' && q.trim() !== '') {
    const search = q.trim();
    const isNumeric = /^\d+$/.test(search);
    if (isNumeric) {
      const yearInt = parseInt(search, 10);
      if (!isNaN(yearInt)) {
        query.year = yearInt;
      }
    } else {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { name: regex },
        { brand: regex },
        { type: regex },
      ];
    }
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
    locationId,
    image
  } = req.body;

  const missingFields = [];
  if (!name) missingFields.push('name');
  if (!type) missingFields.push('type');
  if (!brand) missingFields.push('brand');
  if (!locationId) missingFields.push('locationId');
  if (!image) missingFields.push('image');

  if (missingFields.length > 0) {
    const fieldLabels = {
      name: 'Vehicle Name',
      type: 'Type',
      brand: 'Brand',
      locationId: 'Location',
      image: 'Image'
    };
    
    if (missingFields.length === 1) {
      return res.status(400).json({ 
        message: `${fieldLabels[missingFields[0]]} is required`,
        field: missingFields[0]
      });
    }
    
    return res.status(400).json({ 
      message: `Required fields missing: ${missingFields.map(f => fieldLabels[f]).join(', ')}`,
      fields: missingFields
    });
  }

  // Brand-Model relationship validation
  if (!validateBrandModelMatch(brand, name)) {
    const correctBrand = getBrandForModel(name);
    return res.status(400).json({
      message: `Invalid brand-model combination. ${name} belongs to ${correctBrand}.`,
      field: 'brand'
    });
  }

  // Numeric fields validation
  const numericFields = [
    'pricePerHour', 'price12Hours', 'pricePerWeek', 'kmLimit',
    'weekdayRate', 'weekendRate', 'excessKmCharge', 'kmLimitPerHour',
    'minBookingHours', 'gstPercentage'
  ];
  const numericError = validateNumericFields(numericFields, req.body);
  if (numericError) {
    return res.status(400).json({ message: numericError });
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
  const bike = await Bike.findById(req.params.id);
  if (!bike) {
    return res.status(404).json({ message: 'Bike not found' });
  }

  const updateData = { ...req.body };

  // Brand-Model relationship validation
  if (req.body.name || req.body.brand) {
    const finalName = req.body.name || bike.name;
    const finalBrand = req.body.brand || bike.brand;
    if (!validateBrandModelMatch(finalBrand, finalName)) {
      const correctBrand = getBrandForModel(finalName);
      return res.status(400).json({
        message: `Invalid brand-model combination. ${finalName} belongs to ${correctBrand}.`,
        field: 'brand'
      });
    }
  }

  // Numeric fields validation
  const numericFields = [
    'pricePerHour', 'price12Hours', 'pricePerWeek', 'kmLimit',
    'weekdayRate', 'weekendRate', 'excessKmCharge', 'kmLimitPerHour',
    'minBookingHours', 'gstPercentage', 'year'
  ];
  const numericError = validateNumericFields(numericFields, updateData);
  if (numericError) {
    return res.status(400).json({ message: numericError });
  }

  if (updateData.status) {
    if (updateData.status === 'available') {
      updateData.available = true;
    } else if (updateData.status === 'maintenance' || updateData.status === 'disabled') {
      updateData.available = false;
    }
  }

  const updatedBike = await Bike.findByIdAndUpdate(
    req.params.id,
    updateData,
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
