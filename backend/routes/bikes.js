import express from 'express';
import Bike from '../models/Bike.js';
import { authenticateToken } from './auth.js';
import User from '../models/User.js';
import { transformBike } from '../utils/transform.js';
import Rental from '../models/Rental.js';
import { logErrorIfNotConnection } from '../utils/errorHandler.js';

const router = express.Router();

// Get all bikes (optionally filter by location)
router.get('/', async (req, res) => {
  try {
    const { locationId } = req.query;
    let query = {};
    if (locationId) {
      query.locationId = locationId;
    }
    const bikes = await Bike.find(query).populate('locationId', 'name city state');
    // Transform _id to id for frontend compatibility
    const transformedBikes = bikes.map(transformBike);
    res.json(transformedBikes);
  } catch (error) {
    logErrorIfNotConnection('Get bikes error', error);
    res.status(500).json({ message: 'Error fetching bikes. Please try again later.' });
  }
});

// Get available bikes for a time window
router.get('/available', async (req, res) => {
  try {
    const { start, end, locationId } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: 'start and end query params are required (ISO dates)' });
    }
    const startTime = new Date(start);
    const endTime = new Date(end);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || endTime <= startTime) {
      return res.status(400).json({ message: 'Invalid time range' });
    }

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

    const query = {};
    if (locationId) query.locationId = locationId;

    const bikes = await Bike.find(query).populate('locationId', 'name city state');
    const available = bikes.filter(b => !occupiedBikeIds.has(b._id.toString()));
    res.json(available.map(transformBike));
  } catch (error) {
    logErrorIfNotConnection('Get available bikes error', error);
    res.status(500).json({ message: 'Error fetching available bikes. Please try again later.' });
  }
});

// Get unique brands and models
router.get('/specs', async (req, res) => {
  try {
    const specs = await Bike.aggregate([
      { $group: { _id: '$brand', models: { $addToSet: '$name' } } },
      { $project: { brand: '$_id', models: 1, _id: 0 } },
      { $sort: { brand: 1 } }
    ]);
    res.json(specs);
  } catch (error) {
    logErrorIfNotConnection('Get bike specs error', error);
    res.status(500).json({ message: 'Error fetching bike specs. Please try again later.' });
  }
});

// Get bike by ID
router.get('/:id', async (req, res) => {
  try {
    const bike = await Bike.findById(req.params.id);
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }
    // Transform _id to id for frontend compatibility
    res.json(transformBike(bike));
  } catch (error) {
    logErrorIfNotConnection('Get bike error', error);
    res.status(500).json({ message: 'Error fetching bike. Please try again later.' });
  }
});

