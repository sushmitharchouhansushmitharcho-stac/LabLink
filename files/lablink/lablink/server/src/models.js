import mongoose from 'mongoose';
import { QUESTION_CATEGORY_IDS } from './questionCategories.js';
const { Schema, model } = mongoose;
export const USER_ROLES = ['student', 'facultyCoordinator', 'labInCharge', 'dean', 'admin'];
export const QUERY_CATEGORIES = [
  'medical-lab', 'practical-experiment', 'equipment', 'academic',
  'faculty-support', 'technical-support', 'general',
];
export const QUERY_STATUSES = ['submitted', 'under-review', 'assigned', 'in-progress', 'resolved', 'rejected'];

export const User = model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: USER_ROLES.concat('faculty'), default: 'student' },
  department: String,
  designation: { type: String, maxlength: 120 },
  phone: { type: String, maxlength: 32 },
  studentId: { type: String, maxlength: 80 },
  academicYear: { type: String, maxlength: 40 },
  semester: { type: String, maxlength: 40 },
  section: { type: String, maxlength: 40 },
  profileImage: { type: String, maxlength: 500 },
  active: { type: Boolean, default: true },
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
  allocatedUnit: { type: Number, min: 0 },
}, { timestamps: true }));

export const BookingSlot = model('BookingSlot', new Schema({
  resource: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
  dateKey: { type: String, required: true },
  unit: { type: Number, min: 0, required: true },
  booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
}, { timestamps: true }).index({ resource: 1, dateKey: 1, unit: 1 }, { unique: true }));

const Answer = new Schema({
  body: { type: String, required: true, trim: true, maxlength: 4000 },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Question = model('Question', new Schema({
  title: { type: String, required: true, trim: true, minlength: 8, maxlength: 140 },
  body: { type: String, required: true, trim: true, minlength: 15, maxlength: 6000 },
  category: { type: String, enum: QUESTION_CATEGORY_IDS, required: true, index: true },
  tags: { type: [String], default: [] },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  answers: { type: [Answer], default: [] },
  answerCount: { type: Number, default: 0 },
}, { timestamps: true }).index({ createdAt: -1 }).index({ answerCount: -1, createdAt: -1 }));

const QueryResponse = new Schema({
  body: { type: String, required: true, trim: true, minlength: 3, maxlength: 4000 },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export const StudentQuery = model('StudentQuery', new Schema({
  title: { type: String, required: true, trim: true, minlength: 8, maxlength: 140 },
  description: { type: String, required: true, trim: true, minlength: 15, maxlength: 6000 },
  category: { type: String, enum: QUERY_CATEGORIES, required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: QUERY_STATUSES, default: 'submitted', index: true },
  responses: { type: [QueryResponse], default: [] },
}, { timestamps: true }).index({ createdAt: -1 }));

export const Laboratory = model('Laboratory', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  department: { type: String, required: true, trim: true, maxlength: 120 },
  roomNumber: { type: String, trim: true, maxlength: 80 },
  location: { type: String, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 1000 },
  inCharge: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true }));

export const LabSession = model('LabSession', new Schema({
  laboratory: { type: Schema.Types.ObjectId, ref: 'Laboratory', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  academicYear: { type: String, maxlength: 40 },
  section: { type: String, maxlength: 40 },
  notes: { type: String, trim: true, maxlength: 1000 },
  capacity: { type: Number, min: 0, default: 0 },
  bookedCount: { type: Number, min: 0, default: 0 },
  nextWaitlistPosition: { type: Number, min: 0, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true }).index({ startsAt: 1 }));

export const LabSessionReservation = model('LabSessionReservation', new Schema({
  session: { type: Schema.Types.ObjectId, ref: 'LabSession', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['booked', 'waitlisted', 'cancellation-requested', 'cancelled'], required: true },
  waitlistPosition: { type: Number, min: 1, default: null },
  cancellationRequestedAt: Date,
  attendanceStatus: { type: String, enum: ['unrecorded', 'attended', 'absent'], default: 'unrecorded' },
}, { timestamps: true }).index({ session: 1, student: 1 }, { unique: true }).index({ session: 1, status: 1, waitlistPosition: 1 }));

export const MaintenanceRecord = model('MaintenanceRecord', new Schema({
  resource: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  description: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
  status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open' },
  resolvedAt: Date,
}, { timestamps: true }).index({ status: 1, createdAt: -1 }));

export const Announcement = model('Announcement', new Schema({
  title: { type: String, required: true, trim: true, minlength: 4, maxlength: 160 },
  body: { type: String, required: true, trim: true, minlength: 5, maxlength: 5000 },
  audience: { type: [{ type: String, enum: USER_ROLES }], default: USER_ROLES },
  department: { type: String, trim: true, maxlength: 120 },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  important: { type: Boolean, default: false },
  expiresAt: Date,
}, { timestamps: true }).index({ createdAt: -1 }));

export const Notification = model('Notification', new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 160 },
  body: { type: String, required: true, maxlength: 1000 },
  type: { type: String, required: true, maxlength: 40 },
  link: { type: String, maxlength: 300 },
  readAt: Date,
}, { timestamps: true }).index({ recipient: 1, readAt: 1, createdAt: -1 }));
