import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  Announcement, Booking, LabSession, LabSessionReservation, Laboratory, MaintenanceRecord, Notification,
  QUERY_CATEGORIES, QUERY_STATUSES, Question, Resource, StudentQuery, USER_ROLES, User,
} from './models.js';
import { auth } from './auth.js';

const r = Router();
const fail = (status, message) => Object.assign(new Error(message), { status });
const queryCategories = [
  { id: 'medical-lab', name: 'Medical Laboratory Queries' },
  { id: 'practical-experiment', name: 'Practical and Experiment Queries' },
  { id: 'equipment', name: 'Equipment-Related Queries' },
  { id: 'academic', name: 'Academic Queries' },
  { id: 'faculty-support', name: 'Faculty Support' },
  { id: 'technical-support', name: 'Technical Support' },
  { id: 'general', name: 'General Queries' },
];
const userFields = 'name email role department designation phone studentId academicYear semester section profileImage active';
const queryPopulate = [
  { path: 'student', select: userFields },
  { path: 'assignedTo', select: userFields },
  { path: 'responses.author', select: 'name role department' },
];
const safeUser = (user) => ({
  id: user._id, name: user.name, email: user.email, role: user.role, department: user.department,
  designation: user.designation, phone: user.phone, studentId: user.studentId,
  academicYear: user.academicYear, semester: user.semester, section: user.section,
  profileImage: user.profileImage, active: user.active,
});
const validId = (id) => mongoose.isValidObjectId(id);
const notifyUsers = async (recipients, { title, body, type, link }) => {
  const ids = [...new Set(recipients.map((user) => String(user._id || user)))];
  if (ids.length) await Notification.insertMany(ids.map((recipient) => ({ recipient, title, body, type, link })));
};
const queryVisible = (query, user) => {
  if (user.role === 'student') return String(query.student?._id || query.student) === String(user._id);
  if (['admin', 'dean', 'facultyCoordinator'].includes(user.role)) return true;
  return user.role === 'labInCharge' && (
    String(query.assignedTo?._id || query.assignedTo || '') === String(user._id)
    || ['equipment', 'practical-experiment'].includes(query.category)
  );
};
const populateQuery = (query) => query.populate(queryPopulate);
const allowedProfileFields = new Set(['name', 'phone', 'designation', 'academicYear', 'semester', 'section']);
const assertLabScope = (session, user) => {
  if (user.role === 'labInCharge' && session.laboratory.department !== user.department) {
    throw fail(403, 'You can only manage sessions in your department');
  }
};
const promoteWaitlisted = async (sessionId) => {
  while (true) {
    const candidate = await LabSessionReservation.findOne({ session: sessionId, status: 'waitlisted' }).sort({ waitlistPosition: 1, createdAt: 1 });
    if (!candidate) return;
    const session = await LabSession.findOneAndUpdate(
      { _id: sessionId, startsAt: { $gt: new Date() }, $expr: { $lt: ['$bookedCount', '$capacity'] } },
      { $inc: { bookedCount: 1 } },
      { new: true },
    );
    if (!session) return;
    const promoted = await LabSessionReservation.findOneAndUpdate(
      { _id: candidate._id, status: 'waitlisted' },
      { $set: { status: 'booked', waitlistPosition: null } },
      { new: true },
    );
    if (!promoted) {
      await LabSession.updateOne({ _id: sessionId, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
      continue;
    }
    await notifyUsers([promoted.student], {
      title: 'Lab session seat available',
      body: `${session.title} · ${session.startsAt.toLocaleString()}`,
      type: 'session-booking',
      link: '/schedule',
    });
  }
};

r.get('/query-categories', auth(), (req, res) => res.json(queryCategories));
r.get('/staff/lab-in-charges', auth('facultyCoordinator', 'admin'), async (req, res) => {
  const staff = await User.find({ role: 'labInCharge', active: true }).select(userFields).sort('name');
  res.json(staff.map(safeUser));
});

r.get('/profile', auth(), (req, res) => res.json({ user: safeUser(req.user) }));
r.patch('/profile', auth(), async (req, res) => {
  const updates = req.body || {};
  const keys = Object.keys(updates);
  if (!keys.length || keys.some((key) => !allowedProfileFields.has(key))) {
    throw fail(400, 'Only name, phone, designation, academic year, semester and section may be updated here');
  }
  for (const key of keys) {
    if (typeof updates[key] !== 'string' || updates[key].trim().length > (key === 'name' ? 120 : 120)) {
      throw fail(400, `Invalid ${key}`);
    }
    if (key === 'name' && !updates[key].trim()) throw fail(400, 'Name cannot be empty');
    req.user[key] = updates[key].trim();
  }
  await req.user.save();
  res.json({ user: safeUser(req.user) });
});

r.get('/admin/users', auth('admin'), async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).select(userFields);
  res.json(users.map(safeUser));
});
r.post('/admin/users', auth('admin'), async (req, res) => {
  const { name, email, password, role, department, designation } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) throw fail(400, 'Enter a valid full name');
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw fail(400, 'Enter a valid email address');
  if (typeof password !== 'string' || password.length < 12) throw fail(400, 'Temporary password must be at least 12 characters');
  if (!USER_ROLES.includes(role)) throw fail(400, 'Choose a valid role');
  const user = await User.create({
    name: name.trim(), email: email.trim().toLowerCase(), password: await bcrypt.hash(password, 12),
    role, department: typeof department === 'string' ? department.trim() : '',
    designation: typeof designation === 'string' ? designation.trim() : '',
  });
  res.status(201).json(safeUser(user));
});
r.patch('/admin/users/:id', auth('admin'), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'User not found');
  const user = await User.findById(req.params.id);
  if (!user) throw fail(404, 'User not found');
  const { role, active } = req.body || {};
  if (role !== undefined && !USER_ROLES.includes(role)) throw fail(400, 'Choose a valid role');
  if (active !== undefined && typeof active !== 'boolean') throw fail(400, 'Active status must be true or false');
  if (String(user._id) === String(req.user._id) && (role && role !== 'admin' || active === false)) {
    throw fail(409, 'You cannot remove your own administrator access');
  }
  if (user.role === 'admin' && user.active && (role && role !== 'admin' || active === false)) {
    const admins = await User.countDocuments({ role: 'admin', active: true });
    if (admins <= 1) throw fail(409, 'At least one active administrator must remain');
  }
  if (role) user.role = role;
  if (active !== undefined) user.active = active;
  await user.save();
  res.json(safeUser(user));
});

