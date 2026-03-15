import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['aadhar_front', 'aadhar_back', 'pan', 'driving_license', 'license', 'id', 'other'], required: true },
  url: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: null },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  mobile: {
    type: String,
    default: '',
    trim: true,
    unique: true,
    sparse: true,
    validate: {
      validator: (v) => v === '' || /^[6-9]\d{9}$/.test(v),
      message: 'Invalid mobile number',
    },
  },
  emailVerified: { type: Boolean, default: false },
  mobileVerified: { type: Boolean, default: false },
  emailOTP: { type: String, default: null },
  emailOTPExpires: { type: Date, default: null },
  mobileOTP: { type: String, default: null },
  mobileOTPExpires: { type: Date, default: null },
  emergencyContact: {
    type: String,
    default: '',
    trim: true,
    validate: {
      validator: (v) => v === '' || /^[6-9]\d{9}$/.test(v),
      message: 'Invalid emergency contact number',
    },
  },
  familyContact: {
    type: String,
    default: '',
    trim: true,
    validate: {
      validator: (v) => v === '' || /^[6-9]\d{9}$/.test(v),
      message: 'Invalid family contact number',
    },
  },
  permanentAddress: { type: String, default: '' },
  currentAddress: { type: String, default: '' },
  currentLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  hotelStay: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
  walletBalance: { type: Number, default: 10 },
  isVerified: { type: Boolean, default: false },
  documents: [documentSchema],
  createdAt: { type: Date, default: Date.now },
  resetPasswordOTP: { type: String, default: null },
  resetPasswordOTPExpires: { type: Date, default: null }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$'))) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);

