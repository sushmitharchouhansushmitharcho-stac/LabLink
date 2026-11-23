import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Resource, Booking, BookingSlot, Question, Notification } from './models.js';
import { QUESTION_CATEGORIES, QUESTION_CATEGORY_IDS } from './questionCategories.js';
import { auth, sign } from './auth.js';

const r = Router();
const fail = (status, message) => Object.assign(new Error(message), { status });
const safe = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, department: u.department });
const questionPopulate = [
  { path: 'author', select: 'name role department' },
  { path: 'answers.author', select: 'name role department' },
];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- Student questions & answers ---------- */
r.get('/questions/categories', auth(), (req, res) => res.json(QUESTION_CATEGORIES));
r.get('/questions', auth(), async (req, res) => {
  const { q = '', category, mine, sort = 'recent' } = req.query;
  if (typeof q !== 'string') throw fail(400, 'Search must be a text value');
  if (category && !QUESTION_CATEGORY_IDS.includes(category)) throw fail(400, 'Choose a valid question category');
  if (!['recent', 'popular'].includes(sort)) throw fail(400, 'Choose a valid sort order');
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const filter = {};
  if (category) filter.category = category;
  if (mine === 'true') filter.author = req.user._id;
  if (q.trim()) {
    const search = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ title: search }, { body: search }, { tags: search }];
  }
  const order = sort === 'popular' ? { answerCount: -1, createdAt: -1 } : { createdAt: -1 };
  const [items, total] = await Promise.all([
    Question.find(filter).populate(questionPopulate).sort(order).skip((page - 1) * limit).limit(limit),
    Question.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
r.get('/questions/:id', auth(), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw fail(404, 'Question not found');
  const question = await Question.findById(req.params.id).populate(questionPopulate);
  if (!question) throw fail(404, 'Question not found');
  res.json(question);
});
r.post('/questions', auth(), async (req, res) => {
  const { title, body, category, tags = [] } = req.body || {};
  if (typeof title !== 'string' || title.trim().length < 8 || title.trim().length > 140) {
    throw fail(400, 'Question title must be between 8 and 140 characters');
  }
  if (typeof body !== 'string' || body.trim().length < 15 || body.trim().length > 6000) {
    throw fail(400, 'Question details must be between 15 and 6000 characters');
  }
  if (!QUESTION_CATEGORY_IDS.includes(category)) throw fail(400, 'Choose a valid question category');
  if (!Array.isArray(tags)) throw fail(400, 'Question tags must be a list');
  const cleanTags = [...new Set(tags
    .filter((tag) => typeof tag === 'string')
    .map((tag) => tag.trim().toLowerCase().replace(/^#/, '').slice(0, 30))
    .filter(Boolean))].slice(0, 8);
  const question = await Question.create({
    title: title.trim(), body: body.trim(), category, tags: cleanTags, author: req.user._id,
  });
  await question.populate(questionPopulate);
  res.status(201).json(question);
});
r.post('/questions/:id/answers', auth(), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw fail(404, 'Question not found');
  const { body } = req.body || {};
  if (typeof body !== 'string' || body.trim().length < 3 || body.trim().length > 4000) {
    throw fail(400, 'Your response must be between 3 and 4000 characters');
  }
  const question = await Question.findByIdAndUpdate(
    req.params.id,
    { $push: { answers: { body: body.trim(), author: req.user._id } }, $inc: { answerCount: 1 } },
    { new: true, runValidators: true },
  ).populate(questionPopulate);
  if (!question) throw fail(404, 'Question not found');
  res.status(201).json(question);
});

/* ---------- Availability: available = total - approved bookings active today ---------- */
async function recalc(id) {
  const now = new Date();
  const used = await Booking.countDocuments({ resource: id, status: 'approved', startDate: { $lte: now }, endDate: { $gte: now } });
  const res = await Resource.findById(id);
  if (res) { res.available = res.status === 'maintenance' ? 0 : Math.max(0, res.total - used); await res.save(); }
}
const dateKeysBetween = (start, end) => {
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const dates = [];
  for (const day = new Date(first); day <= last; day.setUTCDate(day.getUTCDate() + 1)) {
    dates.push(day.toISOString().slice(0, 10));
  }
  return dates;
};
async function reserveBookingUnit(booking, resource) {
  const days = dateKeysBetween(booking.startDate, booking.endDate);
  const overlaps = await Booking.find({
    _id: { $ne: booking._id },
    resource: resource._id,
    status: 'approved',
    startDate: { $lte: booking.endDate },
    endDate: { $gte: booking.startDate },
  }).select('startDate endDate allocatedUnit').sort('startDate');
  const occupiedByDay = new Map(days.map((day) => [day, new Set()]));
  for (const existing of overlaps) {
    const unit = Number.isInteger(existing.allocatedUnit) ? existing.allocatedUnit : null;
    for (const day of days) {
      const start = new Date(`${day}T00:00:00.000Z`);
      const end = new Date(`${day}T23:59:59.999Z`);
      if (existing.startDate <= end && existing.endDate >= start) {
        const occupied = occupiedByDay.get(day);
        if (unit !== null) occupied.add(unit);
        else {
          let legacyUnit = 0;
          while (legacyUnit < resource.total && occupied.has(legacyUnit)) legacyUnit += 1;
          if (legacyUnit < resource.total) occupied.add(legacyUnit);
        }
      }
    }
  }
  for (let unit = 0; unit < resource.total; unit += 1) {
    if (days.some((day) => occupiedByDay.get(day).has(unit))) continue;
    try {
      await BookingSlot.insertMany(days.map((dateKey) => ({ resource: resource._id, dateKey, unit, booking: booking._id })));
      return unit;
    } catch (error) {
      await BookingSlot.deleteMany({ booking: booking._id });
      if (error.code !== 11000) throw error;
    }
  }
  throw fail(409, 'No equipment unit is available for all requested dates');
}

/* ---------- Auth ---------- */
r.post('/auth/register', async (req, res) => {
  const { name, email, password, role = 'student', department } = req.body || {};
  if (role !== 'student') throw fail(403, 'Only administrators can create staff and administrator accounts');
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || password.length < 8) {
    throw fail(400, 'Enter a name, valid email and a password of at least 8 characters');
  }
  if (await User.findOne({ email: email.trim().toLowerCase() })) throw fail(409, 'An account with this email already exists');
  const u = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), department, role: 'student', password: await bcrypt.hash(password, 12) });
  res.status(201).json({ token: sign(u), user: safe(u) });
});
r.post('/auth/login', async (req, res) => {
  const { email, password, role, remember = true } = req.body || {};
  const u = await User.findOne({ email: typeof email === 'string' ? email.trim().toLowerCase() : '' });
  if (!u || !u.active || !(await bcrypt.compare(password || '', u.password))) throw fail(401, 'Incorrect email or password');
  if (role && role !== u.role && !(role === 'facultyCoordinator' && u.role === 'faculty')) throw fail(403, 'This account does not have the selected role');
  res.json({ token: sign(u, remember !== false), user: safe(u) });
});
r.get('/auth/me', auth(), (req, res) => res.json({ user: safe(req.user) }));