r.get('/queries', auth(), async (req, res) => {
  const { category, status, mine } = req.query;
  if (category && !QUERY_CATEGORIES.includes(category)) throw fail(400, 'Choose a valid query category');
  if (status && !QUERY_STATUSES.includes(status)) throw fail(400, 'Choose a valid query status');
  const filter = {};
  if (req.user.role === 'student') filter.student = req.user._id;
  if (req.user.role === 'labInCharge') filter.$or = [{ assignedTo: req.user._id }, { category: { $in: ['equipment', 'practical-experiment'] } }];
  if (mine === 'true') filter.student = req.user._id;
  if (category) filter.category = category;
  if (status) filter.status = status;
  const queries = await populateQuery(StudentQuery.find(filter).sort({ createdAt: -1 }).limit(100));
  res.json(queries);
});
r.post('/queries', auth('student'), async (req, res) => {
  const { title, description, category } = req.body || {};
  if (typeof title !== 'string' || title.trim().length < 8 || title.trim().length > 140) throw fail(400, 'Title must be between 8 and 140 characters');
  if (typeof description !== 'string' || description.trim().length < 15 || description.trim().length > 6000) throw fail(400, 'Description must be between 15 and 6000 characters');
  if (!QUERY_CATEGORIES.includes(category)) throw fail(400, 'Choose a valid query category');
  const query = await StudentQuery.create({ title: title.trim(), description: description.trim(), category, student: req.user._id });
  await query.populate(queryPopulate);
  res.status(201).json(query);
});
r.get('/queries/:id', auth(), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Query not found');
  const query = await populateQuery(StudentQuery.findById(req.params.id));
  if (!query || !queryVisible(query, req.user)) throw fail(404, 'Query not found');
  res.json(query);
});
r.post('/queries/:id/responses', auth(), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Query not found');
  const query = await StudentQuery.findById(req.params.id);
  if (!query || !queryVisible(query, req.user)) throw fail(404, 'Query not found');
  const { body } = req.body || {};
  if (typeof body !== 'string' || body.trim().length < 3 || body.trim().length > 4000) throw fail(400, 'Response must be between 3 and 4000 characters');
  if (query.status === 'resolved' || query.status === 'rejected') throw fail(409, 'This query is closed');
  query.responses.push({ body: body.trim(), author: req.user._id });
  if (req.user.role === 'student' && query.status === 'submitted') query.status = 'under-review';
  await query.save();
  const notify = query.student.equals(req.user._id)
    ? query.assignedTo ? [query.assignedTo] : await User.find({ role: 'facultyCoordinator', active: true }).select('_id')
    : [query.student];
  await notifyUsers(notify, { title: 'Query response received', body: query.title, type: 'query-response', link: `/queries/${query._id}` });
  await query.populate(queryPopulate);
  res.status(201).json(query);
});
r.patch('/queries/:id/assign', auth('facultyCoordinator', 'admin'), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Query not found');
  const { assignedTo } = req.body || {};
  if (!validId(assignedTo)) throw fail(400, 'Choose a valid Lab In-Charge');
  const [query, assignee] = await Promise.all([
    StudentQuery.findById(req.params.id),
    User.findOne({ _id: assignedTo, role: 'labInCharge', active: true }),
  ]);
  if (!query) throw fail(404, 'Query not found');
  if (!assignee) throw fail(400, 'Selected user is not an active Lab In-Charge');
  query.assignedTo = assignee._id;
  if (query.status === 'submitted' || query.status === 'under-review') query.status = 'assigned';
  await query.save();
  await notifyUsers([assignee], { title: 'Query assigned to you', body: query.title, type: 'query-assigned', link: `/queries/${query._id}` });
  await query.populate(queryPopulate);
  res.json(query);
});
r.patch('/queries/:id/status', auth('facultyCoordinator', 'labInCharge', 'admin'), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Query not found');
  const { status } = req.body || {};
  if (!QUERY_STATUSES.includes(status)) throw fail(400, 'Choose a valid query status');
  const query = await StudentQuery.findById(req.params.id);
  if (!query) throw fail(404, 'Query not found');
  if (req.user.role === 'labInCharge' && !query.assignedTo?.equals(req.user._id)) throw fail(403, 'Only the assigned Lab In-Charge can update this query');
  if (req.user.role === 'labInCharge' && ['submitted', 'under-review', 'assigned'].includes(status)) throw fail(403, 'Lab In-Charges can move assigned queries to In Progress, Resolved, or Rejected');
  if (query.status === 'resolved' || query.status === 'rejected') throw fail(409, 'Closed queries cannot be changed');
  query.status = status;
  await query.save();
  await notifyUsers([query.student], { title: 'Query status updated', body: `${query.title}: ${status.replace('-', ' ')}`, type: 'query-status', link: `/queries/${query._id}` });
  await query.populate(queryPopulate);
  res.json(query);
});

