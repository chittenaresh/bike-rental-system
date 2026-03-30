import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth.js';
import Rental from '../models/Rental.js';
import Bike from '../models/Bike.js';
import User from '../models/User.js';
import { transformRental } from '../utils/transform.js';
import { catchAsync } from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';

const router = express.Router();

// Get all rentals (user sees their own, admin sees all)
router.get('/', authenticateToken, catchAsync(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) throw new AppError('User not found', 404);

  let query = {};
  if (!['admin', 'superadmin'].includes(user.role)) {
    query.userId = req.user.userId;
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

// Get rental by ID
router.get('/:id', authenticateToken, catchAsync(async (req, res) => {
  const rental = await Rental.findById(req.params.id)
    .populate({
      path: 'bikeId',
      populate: { path: 'locationId', select: 'name city state' },
    })
    .populate('userId', 'name email');

  if (!rental) throw new AppError('Rental not found', 404);

  const user = await User.findById(req.user.userId);
  if (!user) throw new AppError('User not found', 404);

  if (!['admin', 'superadmin'].includes(user.role) && rental.userId._id.toString() !== req.user.userId) {
    throw new AppError('Access denied', 403);
  }

  res.json(transformRental(rental));
}));

// Create rental
router.post('/', authenticateToken, catchAsync(async (req, res) => {
  const { bikeId, startTime, endTime, totalAmount } = req.body;
  
  if (!bikeId || !startTime || !endTime) {
    throw new AppError('Required fields missing', 400);
  }

  const bike = await Bike.findById(bikeId);
  if (!bike) throw new AppError('Bike not found', 404);

  const newRental = new Rental({ 
    bikeId,
    userId: req.user.userId,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    totalAmount,
    status: 'pending'
  });

  const savedRental = await newRental.save();
  res.status(201).json(transformRental(savedRental));
}));

// Update rental status (admin only)
router.patch('/:id/status', authenticateToken, authorize(['admin', 'superadmin']), catchAsync(async (req, res) => {
  const { status } = req.body;
  const rental = await Rental.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!rental) throw new AppError('Rental not found', 404);
  res.json(transformRental(rental));
}));

export default router;
