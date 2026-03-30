import mongoose from 'mongoose';

const rentalSchema = new mongoose.Schema({
  bikeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  totalCost: { type: Number },
  status: { type: String, enum: ['pending', 'confirmed', 'ongoing', 'completed', 'cancelled'], default: 'pending' },
  bookingId: { type: String, unique: true },
  pickupTime: { type: Date },
  dropoffTime: { type: Date },
  totalAmount: { type: Number },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentInfo: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String
  },
  userImages: [{ type: String }],
  startKm: { type: Number },
  endKm: { type: Number },
  delay: { type: Number, default: 0 },
  reminderSent: { type: Boolean, default: false }
}, { timestamps: true });

// Add indexes for performance
rentalSchema.index({ userId: 1 });
rentalSchema.index({ bikeId: 1 });
rentalSchema.index({ status: 1 });
rentalSchema.index({ startTime: -1 }); // Often queried for sorting

export default mongoose.model('Rental', rentalSchema);