r.get('/announcements', auth(), async (req, res) => {
  const filter = {
    audience: req.user.role,
    $or: [{ department: { $exists: false } }, { department: '' }, { department: req.user.department }],
    $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] }],
  };
  res.json(await Announcement.find(filter).populate('author', 'name role').sort({ important: -1, createdAt: -1 }).limit(50));
});
r.post('/announcements', auth('facultyCoordinator', 'labInCharge', 'dean', 'admin'), async (req, res) => {
  const { title, body, audience = ['student'], department, important = false, expiresAt } = req.body || {};
  if (typeof title !== 'string' || title.trim().length < 4 || title.trim().length > 160) throw fail(400, 'Title must be between 4 and 160 characters');
  if (typeof body !== 'string' || body.trim().length < 5 || body.trim().length > 5000) throw fail(400, 'Announcement must be between 5 and 5000 characters');
  if (!Array.isArray(audience) || audience.length < 1 || audience.some((role) => !USER_ROLES.includes(role))) throw fail(400, 'Choose valid announcement audiences');
  if (req.user.role === 'labInCharge' && audience.some((role) => !['student', 'labInCharge'].includes(role))) throw fail(403, 'Lab In-Charges may announce to students and Lab In-Charges');
  if (req.user.role === 'facultyCoordinator' && audience.some((role) => !['student', 'facultyCoordinator'].includes(role))) throw fail(403, 'Faculty Coordinators may announce to students and Faculty Coordinators');
  if (typeof important !== 'boolean') throw fail(400, 'Important must be true or false');
  const expiry = expiresAt ? new Date(expiresAt) : undefined;
  if (expiresAt && Number.isNaN(expiry.getTime())) throw fail(400, 'Enter a valid expiry date');
  const announcement = await Announcement.create({
    title: title.trim(), body: body.trim(), audience: [...new Set(audience)],
    department: typeof department === 'string' ? department.trim() : '',
    author: req.user._id, important, expiresAt: expiry,
  });
  const recipients = await User.find({
    active: true, role: { $in: announcement.audience },
    ...announcement.department ? { department: announcement.department } : {},
    _id: { $ne: req.user._id },
  }).select('_id');
  await notifyUsers(recipients, { title: announcement.title, body: announcement.body, type: 'announcement', link: '/announcements' });
  await announcement.populate('author', 'name role');
  res.status(201).json(announcement);
});

