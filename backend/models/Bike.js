import mongoose from 'mongoose';

const pricingSlabSchema = new mongoose.Schema({
  price: { type: Number, required: true },
  duration_min: { type: Number, required: true }, // in hours
  duration_max: { type: Number, required: true }, // in hours
  included_km: { type: Number, required: true },
  extra_km_price: { type: Number, required: true, default: 0 },
  minimum_booking_rule: { type: String, enum: ['none', 'min_duration', 'min_price'], default: 'none' },
  minimum_value: { type: Number, default: 0 }, // min duration in hours or min price
}, { _id: false });

const bikeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['fuel', 'electric', 'scooter'], required: true },
  category: { type: String, enum: ['budget', 'midrange', 'topend'], default: 'midrange' },
  brand: { type: String, default: '' },
  year: { type: Number },
  image: { type: String, default: '/bikes/default.jpg' },
  images: [{ type: String }],
  // Legacy fields for backward compatibility
  pricePerHour: { type: Number },
  // New pricing fields
  price12Hours: { type: Number },
  pricePerWeek: { type: Number },
  
  // Tariff Configuration
  weekdayRate: { type: Number }, // Mon-Thu hourly rate
  weekendRate: { type: Number }, // Fri-Sun hourly rate
  excessKmCharge: { type: Number },
  kmLimitPerHour: { type: Number },
  minBookingHours: { type: Number, default: 0 },

  kmLimit: { type: Number },
  // New pricing model
  pricingSlabs: {
    hourly: { type: pricingSlabSchema },
    daily: { type: pricingSlabSchema },
    weekly: { type: pricingSlabSchema },
  },
  available: { type: Boolean, default: true },
  status: { type: String, enum: ['available', 'maintenance', 'disabled'], default: 'available' },
  description: { type: String, default: '' },
  features: [{ type: String }],
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
  },
  // Weekend surge pricing multiplier (configurable per bike or global)
  weekendSurgeMultiplier: { type: Number, default: 1.0, min: 1.0 },
  // GST percentage (can be overridden per bike, defaults to 18%)
  gstPercentage: { type: Number, default: 18.0, min: 0, max: 100 },
}, { timestamps: true });

// Add indexes for performance
bikeSchema.index({ locationId: 1 });
bikeSchema.index({ status: 1 });
bikeSchema.index({ type: 1 });
bikeSchema.index({ category: 1 });

export default mongoose.model('Bike', bikeSchema);

