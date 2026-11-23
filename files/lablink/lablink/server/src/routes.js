import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Resource, Booking } from './models.js';
import { auth, sign } from './auth.js';

const r = Router();
const fail = (status, message) => Object.assign(new Error(message), { status });
const safe = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, department: u.department });

/* ---------- Availability: available = total - approved bookings active today ---------- */
async function recalc(id) {
  const now = new Date();
  const used = await Booking.countDocuments({ resource: id, status: 'approved', startDate: { $lte: now }, endDate: { $gte: now } });
  const res = await Resource.findById(id);
  if (res) { res.available = res.status === 'maintenance' ? 0 : Math.max(0, res.total - used); await res.save(); }
}

/* ---------- Auth ---------- */
r.post('/auth/register', async (req, res) => {
  const { name, email, password, role = 'student', department, code } = req.body;
  if (!name || !email || !password || password.length < 6) throw fail(400, 'Name, email and a password of 6+ characters are required');
  if (role === 'faculty' && code !== (process.env.FACULTY_CODE || 'FACULTY2026')) throw fail(403, 'Invalid faculty invite code');
  if (role === 'admin' && code !== (process.env.ADMIN_CODE || 'LABADMIN2026')) throw fail(403, 'Invalid admin invite code');
  if (!['student', 'faculty', 'admin'].includes(role)) throw fail(400, 'Invalid role');
  if (await User.findOne({ email })) throw fail(409, 'An account with this email already exists');
  const u = await User.create({ name, email, department, role, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(u), user: safe(u) });
});
r.post('/auth/login', async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) throw fail(401, 'Incorrect email or password');
  res.json({ token: sign(u), user: safe(u) });
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
r.post('/resources', auth('admin'), async (req, res) => {
  const x = await Resource.create({ ...req.body, available: req.body.total ?? 1 });
  res.status(201).json(x);
});
r.put('/resources/:id', auth('admin'), async (req, res) => {
  const x = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!x) throw fail(404, 'Resource not found');
  await recalc(x._id);
  res.json(await Resource.findById(x._id));
});
r.delete('/resources/:id', auth('admin'), async (req, res) => {
  await Resource.findByIdAndDelete(req.params.id);
  await Booking.deleteMany({ resource: req.params.id });
  res.json({ ok: true });
});
r.post('/resources/:id/recommend', auth('faculty'), async (req, res) => {
  const x = await Resource.findById(req.params.id);
  if (!x) throw fail(404, 'Resource not found');
  x.recommendations.push({ by: req.user.name, note: req.body.note || 'Recommended for academic projects' });
  await x.save();
  res.json(x);
});

/* ---------- Bookings ---------- */
r.post('/bookings', auth('student'), async (req, res) => {
  const { resource, startDate, endDate, purpose } = req.body;
  const s = new Date(startDate), e = new Date(endDate);
  if (isNaN(s) || isNaN(e)) throw fail(400, 'Choose a start and end date');
  e.setHours(23, 59, 59, 999);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (s < today) throw fail(400, 'Start date cannot be in the past');
  if (e < s) throw fail(400, 'End date must be on or after the start date');
  if (!purpose || purpose.trim().length < 5) throw fail(400, 'Describe your purpose in a few words');
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
  const b = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!b) throw fail(404, 'Booking not found');
  if (b.status !== 'pending') throw fail(409, 'Only pending requests can be cancelled');
  await b.deleteOne();
  res.json({ ok: true });
});
r.get('/bookings', auth('faculty', 'admin'), async (req, res) => {
  let list = await Booking.find().populate('resource').populate('user', 'name email department').sort('-createdAt');
  // Faculty only see requests for resources in their own department
  if (req.user.role === 'faculty') list = list.filter((b) => b.resource && b.resource.department === req.user.department);
  res.json(list);
});
r.patch('/bookings/:id/status', auth('faculty', 'admin'), async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'completed'].includes(status)) throw fail(400, 'Invalid status');
  const b = await Booking.findById(req.params.id).populate('resource');
  if (!b) throw fail(404, 'Booking not found');
  if (req.user.role === 'faculty' && b.resource.department !== req.user.department) throw fail(403, 'You can only review requests for your department');
  if (status === 'approved') {
    if (b.status !== 'pending') throw fail(409, 'Only pending requests can be approved');
    const overlap = await Booking.countDocuments({ resource: b.resource._id, status: 'approved', startDate: { $lte: b.endDate }, endDate: { $gte: b.startDate } });
    if (overlap >= b.resource.total) throw fail(409, 'No units free for these dates');
  }
  if (status === 'rejected' && !['pending', 'approved'].includes(b.status)) throw fail(409, 'This request is already closed');
  if (status === 'completed' && b.status !== 'approved') throw fail(409, 'Only approved bookings can be completed');
  b.status = status; b.reviewedBy = req.user._id;
  await b.save();
  await recalc(b.resource._id);
  res.json(b);
});

/* ---------- Users & analytics ---------- */
r.get('/users', auth('admin'), async (req, res) => res.json((await User.find().sort('-createdAt')).map(safe)));
r.get('/analytics', auth('faculty', 'admin'), async (req, res) => {
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