r.get('/notifications', auth(), async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ recipient: req.user._id, readAt: null }),
  ]);
  res.json({ items, unread });
});
r.patch('/notifications/read-all', auth(), async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});
r.patch('/notifications/:id/read', auth(), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Notification not found');
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!notification) throw fail(404, 'Notification not found');
  res.json(notification);
});

r.get('/student/activity', auth('student'), async (req, res) => {
  const daysByRange = { week: 7, month: 30, semester: 182 };
  const range = typeof req.query.range === 'string' ? req.query.range : 'week';
  if (!Object.hasOwn(daysByRange, range)) throw fail(400, 'Choose week, month or semester');
  const timeZone = typeof req.query.timeZone === 'string' ? req.query.timeZone : 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone }).format(new Date()); }
  catch { throw fail(400, 'Choose a valid time zone'); }
  const start = new Date(Date.now() - daysByRange[range] * 86400000);
  const dateGroup = (model, match) => model.aggregate([
    { $match: { ...match, createdAt: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone } }, count: { $sum: 1 } } },
  ]);
  const [bookings, queries, questions, attendanceByDay, attendance, lifetime] = await Promise.all([
    dateGroup(Booking, { user: req.user._id }),
    dateGroup(StudentQuery, { student: req.user._id }),
    dateGroup(Question, { author: req.user._id }),
    LabSessionReservation.aggregate([
      { $match: { student: req.user._id, attendanceStatus: 'attended' } },
      { $lookup: { from: LabSession.collection.name, localField: 'session', foreignField: '_id', as: 'session' } },
      { $unwind: '$session' },
      { $match: { 'session.startsAt': { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$session.startsAt', timezone: timeZone } }, count: { $sum: 1 } } },
    ]),
    LabSessionReservation.aggregate([
      { $match: { student: req.user._id, attendanceStatus: { $in: ['attended', 'absent'] } } },
      { $group: { _id: '$attendanceStatus', count: { $sum: 1 } } },
    ]),
    Promise.all([
      Booking.countDocuments({ user: req.user._id }),
      StudentQuery.countDocuments({ student: req.user._id }),
      Question.countDocuments({ author: req.user._id }),
    ]),
  ]);
  const timeline = {};
  const addCounts = (rows, key) => rows.forEach((row) => {
    timeline[row._id] ||= { bookings: 0, queries: 0, questions: 0, practicals: 0 };
    timeline[row._id][key] = row.count;
  });
  addCounts(bookings, 'bookings');
  addCounts(queries, 'queries');
  addCounts(questions, 'questions');
  addCounts(attendanceByDay, 'practicals');
  const attendanceTotals = Object.fromEntries(attendance.map((row) => [row._id, row.count]));
  res.json({
    range,
    timeline,
    attendance: {
      attended: attendanceTotals.attended || 0,
      recorded: (attendanceTotals.attended || 0) + (attendanceTotals.absent || 0),
    },
    lifetime: { bookings: lifetime[0], queries: lifetime[1], questions: lifetime[2] },
    assignmentsTracked: false,
  });
});

r.get('/labs', auth(), async (req, res) => {
  const labs = await Laboratory.find({ active: true }).populate('inCharge', 'name email department').sort('name');
  res.json(labs);
});
r.post('/labs', auth('labInCharge', 'admin'), async (req, res) => {
  const { name, department, roomNumber, location, description, inCharge } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || typeof department !== 'string' || !department.trim()) throw fail(400, 'Laboratory name and department are required');
  const charge = inCharge || (req.user.role === 'labInCharge' ? req.user._id : undefined);
  if (charge && !validId(charge)) throw fail(400, 'Choose a valid Lab In-Charge');
  if (charge && !await User.exists({ _id: charge, role: 'labInCharge', active: true })) throw fail(400, 'Selected user is not an active Lab In-Charge');
  if (req.user.role === 'labInCharge' && department.trim() !== req.user.department) throw fail(403, 'You can only add laboratories in your department');
  const lab = await Laboratory.create({ name: name.trim(), department: department.trim(), roomNumber: typeof roomNumber === 'string' ? roomNumber.trim() : '', location, description, inCharge: charge });
  res.status(201).json(await lab.populate('inCharge', 'name email department'));
});
r.get('/labs/sessions', auth(), async (req, res) => {
  const filter = { endsAt: { $gte: new Date() } };
  if (req.user.role === 'labInCharge') {
    filter.laboratory = { $in: await Laboratory.find({ department: req.user.department, active: true }).distinct('_id') };
  }
  if (req.user.role === 'student') {
    const cohort = [];
    if (req.user.academicYear) cohort.push({ $or: [{ academicYear: req.user.academicYear }, { academicYear: null }, { academicYear: '' }] });
    if (req.user.section) cohort.push({ $or: [{ section: req.user.section }, { section: null }, { section: '' }] });
    if (cohort.length) filter.$and = cohort;
  }
  const sessions = await LabSession.find(filter).sort('startsAt').limit(100);
  const reservations = req.user.role === 'student' && sessions.length
    ? await LabSessionReservation.find({ session: { $in: sessions.map((session) => session._id) }, student: req.user._id, status: { $in: ['booked', 'waitlisted', 'cancellation-requested'] } })
    : [];
  const reservationBySession = new Map(reservations.map((reservation) => [String(reservation.session), reservation]));
  res.json(await Promise.all(sessions.map(async (session) => {
    await session.populate('laboratory', 'name department roomNumber location');
    return { ...session.toObject(), myReservation: reservationBySession.get(String(session._id)) || null };
  })));
});
r.post('/labs/sessions', auth('labInCharge', 'facultyCoordinator', 'admin'), async (req, res) => {
  const { laboratory, title, startsAt, endsAt, academicYear, section, notes, capacity } = req.body || {};
  if (!validId(laboratory)) throw fail(400, 'Choose a valid laboratory');
  const start = new Date(startsAt), end = new Date(endsAt);
  if (!title?.trim() || title.trim().length > 160 || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw fail(400, 'Enter a title and valid session start/end times');
  if (start <= new Date()) throw fail(400, 'Session start must be in the future');
  const seatCapacity = Number(capacity);
  if (!Number.isInteger(seatCapacity) || seatCapacity < 1 || seatCapacity > 500) throw fail(400, 'Session capacity must be between 1 and 500');
  const lab = await Laboratory.findOne({ _id: laboratory, active: true });
  if (!lab) throw fail(404, 'Laboratory not found');
  if (req.user.role === 'labInCharge' && lab.department !== req.user.department) throw fail(403, 'You can only schedule sessions in your department');
  const conflict = await LabSession.exists({ laboratory, startsAt: { $lt: end }, endsAt: { $gt: start } });
  if (conflict) throw fail(409, 'This laboratory already has a session during that time');
  const session = await LabSession.create({ laboratory, title: title.trim(), startsAt: start, endsAt: end, academicYear, section, notes, capacity: seatCapacity, createdBy: req.user._id });
  res.status(201).json(await session.populate('laboratory', 'name department roomNumber location'));
});
r.get('/labs/sessions/mine', auth('student'), async (req, res) => {
  const reservations = await LabSessionReservation.find({ student: req.user._id, status: { $in: ['booked', 'waitlisted', 'cancellation-requested', 'cancelled'] } })
    .sort({ updatedAt: -1 }).limit(100).populate({ path: 'session', populate: { path: 'laboratory', select: 'name department roomNumber location' } });
  res.json(reservations.filter((reservation) => reservation.session).map((reservation) => ({
    ...reservation.session.toObject(),
    myReservation: reservation.toObject(),
  })));
});
r.post('/labs/sessions/:id/reservation', auth('student'), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Lab session not found');
  const session = await LabSession.findById(req.params.id).populate('laboratory', 'name department roomNumber location');
  if (!session) throw fail(404, 'Lab session not found');
  if (session.startsAt <= new Date()) throw fail(409, 'This lab session is no longer available to book');
  if (session.academicYear && session.academicYear !== req.user.academicYear) throw fail(403, 'This session is for a different academic year');
  if (session.section && session.section !== req.user.section) throw fail(403, 'This session is for a different section');
  if (!session.capacity) throw fail(409, 'Booking is not enabled for this session');
  const prior = await LabSessionReservation.findOne({ session: session._id, student: req.user._id });
  if (prior && prior.status !== 'cancelled') throw fail(409, 'You already have a reservation or waitlist entry for this session');
  await promoteWaitlisted(session._id);
  const queueAhead = await LabSessionReservation.exists({ session: session._id, status: 'waitlisted' });
  const now = new Date();
  const seat = queueAhead ? null : await LabSession.findOneAndUpdate(
    { _id: session._id, startsAt: { $gt: now }, $expr: { $lt: ['$bookedCount', '$capacity'] } },
    { $inc: { bookedCount: 1 } },
    { new: true },
  );
  let status = seat ? 'booked' : 'waitlisted';
  let waitlistPosition = null;
  if (!seat) {
    const queue = await LabSession.findOneAndUpdate({ _id: session._id }, { $inc: { nextWaitlistPosition: 1 } }, { new: true });
    if (!queue) throw fail(404, 'Lab session not found');
    waitlistPosition = queue.nextWaitlistPosition;
  }
  const update = { status, waitlistPosition, cancellationRequestedAt: null, attendanceStatus: 'unrecorded' };
  let reservation;
  try {
    reservation = prior
      ? await LabSessionReservation.findOneAndUpdate({ _id: prior._id, status: 'cancelled' }, { $set: update }, { new: true })
      : await LabSessionReservation.create({ session: session._id, student: req.user._id, ...update });
  } catch (error) {
    if (seat) await LabSession.updateOne({ _id: session._id, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
    if (error.code === 11000) throw fail(409, 'You already have a reservation for this session');
    throw error;
  }
  if (!reservation) {
    if (seat) await LabSession.updateOne({ _id: session._id, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
    throw fail(409, 'Your reservation changed. Refresh and try again');
  }
  if (status === 'booked') {
    const staff = await User.find({ role: 'labInCharge', active: true, department: session.laboratory.department }).select('_id');
    await notifyUsers(staff, { title: 'Student booked a lab session', body: `${req.user.name} · ${session.title}`, type: 'session-booking', link: '/schedule' });
  }
  if (status === 'waitlisted') await promoteWaitlisted(session._id);
  res.status(201).json(await LabSessionReservation.findById(reservation._id));
});
r.delete('/labs/sessions/:id/reservation', auth('student'), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Lab session not found');
  const session = await LabSession.findById(req.params.id).populate('laboratory', 'name department');
  const reservation = await LabSessionReservation.findOne({ session: req.params.id, student: req.user._id, status: { $in: ['booked', 'waitlisted'] } });
  if (!session || !reservation) throw fail(404, 'Active reservation not found');
  if (reservation.status === 'waitlisted') {
    const cancelled = await LabSessionReservation.findOneAndUpdate({ _id: reservation._id, status: 'waitlisted' }, { $set: { status: 'cancelled' } }, { new: true });
    if (!cancelled) throw fail(409, 'Waitlist status changed. Refresh and try again');
    return res.json({ status: 'cancelled' });
  }
  if (session.startsAt.getTime() - Date.now() >= 2 * 60 * 60 * 1000) {
    const cancelled = await LabSessionReservation.findOneAndUpdate({ _id: reservation._id, status: 'booked' }, { $set: { status: 'cancelled' } }, { new: true });
    if (!cancelled) throw fail(409, 'Reservation status changed. Refresh and try again');
    await LabSession.updateOne({ _id: session._id, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
    await promoteWaitlisted(session._id);
    return res.json({ status: 'cancelled' });
  }
  const requested = await LabSessionReservation.findOneAndUpdate(
    { _id: reservation._id, status: 'booked' },
    { $set: { status: 'cancellation-requested', cancellationRequestedAt: new Date() } },
    { new: true },
  );
  if (!requested) throw fail(409, 'Reservation status changed. Refresh and try again');
  const staff = await User.find({ role: 'labInCharge', active: true, department: session.laboratory.department }).select('_id');
  await notifyUsers(staff, { title: 'Lab session cancellation needs approval', body: `${req.user.name} · ${session.title}`, type: 'session-cancellation', link: '/schedule' });
  res.json({ status: requested.status });
});
r.get('/labs/sessions/:id/reservations', auth('labInCharge', 'admin'), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Lab session not found');
  const session = await LabSession.findById(req.params.id).populate('laboratory', 'name department roomNumber location');
  if (!session) throw fail(404, 'Lab session not found');
  assertLabScope(session, req.user);
  const reservations = await LabSessionReservation.find({ session: session._id, status: { $ne: 'cancelled' } })
    .populate('student', 'name email studentId department academicYear section')
    .sort({ status: 1, waitlistPosition: 1, createdAt: 1 });
  res.json(reservations);
});
r.patch('/labs/sessions/:id/capacity', auth('labInCharge', 'admin'), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Lab session not found');
  const capacity = Number(req.body?.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) throw fail(400, 'Session capacity must be between 1 and 500');
  const existing = await LabSession.findById(req.params.id).populate('laboratory', 'name department');
  if (!existing) throw fail(404, 'Lab session not found');
  assertLabScope(existing, req.user);
  const session = await LabSession.findOneAndUpdate(
    { _id: existing._id, $or: [{ bookedCount: { $lte: capacity } }, { bookedCount: { $exists: false } }] },
    { $set: { capacity }, $inc: { bookedCount: 0 } },
    { new: true },
  );
  if (!session) throw fail(409, 'Capacity cannot be lower than the number of booked students');
  await promoteWaitlisted(session._id);
  res.json(session);
});
r.patch('/labs/sessions/:id/reservations/:reservationId/cancellation', auth('labInCharge'), async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.reservationId)) throw fail(404, 'Cancellation request not found');
  const session = await LabSession.findById(req.params.id).populate('laboratory', 'name department');
  if (!session) throw fail(404, 'Lab session not found');
  assertLabScope(session, req.user);
  if (typeof req.body?.approved !== 'boolean') throw fail(400, 'Choose whether to approve the cancellation');
  const reservation = await LabSessionReservation.findOneAndUpdate(
    { _id: req.params.reservationId, session: session._id, status: 'cancellation-requested' },
    { $set: req.body.approved
      ? { status: 'cancelled' }
      : { status: 'booked', cancellationRequestedAt: null } },
    { new: true },
  );
  if (!reservation) throw fail(404, 'Cancellation request not found');
  if (req.body.approved) {
    await LabSession.updateOne({ _id: session._id, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
    await promoteWaitlisted(session._id);
  }
  await notifyUsers([reservation.student], {
    title: req.body.approved ? 'Lab session cancellation approved' : 'Lab session cancellation declined',
    body: session.title,
    type: 'session-cancellation',
    link: '/schedule',
  });
  res.json(reservation);
});
r.patch('/labs/sessions/:id/reservations/:reservationId/attendance', auth('labInCharge', 'admin'), async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.reservationId)) throw fail(404, 'Reservation not found');
  const session = await LabSession.findById(req.params.id).populate('laboratory', 'name department');
  if (!session) throw fail(404, 'Lab session not found');
  assertLabScope(session, req.user);
  if (session.endsAt > new Date()) throw fail(409, 'Attendance can only be recorded after the session ends');
  const { attendanceStatus } = req.body || {};
  if (!['attended', 'absent'].includes(attendanceStatus)) throw fail(400, 'Choose attended or absent');
  const reservation = await LabSessionReservation.findOneAndUpdate(
    { _id: req.params.reservationId, session: session._id, status: 'booked' },
    { $set: { attendanceStatus } },
    { new: true },
  );
  if (!reservation) throw fail(404, 'Booked reservation not found');
  res.json(reservation);
});

