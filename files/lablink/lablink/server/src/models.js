import mongoose from 'mongoose';
const { Schema, model } = mongoose;

export const User = model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student' },
  department: String,
}, { timestamps: true }));

export const Resource = model('Resource', new Schema({
  name: { type: String, required: true },
  category: String,            // Development Kit, Instrument, Software, Computing, Fabrication...
  department: String,
  lab: String,
  location: String,
  description: String,
  specs: [String],
  tags: [String],
  total: { type: Number, default: 1 },
  available: { type: Number, default: 1 },
  status: { type: String, enum: ['active', 'maintenance'], default: 'active' },
  recommendations: [{ by: String, note: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true }));

export const Booking = model('Booking', new Schema({
  resource: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: Date,
  endDate: Date,
  purpose: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'pending' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }));
