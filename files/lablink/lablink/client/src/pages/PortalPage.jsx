import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bell, CalendarDays, CheckCheck, ClipboardList, Plus, Send, ShieldCheck, Wrench } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { Badge, Empty } from '../ui.jsx';

const roleOptions = [
  ['student', 'Student'], ['facultyCoordinator', 'Faculty Coordinator'], ['labInCharge', 'Lab In-Charge'], ['dean', 'Dean'], ['admin', 'Admin'],
];
const queryStatuses = ['submitted', 'under-review', 'assigned', 'in-progress', 'resolved', 'rejected'];
const statusLabel = (status) => status.replaceAll('-', ' ');
const fmt = (date) => new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function QueryCard({ query, categories }) {
  const category = categories.find((item) => item.id === query.category)?.name || query.category;
  return (
    <Link to={`/queries/${query._id}`} className="portal-list-card">
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-slate-100">{query.title}</h3>
        <p className="mt-1 truncate text-sm text-slate-400">{category} · {query.student?.name || 'Student'} · {fmt(query.createdAt)}</p>
        {query.assignedTo && <p className="mt-1 text-xs text-cyan-200">Assigned to {query.assignedTo.name}</p>}
      </div>
      <Badge kind={query.status === 'resolved' ? 'approved' : query.status === 'rejected' ? 'rejected' : 'pending'}>{statusLabel(query.status)}</Badge>
    </Link>
  );
}