r.get('/maintenance', auth('labInCharge', 'facultyCoordinator', 'dean', 'admin'), async (req, res) => {
  const filter = req.user.role === 'labInCharge' ? { $or: [{ assignedTo: req.user._id }, { assignedTo: null }] } : {};
  res.json(await MaintenanceRecord.find(filter).populate('resource', 'name department lab status').populate('reportedBy', 'name role').populate('assignedTo', 'name').sort({ createdAt: -1 }).limit(100));
});
r.post('/maintenance', auth(), async (req, res) => {
  const { resource, description } = req.body || {};
  if (!validId(resource)) throw fail(400, 'Choose a valid equipment record');
  if (typeof description !== 'string' || description.trim().length < 5 || description.trim().length > 2000) throw fail(400, 'Describe the maintenance issue');
  const item = await Resource.findById(resource);
  if (!item) throw fail(404, 'Equipment not found');
  const record = await MaintenanceRecord.create({
    resource, description: description.trim(), reportedBy: req.user._id,
    assignedTo: req.user.role === 'labInCharge' ? req.user._id : null,
  });
  item.status = 'maintenance';
  item.available = 0;
  await item.save();
  const labStaff = await User.find({ role: 'labInCharge', active: true, department: item.department }).select('_id');
  await notifyUsers(labStaff, { title: 'Equipment maintenance reported', body: item.name, type: 'maintenance', link: '/maintenance' });
  res.status(201).json(await record.populate([{ path: 'resource', select: 'name department lab status' }, { path: 'reportedBy', select: 'name role' }]));
});
r.patch('/maintenance/:id', auth('labInCharge', 'admin'), async (req, res) => {
  if (!validId(req.params.id)) throw fail(404, 'Maintenance record not found');
  const record = await MaintenanceRecord.findById(req.params.id).populate('resource');
  if (!record) throw fail(404, 'Maintenance record not found');
  if (req.user.role === 'labInCharge' && record.assignedTo && !record.assignedTo.equals(req.user._id)) throw fail(403, 'This issue is assigned to another Lab In-Charge');
  const { status } = req.body || {};
  if (!['open', 'in-progress', 'resolved'].includes(status)) throw fail(400, 'Choose a valid maintenance status');
  record.status = status;
  if (req.user.role === 'labInCharge') record.assignedTo = req.user._id;
  if (status === 'resolved') record.resolvedAt = new Date();
  await record.save();
  if (status === 'resolved') {
    record.resource.status = 'active';
    await record.resource.save();
    const used = await Booking.countDocuments({ resource: record.resource._id, status: 'approved', startDate: { $lte: new Date() }, endDate: { $gte: new Date() } });
    record.resource.available = Math.max(0, record.resource.total - used);
    await record.resource.save();
  }
  return res.json(await record.populate([{ path: 'resource', select: 'name department lab status' }, { path: 'reportedBy', select: 'name role' }, { path: 'assignedTo', select: 'name' }]));
});

