import express from 'express';
import { authenticateToken } from './auth.js';
import Rental from '../models/Rental.js';
import Bike from '../models/Bike.js';
import User from '../models/User.js';
import { transformRental } from '../utils/transform.js';

const router = express.Router();

// Get all rentals (user sees their own, admin sees all)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
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

    // Transform _id to id for frontend compatibility
    const transformedRentals = rentals.map(transformRental);
    res.json(transformedRentals);
  } catch (error) {
    console.error('Get rentals error:', error);
    res.status(500).json({ message: 'Error fetching rentals' });
  }
});

// Get rental by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id)
      .populate({
        path: 'bikeId',
        populate: { path: 'locationId', select: 'name city state' },
      })
      .populate('userId', 'name email');

    if (!rental) {
      return res.status(404).json({ message: 'Rental not found' });
    }

    const user = await User.findById(req.user.userId);
    if (!['admin', 'superadmin'].includes(user.role) && rental.userId._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Transform _id to id for frontend compatibility
    res.json(transformRental(rental));
  } catch (error) {
    console.error('Get rental error:', error);
    res.status(500).json({ message: 'Error fetching rental' });
  }
});

// Update rental (for extending rides) - must be before specific POST routes
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('PUT /rentals/:id called with id:', req.params.id);
    console.log('Request body:', req.body);
    
    const rental = await Rental.findById(req.params.id);
    if (!rental) {
      console.log('Rental not found:', req.params.id);
      return res.status(404).json({ message: 'Rental not found' });
    }
    
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Users can only update their own rentals, admins can update any
    const rentalUserId = rental.userId.toString();
    const currentUserId = req.user.userId.toString();
    
    if (!['admin', 'superadmin'].includes(currentUser.role) && rentalUserId !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Only allow updating dropoffTime for ongoing/active rentals
    if (rental.status !== 'ongoing' && rental.status !== 'active' && rental.status !== 'confirmed') {
      return res.status(400).json({ message: 'Can only update ongoing, active, or confirmed rentals' });
    }
    
    // Update dropoffTime if provided
    if (req.body.dropoffTime) {
      rental.dropoffTime = new Date(req.body.dropoffTime);
      await rental.save();
      
      console.log('Rental dropoffTime updated successfully');
      
      // Return transformed rental
      const updatedRental = await Rental.findById(req.params.id)
        .populate({
          path: 'bikeId',
          select: 'name type brand image pricePerHour kmLimit locationId',
          populate: { path: 'locationId', select: 'name city state' },
        })
        .populate('userId', 'name email');
      
      res.json(transformRental(updatedRental));
    } else {
      return res.status(400).json({ message: 'dropoffTime is required' });
    }
  } catch (error) {
    console.error('Update rental error:', error);
    res.status(500).json({ message: 'Error updating rental', error: error.message });
  }
});

// Create rental
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { bikeId, startTime } = req.body;

    if (!bikeId) {
      return res.status(400).json({ message: 'Bike ID is required' });
    }

    const bike = await Bike.findById(bikeId);
    if (!bike) {
      return res.status(404).json({ message: 'Bike not found' });
    }

    if (!bike.available) {
      return res.status(400).json({ message: 'Bike is not available' });
    }

    // Check if user has active/confirmed rental
    const activeRental = await Rental.findOne({
      userId: req.user.userId,
      status: { $in: ['confirmed', 'ongoing'] },
    });

    if (activeRental) {
      return res.status(400).json({ message: 'You already have an active rental' });
    }

    // Check user wallet balance
    const user = await User.findById(req.user.userId);
    if (user.walletBalance < bike.pricePerHour) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Create rental
    const newRental = new Rental({
      bikeId,
      userId: req.user.userId,
      startTime: startTime || new Date(),
      status: 'ongoing'
    });

    await newRental.save();
    
    // Update bike availability
    bike.available = false;
    await bike.save();

    res.status(201).json(transformRental(newRental));
  } catch (error) {
    console.error('Create rental error:', error);
    res.status(500).json({ message: 'Error creating rental' });
  }
});