// Create bike (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { 
      name, 
      type, 
      brand,
      year, 
      category,
      image,
      images, 
      pricePerHour, 
      kmLimit, 
      description, 
      features, 
      locationId,
      pricingSlabs,
      weekendSurgeMultiplier,
      gstPercentage,
      price12Hours,
      pricePerHourOver12,
      pricePerWeek,
      pricePerHour13,
      pricePerHour14,
      pricePerHour15,
      pricePerHour16,
      pricePerHour17,
      pricePerHour18,
      pricePerHour19,
      pricePerHour20,
      pricePerHour21,
      pricePerHour22,
      pricePerHour23,
      pricePerHour24,
      // Tariff fields
      weekdayRate,
      weekendRate,
      excessKmCharge,
      kmLimitPerHour,
      minBookingHours
    } = req.body;

    if (!name || !type || !locationId) {
      return res.status(400).json({ message: 'Required fields missing: name, type, locationId' });
    }

    // Validate Brand
    if (!brand || typeof brand !== 'string' || brand.trim() === '') {
      return res.status(400).json({ message: 'Brand is required and must be a valid string' });
    }

    // Validate Year
    const currentYear = new Date().getFullYear();
    const minYear = 2000;
    if (year) {
      const yearInt = parseInt(year);
      if (isNaN(yearInt) || yearInt < minYear || yearInt > currentYear) {
        return res.status(400).json({ message: `Year must be between ${minYear} and ${currentYear}` });
      }
    }

    // Validate that some pricing configuration is provided
    const hasPricingSlabs = pricingSlabs && (
      pricingSlabs.hourly || 
      pricingSlabs.daily || 
      pricingSlabs.weekly
    );
    // Legacy: allow pricePerHour even if kmLimit is not set
    const hasLegacyPricing = pricePerHour;
    // Simple pricing: 12-hour package or weekly price
    const hasSimplePricing = price12Hours || pricePerWeek;
    // Tariff-based pricing: weekday/weekend hourly rates
    const hasTariffPricing = weekdayRate || weekendRate;

    if (!hasPricingSlabs && !hasLegacyPricing && !hasSimplePricing && !hasTariffPricing) {
      return res.status(400).json({ 
        message: 'Provide at least one pricing option: pricingSlabs, pricePerHour, price12Hours/pricePerWeek, or tariff rates' 
      });
    }

    const newBike = new Bike({
      name,
      type,
      brand: brand || '',
      year: year ? parseInt(year) : undefined,
      category: category || 'midrange',
      image: image || '/bikes/default.jpg',
      images: images || [],
      // Legacy fields (optional if pricingSlabs provided)
      pricePerHour: pricePerHour ? parseFloat(pricePerHour) : undefined,
      kmLimit: kmLimit ? parseInt(kmLimit) : undefined,
      // New simple pricing model
      price12Hours: price12Hours ? parseFloat(price12Hours) : undefined,
      pricePerHourOver12: pricePerHourOver12 ? parseFloat(pricePerHourOver12) : undefined,
      pricePerWeek: pricePerWeek ? parseFloat(pricePerWeek) : undefined,
      pricePerHour13: pricePerHour13 ? parseFloat(pricePerHour13) : undefined,
      pricePerHour14: pricePerHour14 ? parseFloat(pricePerHour14) : undefined,
      pricePerHour15: pricePerHour15 ? parseFloat(pricePerHour15) : undefined,
      pricePerHour16: pricePerHour16 ? parseFloat(pricePerHour16) : undefined,
      pricePerHour17: pricePerHour17 ? parseFloat(pricePerHour17) : undefined,
      pricePerHour18: pricePerHour18 ? parseFloat(pricePerHour18) : undefined,
      pricePerHour19: pricePerHour19 ? parseFloat(pricePerHour19) : undefined,
      pricePerHour20: pricePerHour20 ? parseFloat(pricePerHour20) : undefined,
      pricePerHour21: pricePerHour21 ? parseFloat(pricePerHour21) : undefined,
      pricePerHour22: pricePerHour22 ? parseFloat(pricePerHour22) : undefined,
      pricePerHour23: pricePerHour23 ? parseFloat(pricePerHour23) : undefined,
      pricePerHour24: pricePerHour24 ? parseFloat(pricePerHour24) : undefined,
      // Tariff fields
      weekdayRate: weekdayRate ? parseFloat(weekdayRate) : undefined,
      weekendRate: weekendRate ? parseFloat(weekendRate) : undefined,
      excessKmCharge: excessKmCharge ? parseFloat(excessKmCharge) : undefined,
      kmLimitPerHour: kmLimitPerHour ? parseFloat(kmLimitPerHour) : undefined,
      minBookingHours: minBookingHours ? parseFloat(minBookingHours) : undefined,
      // New pricing model
      pricingSlabs: pricingSlabs || undefined,
      weekendSurgeMultiplier: weekendSurgeMultiplier ? parseFloat(weekendSurgeMultiplier) : 1.0,
      gstPercentage: gstPercentage !== undefined && gstPercentage !== null && gstPercentage !== '' ? parseFloat(gstPercentage) : 18.0,
      available: req.body.status ? req.body.status === 'available' : true,
      status: req.body.status || 'available',
      description: description || '',
      features: features || [],
      locationId
    });

    await newBike.save();
    // Transform _id to id for frontend compatibility
    res.status(201).json(transformBike(newBike));
  } catch (error) {
    console.error('Create bike error:', error);
    res.status(500).json({ message: 'Error creating bike' });
  }
});

