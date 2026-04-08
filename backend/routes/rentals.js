import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth.js';
import Rental from '../models/Rental.js';
import Bike from '../models/Bike.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { transformRental } from '../utils/transform.js';
import { catchAsync } from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

const router = express.Router();

// Get all rentals
router.get('/', authenticateToken, catchAsync(async (req, res) => {
  const query = {};

  // For admin users, strictly enforce their assigned location
  if (req.user && req.user.role === 'admin' && req.user.locationId) {
    // We need to filter by bikeId.locationId
    const bikesAtLocation = await Bike.find({ locationId: req.user.locationId }).select('_id');
    const bikeIds = bikesAtLocation.map(b => b._id);
    query.bikeId = { $in: bikeIds };
  }

  const rentals = await Rental.find(query)
    .populate({
      path: 'bikeId',
      select: 'name type brand image pricePerHour kmLimit locationId excessKmCharge weekdayRate weekendRate',
      populate: { path: 'locationId', select: 'name city state' },
    })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });

  res.json(rentals.map(transformRental));
}));

// Get rental by ID (TEMP: DISABLED AUTH)
router.get('/:id', catchAsync(async (req, res) => {
  const rental = await Rental.findById(req.params.id)
    .populate({
      path: 'bikeId',
      populate: { path: 'locationId', select: 'name city state' },
    })
    .populate('userId', 'name email');

  if (!rental) throw new AppError('Rental not found', 404);

  res.json(transformRental(rental));
}));

// Create rental (TEMP: DISABLED AUTH)
router.post('/', catchAsync(async (req, res) => {
  const { bikeId, userId, startTime, endTime, totalAmount } = req.body;
  
  if (!bikeId || !startTime || !endTime || !userId) {
    throw new AppError('Required fields missing', 400);
  }

  const bike = await Bike.findById(bikeId);
  if (!bike) throw new AppError('Bike not found', 404);

  const newRental = new Rental({ 
    bikeId,
    userId,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    totalAmount,
    status: 'pending'
  });

  const savedRental = await newRental.save();
  
  // Mark bike as unavailable
  await Bike.findByIdAndUpdate(bikeId, { available: false });
  
  res.status(201).json(transformRental(savedRental));
}));

// Update rental status (TEMP: DISABLED AUTH)
router.patch('/:id/status', catchAsync(async (req, res) => {
  const { status, startKm, endKm, delay, totalCost } = req.body;
  const updates = { status };
  if (startKm !== undefined) updates.startKm = startKm;
  if (endKm !== undefined) updates.endKm = endKm;
  if (delay !== undefined) updates.delay = delay;
  if (totalCost !== undefined) updates.totalCost = totalCost;

  const rental = await Rental.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );

  if (!rental) throw new AppError('Rental not found', 404);
  
  // If completed or cancelled, make bike available again
  if (status === 'completed' || status === 'cancelled') {
    await Bike.findByIdAndUpdate(rental.bikeId, { available: true, status: 'available' });
  }
  
  res.json(transformRental(rental));
}));

// Cancel rental
router.post('/:id/cancel', catchAsync(async (req, res) => {
  const rental = await Rental.findById(req.params.id);
  if (!rental) throw new AppError('Rental not found', 404);

  if (['ongoing', 'completed', 'cancelled'].includes(rental.status)) {
    throw new AppError(`Cannot cancel a ride that is already ${rental.status}`, 400);
  }

  rental.status = 'cancelled';
  await rental.save();

  // Make bike available again
  await Bike.findByIdAndUpdate(rental.bikeId, { available: true, status: 'available' });

  res.json(transformRental(rental));
}));

// Start ride
router.post('/:id/start', catchAsync(async (req, res) => {
  const rental = await Rental.findById(req.params.id);
  if (!rental) throw new AppError('Rental not found', 404);

  if (rental.status !== 'confirmed') {
    throw new AppError('Ride must be confirmed before starting', 400);
  }

  rental.status = 'ongoing';
  rental.pickupTime = new Date();
  await rental.save();

  res.json(transformRental(rental));
}));

// Complete ride (Alternative endpoint used by frontend)
router.post('/:id/complete', catchAsync(async (req, res) => {
  const { endKm, delay, totalCost } = req.body;
  const rental = await Rental.findById(req.params.id);
  if (!rental) throw new AppError('Rental not found', 404);

  if (rental.status !== 'ongoing') {
    throw new AppError('Ride must be ongoing before completing', 400);
  }

  rental.status = 'completed';
  rental.dropoffTime = new Date();
  if (endKm) rental.endKm = endKm;
  if (delay) rental.delay = delay;
  if (totalCost) rental.totalCost = totalCost;
  
  await rental.save();

  // Make bike available again
  await Bike.findByIdAndUpdate(rental.bikeId, { available: true, status: 'available' });

  res.json(transformRental(rental));
}));

// Submit review
router.post('/:id/review', catchAsync(async (req, res) => {
  const { rating, comment } = req.body;
  const rental = await Rental.findById(req.params.id);
  if (!rental) throw new AppError('Rental not found', 404);

  if (rental.status !== 'completed') {
    throw new AppError('Can only review completed rides', 400);
  }

  const review = new Review({
    rentalId: rental._id,
    userId: rental.userId,
    bikeId: rental.bikeId,
    rating,
    comment
  });

  await review.save();
  res.status(201).json(review);
}));

// Update ride images
router.post('/:id/images', catchAsync(async (req, res) => {
  const { images } = req.body;
  const rental = await Rental.findByIdAndUpdate(
    req.params.id,
    { userImages: images },
    { new: true }
  );

  if (!rental) throw new AppError('Rental not found', 404);
  res.json(transformRental(rental));
}));

export default router;   