router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id);
    if (!rental) return res.status(404).json({ message: 'Rental not found' });
    
    // Only the user who booked the rental can start the ride
    const currentUser = await User.findById(req.user.userId);
    if (!['admin', 'superadmin'].includes(currentUser.role) && rental.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the user who booked can start the ride' });
    }

    if (rental.status !== 'confirmed') {
      return res.status(400).json({ message: `Cannot start ride. Current status is ${rental.status}` });
    }

    // Require bike condition images before starting
    if (!Array.isArray(rental.userImages) || rental.userImages.length < 5) {
      return res.status(400).json({ message: 'Please upload at least 5 bike condition images before starting your ride.' });
    }

    rental.status = 'ongoing';
    rental.startTime = new Date(); // Reset start time to actual ride start time
    await rental.save();
    
    res.json(transformRental(rental));
  } catch (error) {
    console.error('Start ride error:', error);
    res.status(500).json({ message: 'Error starting ride' });
  }
});

router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id);
    if (!rental) return res.status(404).json({ message: 'Rental not found' });
    
    // Allow completing rides from 'ongoing', 'active', or 'confirmed' statuses
    if (rental.status !== 'ongoing' && rental.status !== 'active' && rental.status !== 'confirmed') {
      return res.status(400).json({ 
        message: `Rental status is '${rental.status}'. Only ongoing, active, or confirmed rentals can be completed.` 
      });
    }

    const { startKm, endKm, delay, totalCost } = req.body;
    if (startKm) rental.startKm = startKm;
    if (endKm) rental.endKm = endKm;
    if (delay) rental.delay = delay;
    if (totalCost) rental.totalCost = totalCost;

    rental.status = 'completed';
    rental.endTime = new Date();
    if (!rental.dropoffTime) {
      rental.dropoffTime = new Date();
    }
    await rental.save();
    
    const bike = await Bike.findById(rental.bikeId);
    if (bike) {
      bike.available = true;
      await bike.save();
    }

    res.json(rental);
  } catch (error) {
    console.error('Complete ride error:', error);
    res.status(500).json({ message: 'Error completing ride' });
  }
});

router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id);
    if (!rental) return res.status(404).json({ message: 'Rental not found' });
    
    const currentUser = await User.findById(req.user.userId);
    // Allow admins/superadmins to cancel any rental, users can only cancel their own
    if (!['admin', 'superadmin'].includes(currentUser.role) && rental.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (rental.status !== 'confirmed') return res.status(400).json({ message: 'Cannot cancel this rental' });

    rental.status = 'cancelled';
    await rental.save();
    
    // Make bike available again
    const bike = await Bike.findById(rental.bikeId);
    if (bike) {
      bike.available = true;
      await bike.save();
    }
    
    res.json({ message: 'Rental cancelled', rental });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling rental' });
  }
});

// Delete rental (admin/superadmin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!['admin', 'superadmin'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const rental = await Rental.findById(req.params.id);
    if (!rental) return res.status(404).json({ message: 'Rental not found' });

    // Make bike available again if rental is active
    if (rental.status === 'ongoing' || rental.status === 'active' || rental.status === 'confirmed') {
      const bike = await Bike.findById(rental.bikeId);
      if (bike) {
        bike.available = true;
        await bike.save();
      }
    }

    await Rental.findByIdAndDelete(req.params.id);
    res.json({ message: 'Rental deleted successfully' });
  } catch (error) {
    console.error('Delete rental error:', error);
    res.status(500).json({ message: 'Error deleting rental' });
  }
});

router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const rental = await Rental.findById(req.params.id);
    
    if (!rental) return res.status(404).json({ message: 'Rental not found' });
    if (rental.userId.toString() !== req.user.userId) return res.status(403).json({ message: 'Access denied' });
    if (rental.status !== 'completed') return res.status(400).json({ message: 'Rental must be completed to review' });

    const review = new Review({
      rentalId: rental._id,
      userId: req.user.userId,
      bikeId: rental.bikeId,
      rating,
      comment
    });

    await review.save();
    res.json(review);
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ message: 'Error submitting review' });
  }
});

router.post('/:id/images', authenticateToken, async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images)) {
      return res.status(400).json({ message: 'Images must be an array' });
    }

    const rental = await Rental.findById(req.params.id);
    if (!rental) return res.status(404).json({ message: 'Rental not found' });
    
    // Only allow users to update their own rentals, admins can update any
    if (!['admin', 'superadmin'].includes(req.user.role) && rental.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    rental.userImages = images;
    await rental.save();
    res.json({ success: true, userImages: rental.userImages });
  } catch (error) {
    console.error('Update images error:', error);
    res.status(500).json({ message: 'Error updating rental images' });
  }
});

export default router;