/* ---------- Resources ---------- */
r.get('/resources/meta', auth(), async (req, res) => {
  res.json({ categories: await Resource.distinct('category'), departments: await Resource.distinct('department') });
});
r.get('/resources', auth(), async (req, res) => {
  const { q, category, department, available } = req.query;
  const f = {};
  if (category) f.category = category;
  if (department) f.department = department;
  if (available === 'true') f.available = { $gt: 0 };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    f.$or = [{ name: rx }, { category: rx }, { department: rx }, { description: rx }, { tags: rx }, { lab: rx }];
  }
  res.json(await Resource.find(f).sort('name'));
});
r.get('/resources/:id', auth(), async (req, res) => {
  const x = await Resource.findById(req.params.id);
  if (!x) throw fail(404, 'Resource not found');
  res.json(x);
});
r.post('/resources', auth('admin', 'labInCharge'), async (req, res) => {
  const x = await Resource.create({ ...req.body, available: req.body.total ?? 1 });
  res.status(201).json(x);
});
r.put('/resources/:id', auth('admin', 'labInCharge'), async (req, res) => {
  const x = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!x) throw fail(404, 'Resource not found');
  await recalc(x._id);
  res.json(await Resource.findById(x._id));
});
r.delete('/resources/:id', auth('admin', 'labInCharge'), async (req, res) => {
  await Resource.findByIdAndDelete(req.params.id);
  await Booking.deleteMany({ resource: req.params.id });
  await BookingSlot.deleteMany({ resource: req.params.id });
  res.json({ ok: true });
});
r.post('/resources/:id/recommend', auth('facultyCoordinator', 'admin'), async (req, res) => {
  const x = await Resource.findById(req.params.id);
  if (!x) throw fail(404, 'Resource not found');
  x.recommendations.push({ by: req.user.name, note: req.body.note || 'Recommended for academic projects' });
  await x.save();
  res.json(x);
});

