import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { transformUser } from '../utils/transform.js';
import Location from '../models/Location.js';

const router = express.Router();

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!['admin', 'superadmin'].includes(currentUser.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    let query = {};
    if (currentUser.role === 'admin' && currentUser.locationId) {
      try {
        const loc = await Location.findById(currentUser.locationId).select('city');
        if (loc?.city) {
          const cityRegex = new RegExp(`^${escapeRegex(loc.city)}(\\b|\\s|\\s-| -)?`, 'i');
          query.$or = [
            { currentLocationId: currentUser.locationId },
            { currentAddress: cityRegex },
          ];
        } else {
          query.currentLocationId = currentUser.locationId;
        }
      } catch {
        query.currentLocationId = currentUser.locationId;
      }
    }

    const users = await User.find(query).select('-password');
    // Transform _id to id for frontend compatibility
    const transformedUsers = users.map(transformUser);
    res.json(transformedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['admin', 'superadmin'].includes(currentUser.role) && req.params.id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Transform _id to id for frontend compatibility
    res.json(transformUser(targetUser));
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// Update user
  router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['admin', 'superadmin'].includes(currentUser.role) && req.params.id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { 
      name, 
      email, 
      password, 
      walletBalance,
      mobile,
      emergencyContact,
      familyContact,
      permanentAddress,
      currentAddress,
      currentLocationId,
      hotelStay,
      isVerified,
      role,
      locationId
    } = req.body;

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (mobile !== undefined) user.mobile = mobile;
    if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;
    if (familyContact !== undefined) user.familyContact = familyContact;
    if (permanentAddress !== undefined) user.permanentAddress = permanentAddress;
    if (currentAddress !== undefined) user.currentAddress = currentAddress;
    if (currentLocationId !== undefined) {
      if (currentLocationId) {
        const exists = await Location.findById(currentLocationId).select('_id');
        if (!exists) {
          return res.status(400).json({ message: 'Invalid current location' });
        }
        user.currentLocationId = currentLocationId;
      } else {
        user.currentLocationId = null;
      }
    }
    if (hotelStay !== undefined) user.hotelStay = hotelStay;
    if (walletBalance !== undefined && ['admin', 'superadmin'].includes(currentUser.role)) {
      user.walletBalance = parseFloat(walletBalance);
    }
    if (isVerified !== undefined && ['admin', 'superadmin'].includes(currentUser.role)) {
      user.isVerified = Boolean(isVerified);
    }
    if (role !== undefined) {
      if (currentUser.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only superadmin can change roles' });
      }
      const allowedRoles = ['user', 'admin'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      user.role = role;
    }

    if (locationId !== undefined) {
      if (currentUser.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only superadmin can assign location' });
      }
      if (locationId) {
        const exists = await Location.findById(locationId);
        if (!exists) {
          return res.status(400).json({ message: 'Invalid location' });
        }
        const nextRole = role !== undefined ? role : user.role;
        if (nextRole === 'admin') {
          const cityRegex = new RegExp(`^${escapeRegex(exists.city)}$`, 'i');
          const cityLocations = await Location.find({ city: cityRegex }).select('_id');
          const cityLocationIds = cityLocations.map((l) => l._id);
          if (cityLocationIds.length > 0) {
            const otherAdmin = await User.findOne({
              role: 'admin',
              _id: { $ne: user._id },
              locationId: { $in: cityLocationIds },
            }).select('_id');
            if (otherAdmin) {
              return res.status(400).json({ message: 'An admin already exists for this city' });
            }
          }
        }
        user.locationId = locationId;
      } else {
        user.locationId = null;
      }
    }

    // Update password separately if provided (before saving other fields)
    if (password) {
      // Validate password length
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      // Ensure superadmin or admin can update passwords
      if (!['admin', 'superadmin'].includes(currentUser.role)) {
        return res.status(403).json({ message: 'Only admin or superadmin can update passwords' });
      }
      // Hash the password directly
      const hashedPassword = await bcrypt.hash(password, 10);
      // Use updateOne to directly update the password in the database
      // This bypasses the pre-save hook and ensures the password is saved correctly
      const updateResult = await User.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });
      if (updateResult.modifiedCount === 0) {
        console.error('Password update failed - no documents modified');
      }
    }
    
    // Save other fields
    await user.save();
    
    // Reload the user from database to ensure we have the latest data
    const updatedUser = await User.findById(user._id);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found after update' });
    }
    // Transform _id to id for frontend compatibility
    res.json(transformUser(updatedUser));
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Top up wallet
router.post('/:id/wallet/topup', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    const currentUser = await User.findById(req.user.userId);
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['admin', 'superadmin'].includes(currentUser.role) && req.params.id !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    user.walletBalance += parseFloat(amount);
    await user.save();

    // Transform _id to id for frontend compatibility
    res.json(transformUser(user));
  } catch (error) {
    console.error('Top up error:', error);
    res.status(500).json({ message: 'Error topping up wallet' });
  }
});

// Delete user (superadmin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser || currentUser.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access required' });
    }

    if (req.params.id === req.user.userId) {
      return res.status(400).json({ message: 'Cannot delete current user' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.role === 'superadmin') {
      return res.status(400).json({ message: 'Cannot delete superadmin' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Create admin (superadmin only)
router.post('/create-admin', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser || currentUser.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access required' });
    }
    const { name, email, password, locationId } = req.body;
    if (!name || !email || !password || !locationId) {
      return res.status(400).json({ message: 'Name, email, password and location are required' });
    }
    const loc = await Location.findById(locationId);
    if (!loc) {
      return res.status(400).json({ message: 'Invalid location' });
    }
    const cityRegex = new RegExp(`^${escapeRegex(loc.city)}$`, 'i');
    const cityLocations = await Location.find({ city: cityRegex }).select('_id');
    const cityLocationIds = cityLocations.map((l) => l._id);
    if (cityLocationIds.length > 0) {
      const existingCityAdmin = await User.findOne({
        role: 'admin',
        locationId: { $in: cityLocationIds },
      }).select('_id');
      if (existingCityAdmin) {
        return res.status(400).json({ message: 'An admin already exists for this city' });
      }
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const newUser = new User({
      email,
      name,
      password,
      role: 'admin',
      locationId,
      walletBalance: 10,
      documents: [],
    });
    await newUser.save();
    res.status(201).json(transformUser(newUser));
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Error creating admin' });
  }
});

export default router;
