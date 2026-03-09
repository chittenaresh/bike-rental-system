import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for guest contact
  },
  guestName: String,
  guestEmail: String,
  senderRole: {
    type: String,
    enum: ['user', 'admin', 'superadmin', 'guest'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  attachments: [{
    type: String // URLs to images
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const supportTicketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for guest contact
  },
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: false
  },
  guestName: String,
  guestEmail: String,
  rentalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rental'
  },
  subject: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['breakdown', 'accident', 'damage', 'other', 'contact'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'replied', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

supportTicketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket;