/* ---------- Bookings ---------- */
r.post('/bookings', auth('student'), async (req, res) => {
  const { resource, startDate, endDate, purpose } = req.body || {};
  if (!mongoose.isValidObjectId(resource)) throw fail(400, 'Choose valid equipment');
  const s = new Date(startDate), e = new Date(endDate);
  if (isNaN(s) || isNaN(e)) throw fail(400, 'Choose a start and end date');
  e.setHours(23, 59, 59, 999);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (s < today) throw fail(400, 'Start date cannot be in the past');
  if (e < s) throw fail(400, 'End date must be on or after the start date');
  if ((e - s) / 86400000 > 365) throw fail(400, 'Bookings cannot exceed 366 calendar days');
  if (typeof purpose !== 'string' || purpose.trim().length < 5) throw fail(400, 'Describe your purpose in a few words');
  const x = await Resource.findById(resource);
  if (!x) throw fail(404, 'Resource not found');
  if (x.status === 'maintenance') throw fail(409, 'This equipment is under maintenance');
  const b = await Booking.create({ resource, user: req.user._id, startDate: s, endDate: e, purpose });
  res.status(201).json(b);
});
r.get('/bookings/mine', auth('student'), async (req, res) => {
  res.json(await Booking.find({ user: req.user._id }).populate('resource', 'name lab location category').sort('-createdAt'));
});
r.delete('/bookings/:id', auth('student'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw fail(404, 'Booking not found');
  const b = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!b) throw fail(404, 'Booking not found');
  if (b.status !== 'pending') throw fail(409, 'Only pending requests can be cancelled');
  await b.deleteOne();
  res.json({ ok: true });
});
r.get('/bookings', auth('facultyCoordinator', 'labInCharge', 'dean', 'admin'), async (req, res) => {
  let list = await Booking.find().populate('resource').populate('user', 'name email department').sort('-createdAt');
  if (['facultyCoordinator', 'labInCharge'].includes(req.user.role)) {
    list = list.filter((b) => b.resource && b.resource.department === req.user.department);
  }
  res.json(list);
});
r.patch('/bookings/:id/status', auth('facultyCoordinator', 'labInCharge', 'admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw fail(404, 'Booking not found');
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'completed'].includes(status)) throw fail(400, 'Invalid status');
  const b = await Booking.findById(req.params.id).populate('resource');
  if (!b) throw fail(404, 'Booking not found');
  if (['facultyCoordinator', 'labInCharge'].includes(req.user.role) && b.resource.department !== req.user.department) throw fail(403, 'You can only review requests for your department');
  if (req.user.role === 'facultyCoordinator') throw fail(403, 'Faculty Coordinators cannot approve equipment bookings');
  if (status === 'approved') {
    if (b.status !== 'pending') throw fail(409, 'Only pending requests can be approved');
    if (b.resource.status === 'maintenance') throw fail(409, 'Equipment under maintenance cannot be approved');
    b.allocatedUnit = await reserveBookingUnit(b, b.resource);
  }
  if (status === 'rejected' && !['pending', 'approved'].includes(b.status)) throw fail(409, 'This request is already closed');
  if (status === 'completed' && b.status !== 'approved') throw fail(409, 'Only approved bookings can be completed');
  if (status === 'rejected' && b.status === 'approved' || status === 'completed') {
    await BookingSlot.deleteMany({ booking: b._id });
    b.allocatedUnit = undefined;
  }
  b.status = status; b.reviewedBy = req.user._id;
  try {
    await b.save();
  } catch (error) {
    if (status === 'approved') await BookingSlot.deleteMany({ booking: b._id });
    throw error;
  }
  const bookingUser = await User.findById(b.user).select('_id');
  if (bookingUser) await Notification.create({
    recipient: bookingUser._id,
    title: `Equipment booking ${status}`,
    body: `${b.resource.name} · ${b.startDate.toLocaleDateString()} – ${b.endDate.toLocaleDateString()}`,
    type: `booking-${status}`,
    link: '/bookings',
  });
  await recalc(b.resource._id);
  res.json(await b.populate([{ path: 'resource' }, { path: 'user', select: 'name email department' }]));
});

