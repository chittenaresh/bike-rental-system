import mongoose from 'mongoose';

const supportReplySchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTicket',
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sentVia: {
    type: String,
    enum: ['email', 'system'],
    default: 'system'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const SupportReply = mongoose.model('SupportReply', supportReplySchema);

export default SupportReply;