// Update bike (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Extract fields from request body
    const {
      name,
      type,
      brand,
      year,
      category,
      image,
      images,
      pricePerHour,
      kmLimit,
      description,
      features,
      locationId,
      pricingSlabs,
      weekendSurgeMultiplier,
      gstPercentage,
      available,
      price12Hours,
      pricePerHourOver12,
      pricePerWeek,
      pricePerHour13,
      pricePerHour14,
      pricePerHour15,
      pricePerHour16,
      pricePerHour17,
      pricePerHour18,
      pricePerHour19,
      pricePerHour20,
      pricePerHour21,
      pricePerHour22,
      pricePerHour23,
      pricePerHour24,
      // Tariff fields
      weekdayRate,
      weekendRate,
      excessKmCharge,
      kmLimitPerHour,
      minBookingHours,
      status
    } = req.body;

    // Build update object with only provided fields
    const updateData = {};
    if (status !== undefined) {
      updateData.status = status;
      // Automatically sync available field based on status
      updateData.available = (status === 'available');
    }
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (brand !== undefined) updateData.brand = brand || '';
    if (year !== undefined) updateData.year = year ? parseInt(year) : null;
    if (category !== undefined) updateData.category = category || 'midrange';
    if (image !== undefined) updateData.image = image;
    if (images !== undefined) updateData.images = images;
    if (pricePerHour !== undefined) updateData.pricePerHour = parseFloat(pricePerHour);
    if (kmLimit !== undefined) updateData.kmLimit = parseInt(kmLimit);
    if (description !== undefined) updateData.description = description;
    if (features !== undefined) updateData.features = features;
    if (locationId !== undefined) updateData.locationId = locationId;
    if (pricingSlabs !== undefined) updateData.pricingSlabs = pricingSlabs;
    if (weekendSurgeMultiplier !== undefined) updateData.weekendSurgeMultiplier = parseFloat(weekendSurgeMultiplier);
    if (gstPercentage !== undefined) updateData.gstPercentage = parseFloat(gstPercentage);
    if (available !== undefined) updateData.available = available;
    // New simple pricing model fields
    if (price12Hours !== undefined) updateData.price12Hours = price12Hours ? parseFloat(price12Hours) : null;
    if (pricePerHourOver12 !== undefined) updateData.pricePerHourOver12 = pricePerHourOver12 ? parseFloat(pricePerHourOver12) : null;
    if (pricePerWeek !== undefined) updateData.pricePerWeek = pricePerWeek ? parseFloat(pricePerWeek) : null;
    if (pricePerHour13 !== undefined) updateData.pricePerHour13 = pricePerHour13 ? parseFloat(pricePerHour13) : null;
    if (pricePerHour14 !== undefined) updateData.pricePerHour14 = pricePerHour14 ? parseFloat(pricePerHour14) : null;
    if (pricePerHour15 !== undefined) updateData.pricePerHour15 = pricePerHour15 ? parseFloat(pricePerHour15) : null;
    if (pricePerHour16 !== undefined) updateData.pricePerHour16 = pricePerHour16 ? parseFloat(pricePerHour16) : null;
    if (pricePerHour17 !== undefined) updateData.pricePerHour17 = pricePerHour17 ? parseFloat(pricePerHour17) : null;
    if (pricePerHour18 !== undefined) updateData.pricePerHour18 = pricePerHour18 ? parseFloat(pricePerHour18) : null;
    if (pricePerHour19 !== undefined) updateData.pricePerHour19 = pricePerHour19 ? parseFloat(pricePerHour19) : null;
    if (pricePerHour20 !== undefined) updateData.pricePerHour20 = pricePerHour20 ? parseFloat(pricePerHour20) : null;
    if (pricePerHour21 !== undefined) updateData.pricePerHour21 = pricePerHour21 ? parseFloat(pricePerHour21) : null;
    if (pricePerHour22 !== undefined) updateData.pricePerHour22 = pricePerHour22 ? parseFloat(pricePerHour22) : null;
    if (pricePerHour23 !== undefined) updateData.pricePerHour23 = pricePerHour23 ? parseFloat(pricePerHour23) : null;
    if (pricePerHour24 !== undefined) updateData.pricePerHour24 = pricePerHour24 ? parseFloat(pricePerHour24) : null;
    // Tariff fields
    if (weekdayRate !== undefined) updateData.weekdayRate = weekdayRate ? parseFloat(weekdayRate) : null;
    if (weekendRate !== undefined) updateData.weekendRate = weekendRate ? parseFloat(weekendRate) : null;
    if (excessKmCharge !== undefined) updateData.excessKmCharge = excessKmCharge ? parseFloat(excessKmCharge) : null;
    if (kmLimitPerHour !== undefined) updateData.kmLimitPerHour = kmLimitPerHour ? parseFloat(kmLimitPerHour) : null;
    if (minBookingHours !== undefined) updateData.minBookingHours = minBookingHours ? parseFloat(minBookingHours) : null;

    const bike = await Bike.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }

    // Transform _id to id for frontend compatibility
    res.json(transformBike(bike));
  } catch (error) {
    console.error('Update bike error:', error);
    res.status(500).json({ message: 'Error updating bike' });
  }
});

// Delete bike (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const bike = await Bike.findByIdAndDelete(req.params.id);
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }

    res.json({ message: 'Bike deleted successfully' });
  } catch (error) {
    console.error('Delete bike error:', error);
    res.status(500).json({ message: 'Error deleting bike' });
  }
});

export default router;
