import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import Rental from '../models/Rental.js';
import Bike from '../models/Bike.js';
import { transformRental } from '../utils/transform.js';
import User from '../models/User.js';

const router = express.Router();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getRazorpayInstance() {
  const key_id = requireEnv('RAZORPAY_KEY_ID');
  const key_secret = requireEnv('RAZORPAY_KEY_SECRET');
  return new Razorpay({ key_id, key_secret });
}

function generateBookingId() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `RF-BK-${n}`;
}

router.get('/key', authenticateToken, (req, res) => {
  try {
    const keyId = requireEnv('RAZORPAY_KEY_ID');
    res.json({ keyId });
  } catch (error) {
    const message = error?.message?.includes('RAZORPAY_KEY_')
      ? 'Payment gateway not configured'
      : 'Failed to load payment key';
    res.status(500).json({ message });
  }
});

router.post('/order', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    // Check if user has active/confirmed rental
    const activeRental = await Rental.findOne({
      userId: req.user.userId,
      status: { $in: ['confirmed', 'ongoing'] },
    });

    if (activeRental) {
      return res.status(400).json({ message: 'You already have an active rental. Please complete it before booking another.' });
    }

    const instance = getRazorpayInstance();
    const order = await instance.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });
    res.json(order);
  } catch (error) {
    const message = error?.message?.includes('RAZORPAY_KEY_')
      ? 'Payment gateway not configured'
      : 'Failed to create order';
    res.status(500).json({ message });
  }
});

router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingDetails } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment fields' });
    }
    const keySecret = requireEnv('RAZORPAY_KEY_SECRET');
    const hmac = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (hmac !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Signature mismatch' });
    }
    const { bikeId, pickupTime, dropoffTime, totalAmount, pricingType = 'hourly', selectedLocationId, additionalImages } = bookingDetails || {};
    const bike = await Bike.findById(bikeId).populate('locationId');
    if (!bike) return res.status(404).json({ success: false, message: 'Bike not found' });
    
    // Validate bike location matches selected location
    if (selectedLocationId) {
      const bikeLocationId = typeof bike.locationId === 'object' 
        ? (bike.locationId?._id?.toString() || bike.locationId?.id?.toString() || bike.locationId?.toString?.())
        : bike.locationId?.toString?.();
      
      if (bikeLocationId !== selectedLocationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'This bike is not available in your selected location. Please select a bike from your location.' 
        });
      }
    }
    
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    if (selectedLocationId && user.currentLocationId && user.currentLocationId.toString() !== String(selectedLocationId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Selected location must match your current location in profile.' 
      });
    }

    // Check if user has active/confirmed rental
    const activeRental = await Rental.findOne({
      userId: req.user.userId,
      status: { $in: ['confirmed', 'ongoing'] },
    });

    if (activeRental) {
      return res.status(400).json({ success: false, message: 'You already have an active rental. Please complete it before booking another.' });
    }

    // Check if bike is still available
    if (!bike.available) {
      return res.status(400).json({ success: false, message: 'This bike is no longer available.' });
    }

    // Check if all documents are verified
    const hasDocuments = user.documents && user.documents.length > 0;
    if (!hasDocuments) {
      return res.status(400).json({ success: false, message: 'Please upload and verify all required documents before booking a ride.' });
    }

    const allApproved = user.documents.every(doc => doc.status === 'approved');
    if (!allApproved) {
      const pendingCount = user.documents.filter(doc => doc.status !== 'approved').length;
      return res.status(400).json({ 
        success: false, 
        message: `You have ${pendingCount} document(s) pending verification. Please wait for admin approval before booking.` 
      });
    }

    let bookingId = generateBookingId();
    let existing = await Rental.findOne({ bookingId });
    if (existing) {
      bookingId = generateBookingId();
    }

    const rental = new Rental({
      bikeId: bike._id,
      userId: user._id,
      startTime: new Date(pickupTime || Date.now()),
      status: 'confirmed',
      bookingId,
      pickupTime: pickupTime ? new Date(pickupTime) : undefined,
      dropoffTime: dropoffTime ? new Date(dropoffTime) : undefined,
      totalAmount: totalAmount,
      paymentStatus: 'paid',
      paymentInfo: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
      userImages: additionalImages || []
    });
    await rental.save();
    bike.available = false;
    await bike.save();
    res.json({ success: true, rental: transformRental(rental) });
  } catch (error) {
    const message = error?.message?.includes('RAZORPAY_KEY_')
      ? 'Payment gateway not configured'
      : 'Payment verification failed';
    res.status(500).json({ success: false, message });
  }
});

export default router;