r.get('/portal/stats', auth('facultyCoordinator', 'dean', 'admin'), async (req, res) => {
  const [
    students, faculty, labInCharges, laboratories, resources, units, availableUnits,
    pendingQueries, resolvedQueries, allQueries, pendingBookings, recentQueries, recentAnnouncements,
  ] = await Promise.all([
    User.countDocuments({ role: 'student', active: true }),
    User.countDocuments({ role: 'facultyCoordinator', active: true }),
    User.countDocuments({ role: 'labInCharge', active: true }),
    Laboratory.countDocuments({ active: true }),
    Resource.countDocuments(),
    Resource.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]),
    Resource.aggregate([{ $group: { _id: null, available: { $sum: '$available' } } }]),
    StudentQuery.countDocuments({ status: { $in: ['submitted', 'under-review', 'assigned', 'in-progress'] } }),
    StudentQuery.countDocuments({ status: 'resolved' }),
    StudentQuery.countDocuments(),
    Booking.countDocuments({ status: 'pending' }),
    StudentQuery.find().populate('student', 'name department').sort({ createdAt: -1 }).limit(5),
    Announcement.find().populate('author', 'name role').sort({ createdAt: -1 }).limit(5),
  ]);
  const byStatus = await StudentQuery.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json({
    students, faculty, labInCharges, laboratories, resources,
    equipmentUnits: units[0]?.total || 0, availableUnits: availableUnits[0]?.available || 0,
    pendingQueries, resolvedQueries, totalQueries: allQueries, pendingBookings,
    queryStatuses: Object.fromEntries(byStatus.map((row) => [row._id, row.count])),
    recentQueries, recentAnnouncements,
  });
});

export default r;