function QueriesView({ user, queryId }) {
  const { notify } = useApp();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [queries, setQueries] = useState([]);
  const [selected, setSelected] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', category: '' });
  const [response, setResponse] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const loadList = async () => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    if (statusFilter) params.set('status', statusFilter);
    const result = await api('/queries' + (params.size ? `?${params}` : ''));
    setQueries(result);
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    const calls = [
      api('/query-categories').then((items) => { if (active) setCategories(items); }),
      queryId ? api(`/queries/${queryId}`).then((item) => { if (active) { setSelected(item); setAssignedTo(item.assignedTo?._id || ''); } })
        : loadList(),
    ];
    if (user.role === 'facultyCoordinator' || user.role === 'admin') {
      calls.push(api('/staff/lab-in-charges').then((items) => { if (active) setStaff(items); }));
    }
    Promise.all(calls).catch((error) => { if (active) notify(error.message, 'error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryId, categoryFilter, statusFilter, user.role]);

  const postQuery = async (event) => {
    event.preventDefault();
    try {
      const item = await api('/queries', { method: 'POST', body: form });
      notify('Query submitted');
      setForm({ title: '', description: '', category: '' });
      navigate(`/queries/${item._id}`);
    } catch (error) { notify(error.message, 'error'); }
  };
  const postResponse = async (event) => {
    event.preventDefault();
    try {
      const item = await api(`/queries/${queryId}/responses`, { method: 'POST', body: { body: response } });
      setSelected(item);
      setResponse('');
      notify('Response added');
    } catch (error) { notify(error.message, 'error'); }
  };
  const assign = async () => {
    try {
      const item = await api(`/queries/${queryId}/assign`, { method: 'PATCH', body: { assignedTo } });
      setSelected(item);
      notify('Query assigned');
      await loadList();
    } catch (error) { notify(error.message, 'error'); }
  };
  const updateStatus = async (status) => {
    try {
      const item = await api(`/queries/${queryId}/status`, { method: 'PATCH', body: { status } });
      setSelected(item);
      notify('Query status updated');
      await loadList();
    } catch (error) { notify(error.message, 'error'); }
  };
  const canRespond = user.role !== 'dean' && selected?.status !== 'resolved' && selected?.status !== 'rejected';

  if (queryId) return (
    <section className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <Link to="/queries" className="inline-flex items-center gap-2 text-sm text-cyan-200"><ArrowLeft className="h-4 w-4" />All queries</Link>
      {loading ? <div className="card p-7 text-slate-400">Loading query…</div> : !selected ? <Empty>Query not found.</Empty> : (
        <article className="card p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm text-cyan-200">{categories.find((item) => item.id === selected.category)?.name || selected.category}</p><h1 className="mt-2 text-2xl font-bold text-white">{selected.title}</h1></div><Badge kind={selected.status === 'resolved' ? 'approved' : selected.status === 'rejected' ? 'rejected' : 'pending'}>{statusLabel(selected.status)}</Badge></div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{selected.description}</p>
          <div className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">Submitted by {selected.student?.name} · {selected.student?.email} · {fmt(selected.createdAt)}</div>
          {selected.assignedTo && <p className="mt-2 text-sm text-cyan-200">Assigned to {selected.assignedTo.name}</p>}
          {(user.role === 'facultyCoordinator' || user.role === 'admin') && selected.status !== 'resolved' && selected.status !== 'rejected' && <>
            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]"><select className="input" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Assign to a Lab In-Charge</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.department || 'Department not set'}</option>)}</select><button type="button" className="btn-cyan" disabled={!assignedTo} onClick={assign}>Assign query</button></div>
          </>}
          {(user.role === 'facultyCoordinator' || user.role === 'labInCharge' || user.role === 'admin') && selected.status !== 'resolved' && selected.status !== 'rejected' && (
            <label className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">Update status
              <select className="input max-w-xs" value={selected.status} onChange={(event) => updateStatus(event.target.value)}>
                {queryStatuses.filter((status) => user.role !== 'labInCharge' || !['submitted', 'under-review', 'assigned'].includes(status)).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
            </label>
          )}
          <div className="mt-7"><h2 className="text-lg font-bold text-white">Responses ({selected.responses.length})</h2>
            <div className="mt-3 space-y-3">{selected.responses.map((item) => <div key={item._id} className="question-answer"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{item.body}</p><p className="mt-2 text-xs text-slate-400">{item.author?.name} · {fmt(item.createdAt)}</p></div>)}</div>
            {canRespond && <form onSubmit={postResponse} className="mt-4 space-y-3"><label className="label" htmlFor="query-response">Add a response</label><textarea id="query-response" className="input min-h-24 resize-y" required minLength={3} maxLength={4000} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Write a helpful response or clarification…" /><button className="btn-cyan" type="submit"><Send className="h-4 w-4" />Send response</button></form>}
          </div>
        </article>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header><p className="landing-eyebrow"><ClipboardList className="h-4 w-4" /> LABLINK SUPPORT</p><h1 className="mt-2 text-3xl font-bold text-white">{user.role === 'student' ? 'My queries' : user.role === 'labInCharge' ? 'Laboratory queries' : 'Student query management'}</h1><p className="mt-2 text-slate-400">{user.role === 'student' ? 'Submit a request and track replies and status.' : 'Review, assign and respond to student support requests.'}</p></header>
      {user.role === 'student' && <form onSubmit={postQuery} className="card grid gap-4 p-5 md:grid-cols-2 md:p-6">
        <div className="md:col-span-2"><h2 className="text-lg font-bold text-white">Submit a query</h2><p className="text-sm text-slate-400">Choose the closest category so the right team can help.</p></div>
        <div><label className="label" htmlFor="query-category">Category</label><select id="query-category" className="input" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Choose category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><label className="label" htmlFor="query-title">Title</label><input id="query-title" className="input" minLength={8} maxLength={140} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Summarize your query" /></div>
        <div className="md:col-span-2"><label className="label" htmlFor="query-description">Description</label><textarea id="query-description" className="input min-h-28 resize-y" minLength={15} maxLength={6000} required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Include relevant context and details." /></div>
        <div className="md:col-span-2"><button className="btn-cyan" type="submit"><Send className="h-4 w-4" />Submit query</button></div>
      </form>}
      <section className="card p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-white">{user.role === 'student' ? 'Query history' : `All queries (${queries.length})`}</h2><div className="flex flex-wrap gap-2">
          <select className="input min-w-44" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select className="input min-w-36" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{queryStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
        </div></div>
        {loading ? <p className="p-5 text-slate-400">Loading queries…</p> : queries.length ? <div className="divide-y divide-white/10">{queries.map((query) => <QueryCard key={query._id} query={query} categories={categories} />)}</div> : <Empty>No matching queries yet.</Empty>}
      </section>
    </div>
  );
}

function AnnouncementsView({ user }) {
  const { notify } = useApp();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', audience: ['student'], important: false, department: '' });
  const canPost = ['facultyCoordinator', 'labInCharge', 'dean', 'admin'].includes(user.role);
  const load = () => api('/announcements').then(setItems).catch((error) => notify(error.message, 'error'));
  useEffect(() => { load(); }, []);
  const post = async (event) => {
    event.preventDefault();
    try {
      await api('/announcements', { method: 'POST', body: form });
      notify('Announcement posted');
      setForm({ title: '', body: '', audience: ['student'], important: false, department: '' });
      load();
    } catch (error) { notify(error.message, 'error'); }
  };
  const toggleAudience = (role) => setForm((current) => ({ ...current, audience: current.audience.includes(role) ? current.audience.filter((item) => item !== role) : [...current.audience, role] }));
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header><p className="landing-eyebrow"><Bell className="h-4 w-4" /> CAMPUS UPDATES</p><h1 className="mt-2 text-3xl font-bold text-white">Announcements</h1><p className="mt-2 text-slate-400">Notices visible to your role and department.</p></header>
      {canPost && <form onSubmit={post} className="card grid gap-4 p-5 md:grid-cols-2">
        <div className="md:col-span-2"><h2 className="font-bold text-white">Publish an announcement</h2></div>
        <div><label className="label" htmlFor="announcement-title">Title</label><input id="announcement-title" className="input" required minLength={4} maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
        <div><label className="label" htmlFor="announcement-department">Department filter <span className="text-slate-500">(optional)</span></label><input id="announcement-department" className="input" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></div>
        <div className="md:col-span-2"><label className="label" htmlFor="announcement-body">Message</label><textarea id="announcement-body" className="input min-h-24 resize-y" required minLength={5} maxLength={5000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></div>
        <fieldset className="md:col-span-2"><legend className="label">Audience</legend><div className="flex flex-wrap gap-3">{roleOptions.filter(([role]) => role !== 'admin').map(([role, label]) => <label key={role} className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.audience.includes(role)} onChange={() => toggleAudience(role)} />{label}</label>)}</div></fieldset>
        {['dean', 'admin'].includes(user.role) && <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.important} onChange={(event) => setForm({ ...form, important: event.target.checked })} />Mark as important</label>}
        <div className="md:col-span-2"><button className="btn-cyan" type="submit" disabled={!form.audience.length}><Send className="h-4 w-4" />Publish</button></div>
      </form>}
      <section className="space-y-3">{items.length ? items.map((item) => <article key={item._id} className="card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-white">{item.title}{item.important && <span className="ml-2 rounded-full bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200">Important</span>}</h2><span className="text-xs text-slate-400">{fmt(item.createdAt)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.body}</p><p className="mt-3 text-xs text-slate-500">Posted by {item.author?.name || 'LabLink staff'}{item.department ? ` · ${item.department}` : ''}</p></article>) : <Empty>No announcements available.</Empty>}</section>
    </div>
  );
}

function SessionAdminControls({ session, notify, refresh, canApproveCancellation }) {
  const [roster, setRoster] = useState([]);
  const [open, setOpen] = useState(false);
  const [capacity, setCapacity] = useState(String(session.capacity || ''));
  const toggleRoster = async () => {
    if (open) return setOpen(false);
    try { setRoster(await api(`/labs/sessions/${session._id}/reservations`)); setOpen(true); }
    catch (error) { notify(error.message, 'error'); }
  };
  const updateCapacity = async (event) => {
    event.preventDefault();
    try { await api(`/labs/sessions/${session._id}/capacity`, { method: 'PATCH', body: { capacity: Number(capacity) } }); notify('Session capacity updated'); refresh(); }
    catch (error) { notify(error.message, 'error'); }
  };
  const updateCancellation = async (reservationId, approved) => {
    try { await api(`/labs/sessions/${session._id}/reservations/${reservationId}/cancellation`, { method: 'PATCH', body: { approved } }); notify(approved ? 'Cancellation approved' : 'Cancellation declined'); setRoster(await api(`/labs/sessions/${session._id}/reservations`)); refresh(); }
    catch (error) { notify(error.message, 'error'); }
  };
  const recordAttendance = async (reservationId, attendanceStatus) => {
    try { await api(`/labs/sessions/${session._id}/reservations/${reservationId}/attendance`, { method: 'PATCH', body: { attendanceStatus } }); notify('Attendance recorded'); setRoster(await api(`/labs/sessions/${session._id}/reservations`)); }
    catch (error) { notify(error.message, 'error'); }
  };
  return <div className="mt-4 border-t border-white/10 pt-4">
    <form className="flex flex-wrap items-end gap-2" onSubmit={updateCapacity}><label className="label mb-0 max-w-36">Seat capacity<input className="input mt-1" type="number" min="1" max="500" required value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label><button className="btn-ghost" type="submit">Update capacity</button><button className="btn-ghost" type="button" onClick={toggleRoster}>{open ? 'Hide students' : 'Manage bookings'}</button></form>
    {open && <div className="mt-4 divide-y divide-white/10">{roster.length ? roster.map((reservation) => <article key={reservation._id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium text-white">{reservation.student?.name || 'Student'}</p><p className="text-xs capitalize text-slate-400">{reservation.status.replaceAll('-', ' ')}{reservation.waitlistPosition ? ` · waitlist #${reservation.waitlistPosition}` : ''}{reservation.attendanceStatus !== 'unrecorded' ? ` · ${reservation.attendanceStatus}` : ''}</p></div><div className="flex flex-wrap gap-2">{reservation.status === 'cancellation-requested' && (canApproveCancellation ? <><button className="btn-ghost" type="button" onClick={() => updateCancellation(reservation._id, true)}>Approve cancellation</button><button className="btn-ghost" type="button" onClick={() => updateCancellation(reservation._id, false)}>Decline</button></> : <span className="text-xs text-amber-200">Awaiting Lab In-Charge approval</span>)}{reservation.status === 'booked' && new Date(session.endsAt) <= new Date() && <><button className="btn-ghost" type="button" onClick={() => recordAttendance(reservation._id, 'attended')}>Mark attended</button><button className="btn-ghost" type="button" onClick={() => recordAttendance(reservation._id, 'absent')}>Mark absent</button></>}</div></article>) : <Empty>No active reservations for this session.</Empty>}</div>}
  </div>;
}

function ScheduleView({ user }) {
  const { notify } = useApp();
  const [labs, setLabs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({ laboratory: '', title: '', startsAt: '', endsAt: '', academicYear: '', section: '', notes: '', capacity: '' });
  const [labForm, setLabForm] = useState({ name: '', department: '', roomNumber: '', location: '' });
  const canManage = ['labInCharge', 'facultyCoordinator', 'admin'].includes(user.role);
  const canCreateLab = ['labInCharge', 'admin'].includes(user.role);
  const canManageReservations = ['labInCharge', 'admin'].includes(user.role);
  const load = () => Promise.all([api('/labs').then(setLabs), api('/labs/sessions').then(setSessions)]).catch((error) => notify(error.message, 'error'));
  useEffect(() => { load(); }, []);
  const createSession = async (event) => {
    event.preventDefault();
    try {
      await api('/labs/sessions', { method: 'POST', body: form });
      notify('Laboratory session scheduled');
      setForm({ laboratory: '', title: '', startsAt: '', endsAt: '', academicYear: '', section: '', notes: '', capacity: '' });
      load();
    } catch (error) { notify(error.message, 'error'); }
  };
  const createLab = async (event) => {
    event.preventDefault();
    try {
      await api('/labs', { method: 'POST', body: labForm });
      notify('Laboratory added');
      setLabForm({ name: '', department: '', roomNumber: '', location: '' });
      load();
    } catch (error) { notify(error.message, 'error'); }
  };
  const reserveSession = async (session) => {
    try { await api(`/labs/sessions/${session._id}/reservation`, { method: 'POST', body: {} }); notify('Lab session reservation saved'); load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  const cancelSession = async (session) => {
    const late = new Date(session.startsAt).getTime() - Date.now() <= 2 * 60 * 60 * 1000;
    if (!window.confirm(late ? 'This is within two hours of the session. Request cancellation approval?' : 'Cancel this session reservation?')) return;
    try { const result = await api(`/labs/sessions/${session._id}/reservation`, { method: 'DELETE' }); notify(result.status === 'cancellation-requested' ? 'Cancellation request sent' : 'Reservation cancelled'); load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header><p className="landing-eyebrow"><CalendarDays className="h-4 w-4" /> LABORATORY SERVICES</p><h1 className="mt-2 text-3xl font-bold text-white">Laboratories &amp; schedules</h1><p className="mt-2 text-slate-400">Upcoming sessions and active laboratory locations.</p></header>
      {canCreateLab && <form onSubmit={createLab} className="card grid gap-3 p-5 sm:grid-cols-2"><h2 className="text-lg font-bold text-white sm:col-span-2">Add a laboratory</h2><input className="input" required placeholder="Laboratory name" value={labForm.name} onChange={(event) => setLabForm({ ...labForm, name: event.target.value })} /><input className="input" required placeholder="Department" value={labForm.department} onChange={(event) => setLabForm({ ...labForm, department: event.target.value })} /><input className="input" placeholder="Room number (e.g. CS-LAB-01)" value={labForm.roomNumber} onChange={(event) => setLabForm({ ...labForm, roomNumber: event.target.value })} /><input className="input" placeholder="Building or location (optional)" value={labForm.location} onChange={(event) => setLabForm({ ...labForm, location: event.target.value })} /><button className="btn-cyan sm:col-span-2 sm:justify-self-start" type="submit"><Plus className="h-4 w-4" />Add lab</button></form>}
      {canManage && labs.length > 0 && <form onSubmit={createSession} className="card grid gap-3 p-5 md:grid-cols-2"><h2 className="text-lg font-bold text-white md:col-span-2">Schedule a practical session</h2><select className="input" required value={form.laboratory} onChange={(event) => setForm({ ...form, laboratory: event.target.value })}><option value="">Select laboratory</option>{labs.map((lab) => <option key={lab._id} value={lab._id}>{lab.name} · {lab.department}</option>)}</select><input className="input" required placeholder="Session title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><label className="label">Starts<input type="datetime-local" className="input mt-1" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label className="label">Ends<input type="datetime-local" className="input mt-1" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label><input className="input" type="number" min="1" max="500" required placeholder="Seat capacity" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /><input className="input" placeholder="Academic year (optional)" value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /><input className="input" placeholder="Section (optional)" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} /><button type="submit" className="btn-cyan md:col-span-2 md:justify-self-start"><Plus className="h-4 w-4" />Schedule session</button></form>}
      <section className="grid gap-3 md:grid-cols-2">{labs.length ? labs.map((lab) => <article key={lab._id} className="card p-5"><h2 className="font-bold text-white">{lab.name}</h2><p className="mt-1 text-sm text-slate-400">{lab.department}{lab.roomNumber ? ` · ${lab.roomNumber}` : ''}{lab.location ? ` · ${lab.location}` : ''}</p><p className="mt-3 text-sm text-cyan-200">{lab.inCharge?.name || 'Lab In-Charge not assigned'}</p></article>) : <Empty>Laboratory records will appear here when configured.</Empty>}</section>
      <section className="card p-5"><h2 className="mb-3 text-lg font-bold text-white">Upcoming practical sessions</h2>{sessions.length ? <div className="divide-y divide-white/10">{sessions.map((session) => {
        const reservation = session.myReservation;
        const available = Math.max(0, (session.capacity || 0) - (session.bookedCount || 0));
        const sessionStatus = !session.capacity ? 'Booking not configured' : available ? 'Seats available' : 'Full · waitlist open';
        return <article key={session._id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold text-slate-100">{session.title}</h3><p className="mt-1 text-sm text-slate-400">{session.laboratory?.name} · {session.laboratory?.department} · {session.laboratory?.roomNumber || 'Room not recorded'}</p><p className="mt-1 text-sm text-slate-400">{fmt(session.startsAt)} – {new Date(session.endsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p></div><div className="flex flex-wrap items-start gap-2"><span className="slot-status">{sessionStatus}</span><p className="text-sm text-cyan-200">{available} / {session.capacity || 'Not configured'} seats available · {session.bookedCount || 0} booked</p></div></div>
          {user.role === 'student' && <div className="mt-3 flex flex-wrap items-center gap-2">{reservation && <span className="slot-status">{reservation.status.replaceAll('-', ' ')}</span>}{reservation?.status === 'booked' && <button className="btn-ghost" type="button" onClick={() => cancelSession(session)}>Cancel booking</button>}{reservation?.status === 'waitlisted' && <button className="btn-ghost" type="button" onClick={() => cancelSession(session)}>Leave waitlist</button>}{reservation?.status === 'cancellation-requested' && <span className="text-sm text-amber-200">Cancellation awaiting approval</span>}{!reservation && session.capacity > 0 && <button className="btn-cyan" type="button" onClick={() => reserveSession(session)}>{available ? 'Book session' : 'Join waitlist'}</button>}</div>}
          {canManageReservations && <SessionAdminControls session={session} notify={notify} refresh={load} canApproveCancellation={user.role === 'labInCharge'} />}
        </article>;
      })}</div> : <Empty>No upcoming sessions are scheduled.</Empty>}</section>
    </div>
  );
}

function MaintenanceView() {
  const { notify } = useApp();
  const [resources, setResources] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ resource: '', description: '' });
  const load = () => Promise.all([api('/resources').then(setResources), api('/maintenance').then(setItems)]).catch((error) => notify(error.message, 'error'));
  useEffect(() => { load(); }, []);
  const report = async (event) => {
    event.preventDefault();
    try { await api('/maintenance', { method: 'POST', body: form }); notify('Maintenance issue reported'); setForm({ resource: '', description: '' }); load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  const update = async (id, status) => {
    try { await api(`/maintenance/${id}`, { method: 'PATCH', body: { status } }); notify('Maintenance status updated'); load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8"><header><p className="landing-eyebrow"><Wrench className="h-4 w-4" /> EQUIPMENT CARE</p><h1 className="mt-2 text-3xl font-bold text-white">Maintenance</h1><p className="mt-2 text-slate-400">Report equipment problems and keep service status up to date.</p></header>
    <form onSubmit={report} className="card grid gap-3 p-5 md:grid-cols-[1fr_2fr_auto]"><select className="input" required value={form.resource} onChange={(event) => setForm({ ...form, resource: event.target.value })}><option value="">Select equipment</option>{resources.map((item) => <option key={item._id} value={item._id}>{item.name} · {item.lab}</option>)}</select><input className="input" required minLength={5} maxLength={2000} placeholder="Describe the issue" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><button className="btn-cyan" type="submit"><Plus className="h-4 w-4" />Report</button></form>
    <section className="space-y-3">{items.length ? items.map((item) => <article key={item._id} className="card flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-bold text-white">{item.resource?.name}</h2><p className="mt-1 text-sm text-slate-400">{item.resource?.lab} · Reported by {item.reportedBy?.name}</p><p className="mt-2 text-sm text-slate-300">{item.description}</p></div><div className="flex items-center gap-2"><Badge kind={item.status === 'resolved' ? 'approved' : 'pending'}>{statusLabel(item.status)}</Badge>{item.status !== 'resolved' && <select className="input min-w-36" value={item.status} onChange={(event) => update(item._id, event.target.value)}><option value="open">Open</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select>}</div></article>) : <Empty>No maintenance records.</Empty>}</section>
  </div>;
}

function UsersView() {
  const { notify } = useApp();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'student', department: '', password: '' });
  const load = () => api('/admin/users').then(setItems).catch((error) => notify(error.message, 'error'));
  useEffect(() => { load(); }, []);
  const create = async (event) => {
    event.preventDefault();
    try { await api('/admin/users', { method: 'POST', body: form }); notify('Account created'); setForm({ name: '', email: '', role: 'student', department: '', password: '' }); load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  const update = async (user, changes) => {
    try { await api(`/admin/users/${user.id}`, { method: 'PATCH', body: changes }); notify('Account updated'); load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-8"><header><p className="landing-eyebrow"><ShieldCheck className="h-4 w-4" /> SYSTEM ADMINISTRATION</p><h1 className="mt-2 text-3xl font-bold text-white">User accounts</h1><p className="mt-2 text-slate-400">Create accounts, assign roles and deactivate access when authorized.</p></header>
    <form onSubmit={create} className="card grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5"><input className="input" required placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input className="input" type="email" required placeholder="Institutional email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{roleOptions.map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select><input className="input" placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /><input className="input" required type="password" minLength={12} placeholder="Temporary password (12+)" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="submit" className="btn-cyan sm:col-span-2 xl:col-span-5 xl:justify-self-start"><Plus className="h-4 w-4" />Create account</button></form>
    <div className="card overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/5 text-slate-300"><tr><th className="p-3">Name</th><th>Email</th><th>Department</th><th>Role</th><th>Access</th></tr></thead><tbody>{items.map((user) => <tr key={user.id} className="border-t border-white/10"><td className="p-3 font-medium text-white">{user.name}</td><td>{user.email}</td><td>{user.department || '—'}</td><td><select className="input min-w-48" value={user.role} onChange={(event) => update(user, { role: event.target.value })}>{roleOptions.map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></td><td><button type="button" className={`question-filter ${user.active ? '' : 'question-filter-active'}`} onClick={() => update(user, { active: !user.active })}>{user.active ? 'Active' : 'Inactive'}</button></td></tr>)}</tbody></table></div>
  </div>;
}

function ProfileView({ user, onUpdated }) {
  const { notify, updateUser } = useApp();
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', designation: user.designation || '', academicYear: user.academicYear || '', semester: user.semester || '', section: user.section || '' });
  const keys = user.role === 'student' ? ['name', 'phone', 'academicYear', 'semester', 'section'] : ['name', 'phone', 'designation'];
  const labels = { name: 'Full name', phone: 'Contact phone', designation: 'Designation', academicYear: 'Academic year', semester: 'Semester', section: 'Section' };
  const save = async (event) => {
    event.preventDefault();
    try { const result = await api('/profile', { method: 'PATCH', body: Object.fromEntries(keys.map((key) => [key, form[key]])) }); updateUser(result.user); onUpdated(result.user); notify('Profile updated'); }
    catch (error) { notify(error.message, 'error'); }
  };
  return <div className="mx-auto max-w-3xl space-y-6 px-4 py-8"><header><p className="landing-eyebrow"><ShieldCheck className="h-4 w-4" /> ACCOUNT</p><h1 className="mt-2 text-3xl font-bold text-white">Your profile</h1><p className="mt-2 text-slate-400">Only editable profile fields are shown. Role and official email changes require an administrator.</p></header>
    <section className="card p-5 md:p-7"><div className="portal-profile-intro"><span className="role-dashboard-avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><h2 className="text-xl font-bold text-white">{user.name}</h2><p className="text-sm text-cyan-200">{user.role} · {user.email}</p></div></div><form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">{keys.map((key) => <div key={key}><label className="label" htmlFor={`profile-${key}`}>{labels[key]}</label><input id={`profile-${key}`} className="input" maxLength={120} required={key === 'name'} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></div>)}{user.studentId && <p className="text-sm text-slate-400">Student ID: {user.studentId}</p>}<div className="sm:col-span-2"><button className="btn-cyan" type="submit">Save profile</button></div></form></section>
  </div>;
}

function NotificationsView() {
  const { notify } = useApp();
  const [data, setData] = useState({ items: [], unread: 0 });
  const load = () => api('/notifications').then(setData).catch((error) => notify(error.message, 'error'));
  useEffect(() => { load(); }, []);
  const markRead = async (id) => {
    try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  const markAll = async () => {
    try { await api('/notifications/read-all', { method: 'PATCH' }); load(); notify('Notifications marked as read'); }
    catch (error) { notify(error.message, 'error'); }
  };
  return <div className="mx-auto max-w-4xl space-y-5 px-4 py-8"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="landing-eyebrow"><Bell className="h-4 w-4" /> YOUR UPDATES</p><h1 className="mt-2 text-3xl font-bold text-white">Notifications</h1><p className="mt-2 text-slate-400">{data.unread} unread notification{data.unread === 1 ? '' : 's'}</p></div><button className="btn-ghost" disabled={!data.unread} onClick={markAll}><CheckCheck className="h-4 w-4" />Mark all as read</button></header>
    <section className="space-y-3">{data.items.length ? data.items.map((item) => <article key={item._id} className={`card p-5 ${item.readAt ? '' : 'notification-unread'}`}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-white">{item.title}</h2><span className="text-xs text-slate-500">{fmt(item.createdAt)}</span></div><p className="mt-2 text-sm text-slate-300">{item.body}</p>{!item.readAt && <button className="mt-3 text-xs text-cyan-200" onClick={() => markRead(item._id)}>Mark as read</button>}</article>) : <Empty>No notifications yet.</Empty>}</section>
  </div>;
}

export default function PortalPage({ onUserUpdated }) {
  const { user } = useApp();
  const { pathname } = useLocation();
  const { queryId } = useParams();
  const view = useMemo(() => queryId ? 'queries' : pathname.split('/')[1], [pathname, queryId]);
  if (view === 'queries') return <QueriesView user={user} queryId={queryId} />;
  if (view === 'announcements') return <AnnouncementsView user={user} />;
  if (view === 'schedule') return <ScheduleView user={user} />;
  if (view === 'maintenance') return <MaintenanceView />;
  if (view === 'users') return <UsersView />;
  if (view === 'profile') return <ProfileView user={user} onUpdated={onUserUpdated || (() => {})} />;
  if (view === 'notifications') return <NotificationsView />;
  return <Empty>This page is not available.</Empty>;
}