/* ---------- Users & analytics ---------- */
r.get('/users', auth('admin'), async (req, res) => res.json((await User.find().sort('-createdAt')).map(safe)));
r.get('/analytics', auth('facultyCoordinator', 'dean', 'admin'), async (req, res) => {
  const [resources, bookings] = await Promise.all([Resource.find(), Booking.find().populate('resource')]);
  const count = (arr, fn) => Object.entries(arr.reduce((m, x) => { const k = fn(x); if (k) m[k] = (m[k] || 0) + 1; return m; }, {})).map(([name, value]) => ({ name, value }));
  const used = bookings.filter((b) => ['approved', 'completed'].includes(b.status));
  const byMonth = count(bookings, (b) => b.createdAt.toISOString().slice(0, 7)).sort((a, b) => a.name.localeCompare(b.name));
  res.json({
    totals: {
      resources: resources.length, units: resources.reduce((a, x) => a + x.total, 0),
      inUse: resources.reduce((a, x) => a + (x.total - x.available), 0),
      maintenance: resources.filter((x) => x.status === 'maintenance').length,
      bookings: bookings.length, pending: bookings.filter((b) => b.status === 'pending').length,
    },
    byStatus: count(bookings, (b) => b.status),
    byDepartment: count(used, (b) => b.resource?.department),
    topResources: count(used, (b) => b.resource?.name).sort((a, b) => b.value - a.value).slice(0, 6),
    byMonth,
    maintenance: resources.filter((x) => x.status === 'maintenance').map((x) => ({ name: x.name, lab: x.lab })),
  });
});

/* ---------- AI assistant ---------- */
r.post('/ai/recommend', auth(), async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) throw fail(400, 'Tell the assistant about your project');
  const all = await Resource.find();
  const byId = Object.fromEntries(all.map((x) => [String(x._id), x]));
  let reply, ids = [];

  if (process.env.ANTHROPIC_API_KEY) {
    const catalog = all.map((x) => `${x._id} | ${x.name} | ${x.category} | ${x.department} | ${x.lab} | ${x.status === 'maintenance' ? 'UNDER MAINTENANCE' : `${x.available}/${x.total} available`} | ${x.description} | ${x.tags.join(', ')}`).join('\n');
    const system = `You are LabLink's assistant helping college students find laboratory equipment across departments.
Only recommend items from this catalogue (id | name | category | department | lab | availability | description | tags):
${catalog}
Explain briefly why each pick fits the project. If a pick is unavailable or under maintenance, suggest an available alternative. Mention cross-department options where useful.
Respond ONLY with JSON: {"reply": "friendly markdown-free explanation", "recommendations": ["<resource id>", ...]} with at most 4 ids.`;
    const r2 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 1000, system,
        messages: [...history.slice(-6).map((h) => ({ role: h.role, content: h.text })), { role: 'user', content: message }] }),
    });
    const data = await r2.json();
    if (!r2.ok) throw fail(502, data.error?.message || 'AI service error');
    const text = (data.content || []).map((c) => c.text || '').join('').replace(/```json|```/g, '').trim();
    try { const j = JSON.parse(text); reply = j.reply; ids = (j.recommendations || []).filter((i) => byId[i]); } catch { reply = text; }
  } else {
    // Offline fallback: keyword scoring so the assistant still works without an API key
    const words = message.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    const scored = all.map((x) => {
      const hay = [x.name, x.category, x.department, x.description, ...x.tags].join(' ').toLowerCase();
      return { x, s: words.filter((w) => hay.includes(w)).length };
    }).filter((o) => o.s > 0).sort((a, b) => b.s - a.s);
    const picks = scored.slice(0, 4).map((o) => o.x);
    ids = picks.map((x) => String(x._id));
    reply = picks.length
      ? 'Based on your description, these look most relevant: ' + picks.map((x) => `${x.name} (${x.department}) — ${x.status === 'maintenance' || !x.available ? 'currently unavailable' : x.available + ' available'}`).join('; ') + '. (Add ANTHROPIC_API_KEY on the server for fuller explanations.)'
      : 'I could not match that to any equipment. Try mentioning components, software or the kind of project (e.g. IoT, robotics, VLSI).';
  }
  res.json({ reply: reply || 'Here is what I found.', resources: ids.map((i) => byId[i]) });
});

export default r;
