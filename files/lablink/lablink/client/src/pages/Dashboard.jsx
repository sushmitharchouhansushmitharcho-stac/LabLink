import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, CalendarCheck, CalendarClock, CalendarDays, CheckCircle2,
  ClipboardList, Clock, DoorOpen, MessageCircle, Search, Sparkles, TrendingUp, UserRound,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { Stat, Badge, ResourceCard, QuestionCategoryIcon, fmt, Empty } from '../ui.jsx';

const dateKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dayNumber = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
const timeRange = (start, end) => `${new Date(start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${new Date(end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
const slotState = (status) => ({
  booked: ['Booked', 'slot-status-booked'],
  waitlisted: ['Waitlist', 'slot-status-waitlisted'],
  'cancellation-requested': ['Cancellation requested', 'slot-status-requested'],
}[status] || ['Not booked', '']);

function activityBuckets(range, timeline) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const span = range === 'week' ? 7 : range === 'month' ? 30 : 182;
  const start = new Date(today);
  start.setDate(start.getDate() - span + 1);
  const weekly = range === 'semester';
  const size = weekly ? 7 : 1;
  const count = Math.ceil(span / size);
  const buckets = Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index * size);
    return {
      key: dayNumber(date),
      label: weekly ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      questions: 0,
      queries: 0,
      bookings: 0,
      practicals: 0,
    };
  });
  for (const [key, values] of Object.entries(timeline || {})) {
    const date = new Date(`${key}T12:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const offset = dayNumber(date) - dayNumber(start);
    const index = Math.floor(offset / size);
    if (index < 0 || index >= buckets.length) continue;
    for (const type of ['bookings', 'queries', 'questions', 'practicals']) buckets[index][type] += values[type] || 0;
  }
  return buckets;
}

function DiscussionList({ title, icon: Icon, questions, categories, empty, action }) {
  return (
    <section className="card p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Icon className="h-4 w-4 text-cyan-300" />{title}</h2>
        {action && <Link className="text-sm font-medium text-cyan-200 hover:text-white" to={action}>View all</Link>}
      </div>
      {!questions.length ? <p className="text-sm text-slate-400">{empty}</p> : (
        <div className="divide-y divide-white/10">
          {questions.map((question) => {
            const category = categories.find((item) => item.id === question.category);
            return (
              <Link key={question._id} to={`/questions/${question._id}`} className="dashboard-question">
                <span className="dashboard-question-icon"><QuestionCategoryIcon name={category?.icon} className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-100">{question.title}</span>
                  <span className="mt-1 block text-xs text-slate-400">{category?.name || question.category} · {question.answerCount || 0} responses</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SessionCard({ session, resources, onBook, onCancel, busy }) {
  const reservation = session.myReservation;
  const labName = session.laboratory?.name || 'Laboratory not recorded';
  const room = session.laboratory?.roomNumber || 'Room not recorded';
  const matchingResources = resources.filter((resource) => resource.lab?.trim().toLowerCase() === labName.trim().toLowerCase());
  const equipmentAvailable = matchingResources.length
    ? matchingResources.reduce((sum, resource) => sum + (Number(resource.available) || 0), 0)
    : null;
  const availableSeats = Math.max(0, (Number(session.capacity) || 0) - (Number(session.bookedCount) || 0));
  const sessionStatus = !session.capacity ? 'Booking not configured' : availableSeats ? 'Seats available' : 'Full · waitlist open';
  const startsAt = new Date(session.startsAt);
  const cancellationNeedsApproval = startsAt.getTime() - Date.now() <= 2 * 60 * 60 * 1000;
  const [reservationLabel, reservationClass] = slotState(reservation?.status);
  return (
    <article className="lab-slot-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-cyan-200">{session.laboratory?.department || 'Laboratory session'}</p>
          <h3 className="mt-1 text-lg font-bold text-white">{session.title}</h3>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><CalendarClock className="h-4 w-4 text-cyan-300" />{fmt(session.startsAt)} · {timeRange(session.startsAt, session.endsAt)}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-400"><DoorOpen className="h-4 w-4 text-cyan-300" />{labName} · {room}</p>
        </div>
        <div className="flex flex-wrap gap-2"><span className="slot-status">{sessionStatus}</span>{reservation && <span className={`slot-status ${reservationClass}`}>{reservationLabel}{reservation.status === 'waitlisted' && reservation.waitlistPosition ? ` #${reservation.waitlistPosition}` : ''}</span>}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="slot-metric"><span>Seats</span><strong>{availableSeats} / {session.capacity || 'Not configured'}</strong></div>
        <div className="slot-metric"><span>Booked</span><strong>{session.bookedCount || 0}</strong></div>
        <div className="slot-metric col-span-2 sm:col-span-1"><span>Equipment available</span><strong>{equipmentAvailable === null ? 'Inventory not linked' : equipmentAvailable}</strong></div>
      </div>
      {reservation?.status === 'booked' && <button className="btn-ghost mt-4 w-full sm:w-auto" disabled={busy} onClick={() => onCancel(session, cancellationNeedsApproval)}>{cancellationNeedsApproval ? 'Request cancellation approval' : 'Cancel booking'}</button>}
      {reservation?.status === 'waitlisted' && <button className="btn-ghost mt-4 w-full sm:w-auto" disabled={busy} onClick={() => onCancel(session, false)}>Leave waitlist</button>}
      {reservation?.status === 'cancellation-requested' && <p className="mt-4 text-sm text-amber-200">Your late cancellation request is waiting for Lab In-Charge approval.</p>}
      {!reservation && session.capacity > 0 && <button className="btn-cyan mt-4 w-full sm:w-auto" disabled={busy} onClick={() => onBook(session)}>{availableSeats > 0 ? 'Book this session' : 'Join waitlist'}</button>}
      {!reservation && !session.capacity && <p className="mt-4 text-sm text-slate-400">Booking capacity has not been configured for this session.</p>}
    </article>
  );
}

function WeeklyTimetable({ sessions }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
  return (
    <section className="card p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-xl font-bold text-white">Weekly timetable</h2><p className="mt-1 text-sm text-slate-400">Scheduled practical sessions for the next seven days. Empty days mean no session is recorded, not confirmed lab availability.</p></div>
        <Link to="/schedule" className="text-sm font-medium text-cyan-200 hover:text-white">Full schedule <ArrowRight className="inline h-4 w-4" /></Link>
      </div>
      <div className="weekly-timetable">
        {days.map((day) => {
          const matches = sessions.filter((session) => dateKey(session.startsAt) === dateKey(day));
          return <div key={dateKey(day)} className="timetable-day">
            <div className="timetable-date"><span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>{day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong></div>
            {matches.length ? matches.map((session) => <Link key={session._id} className="timetable-session" to="/schedule"><span>{timeRange(session.startsAt, session.endsAt)}</span><strong>{session.title}</strong><small>{session.laboratory?.name || 'Lab not recorded'}</small></Link>) : <p className="timetable-empty">No session scheduled</p>}
          </div>;
        })}
      </div>
    </section>
  );
}

function ActivityChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="activityQueries" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d9ff" stopOpacity={0.45} /><stop offset="95%" stopColor="#00d9ff" stopOpacity={0.02} /></linearGradient>
          <linearGradient id="activityBookings" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#258bff" stopOpacity={0.4} /><stop offset="95%" stopColor="#258bff" stopOpacity={0.02} /></linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(169,189,212,.12)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fill: '#a9bdd4', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis allowDecimals={false} tick={{ fill: '#a9bdd4', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#0a1d33', border: '1px solid rgba(0,217,255,.25)', borderRadius: 12, color: '#f5faff' }} />
        <Area type="monotone" dataKey="queries" name="Student queries" stroke="#00d9ff" fill="url(#activityQueries)" strokeWidth={2} />
        <Area type="monotone" dataKey="bookings" name="Equipment bookings" stroke="#258bff" fill="url(#activityBookings)" strokeWidth={2} />
        <Area type="monotone" dataKey="questions" name="Community questions" stroke="#8b7bff" fill="transparent" strokeWidth={2} />
        <Area type="monotone" dataKey="practicals" name="Attended practicals" stroke="#36d399" fill="transparent" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard() {
  const { user, notify } = useApp();
  const nav = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentQuestions, setRecentQuestions] = useState([]);
  const [popularQuestions, setPopularQuestions] = useState([]);
  const [myQuestions, setMyQuestions] = useState([]);
  const [myCommunityQuestions, setMyCommunityQuestions] = useState([]);
  const [studentQueries, setStudentQueries] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('week');
  const [busySession, setBusySession] = useState('');
  const loadSlots = useCallback(async () => {
    try {
      const [upcoming, mine] = await Promise.all([api('/labs/sessions'), api('/labs/sessions/mine')]);
      setSessions(upcoming);
      setMySessions(mine);
    } catch (error) { notify(error.message, 'error'); }
  }, [notify]);
  useEffect(() => {
    api('/bookings/mine').then(setBookings).catch((error) => notify(error.message, 'error'));
    api('/resources?available=true').then(setResources).catch(() => {});
    api('/questions/categories').then(setCategories).catch((error) => notify(error.message, 'error'));
    api('/questions?sort=recent&limit=5').then((data) => setRecentQuestions(data.items)).catch((error) => notify(error.message, 'error'));
    api('/questions?sort=popular&limit=4').then((data) => setPopularQuestions(data.items)).catch((error) => notify(error.message, 'error'));
    api('/questions?mine=true&limit=4').then((data) => setMyQuestions(data.items)).catch((error) => notify(error.message, 'error'));
    api('/questions?mine=true&limit=100').then((data) => setMyCommunityQuestions(data.items)).catch((error) => notify(error.message, 'error'));
    api('/queries?mine=true').then(setStudentQueries).catch((error) => notify(error.message, 'error'));
    loadSlots();
  }, [loadSlots, notify]);
  useEffect(() => {
    let active = true;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setActivityData(null);
    setActivityLoading(true);
    api(`/student/activity?range=${range}&timeZone=${encodeURIComponent(timeZone)}`)
      .then((data) => { if (active) setActivityData(data); })
      .catch((error) => { if (active) notify(error.message, 'error'); })
      .finally(() => { if (active) setActivityLoading(false); });
    return () => { active = false; };
  }, [range, notify]);
  const n = (status) => bookings.filter((booking) => booking.status === status).length;
  const picks = resources.filter((resource) => resource.recommendations?.length).concat(resources).filter((resource, index, array) => array.indexOf(resource) === index).slice(0, 4);
  const submitSearch = (event) => {
    event.preventDefault();
    nav('/questions?q=' + encodeURIComponent(search.trim()));
  };
  const handleBook = async (session) => {
    setBusySession(session._id);
    try {
      await api(`/labs/sessions/${session._id}/reservation`, { method: 'POST', body: {} });
      notify('Lab session reservation saved');
      await loadSlots();
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusySession(''); }
  };
  const handleCancel = async (session, needsApproval) => {
    const text = needsApproval
      ? 'This session starts within two hours. Submit a cancellation request to the Lab In-Charge?'
      : 'Cancel your lab session reservation?';
    if (!window.confirm(text)) return;
    setBusySession(session._id);
    try {
      const result = await api(`/labs/sessions/${session._id}/reservation`, { method: 'DELETE' });
      notify(result.status === 'cancellation-requested' ? 'Cancellation request sent for approval' : 'Lab session reservation cancelled');
      await loadSlots();
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusySession(''); }
  };
  const chartData = useMemo(() => activityData ? activityBuckets(range, activityData.timeline) : [], [range, activityData]);
  const recordedActivityCount = chartData.reduce((sum, item) => sum + item.bookings + item.queries + item.questions + item.practicals, 0);
  const attendedCount = activityData?.attendance.attended || 0;
  const attendancePercentage = activityData?.attendance.recorded ? Math.round((attendedCount / activityData.attendance.recorded) * 100) : null;
  const upcomingSessions = sessions.filter((session) => new Date(session.startsAt) >= new Date());
  const recentActivity = [
    ...bookings.map((item) => ({ date: item.createdAt, title: `Equipment booking: ${item.resource?.name || 'Equipment'}`, detail: `Request status: ${item.status}`, icon: ClipboardList })),
    ...studentQueries.map((item) => ({ date: item.createdAt, title: `Query submitted: ${item.title}`, detail: item.status.replaceAll('-', ' '), icon: MessageCircle })),
    ...myCommunityQuestions.map((item) => ({ date: item.createdAt, title: `Community question: ${item.title}`, detail: item.category, icon: MessageCircle })),
    ...mySessions.filter((item) => ['attended', 'absent'].includes(item.myReservation?.attendanceStatus)).map((item) => ({
      date: item.startsAt, title: item.myReservation.attendanceStatus === 'attended' ? `Practical completed: ${item.title}` : `Practical attendance recorded: ${item.title}`,
      detail: `${item.laboratory?.name || 'Lab'} · ${item.myReservation.attendanceStatus}`, icon: CalendarCheck,
    })),
    ...mySessions.filter((item) => item.myReservation?.status === 'booked' && new Date(item.startsAt) > new Date()).map((item) => ({
      date: item.startsAt, title: `Upcoming practical: ${item.title}`, detail: `${item.laboratory?.name || 'Lab'} · ${fmt(item.startsAt)}`, icon: CalendarClock,
    })),
  ].filter((item) => item.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-sm font-medium text-cyan-200">YOUR LABLINK DASHBOARD</p><h1 className="mt-1 text-3xl font-bold text-white">Welcome back, {user.name.split(' ')[0]}</h1></div>
        <Link to="/assistant" className="btn-cyan"><Sparkles className="h-4 w-4" />Describe your project to the AI</Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form onSubmit={submitSearch} className="dashboard-search"><Search className="h-5 w-5 text-cyan-200" /><input aria-label="Search questions" placeholder="Search questions, topics, or tags…" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="btn-cyan" type="submit">Search</button></form>
        <div className="dashboard-profile"><span className="dashboard-profile-icon"><UserRound className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate font-semibold text-white">{user.name}</p><p className="text-sm capitalize text-slate-400">{user.role}{user.department ? ` · ${user.department}` : ''}</p></div></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Clock} label="Pending equipment requests" value={n('pending')} />
        <Stat icon={CheckCircle2} label="Approved equipment requests" value={n('approved')} />
        <Stat icon={CalendarCheck} label="Practicals attended" value={activityData ? attendedCount : '—'} />
        <Stat icon={ClipboardList} label="Queries submitted" value={activityData?.lifetime.queries ?? '—'} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="landing-eyebrow"><CalendarClock className="h-4 w-4" /> LABORATORY SESSIONS</p><h2 className="mt-2 text-2xl font-bold text-white">My lab slots</h2><p className="mt-1 text-sm text-slate-400">Real scheduled sessions, live seat counts, and your reservation status.</p></div><Link to="/bookings" className="text-sm font-medium text-cyan-200 hover:text-white">Equipment requests <ArrowRight className="inline h-4 w-4" /></Link></div>
        {upcomingSessions.length ? <div className="grid gap-4 lg:grid-cols-2">{upcomingSessions.map((session) => <SessionCard key={session._id} session={session} resources={resources} onBook={handleBook} onCancel={handleCancel} busy={busySession === session._id} />)}</div> : <Empty>No upcoming lab sessions are available to book. Check back after your department schedules one.</Empty>}
      </section>

      <WeeklyTimetable sessions={upcomingSessions} />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,.8fr)]">
        <div className="card p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><Activity className="h-5 w-5 text-cyan-300" />Student activity analytics</h2><p className="mt-1 text-sm text-slate-400">Counts of your recorded bookings, queries, community posts, and attended practicals.</p></div>
            <label className="sr-only" htmlFor="activity-range">Activity timeframe</label><select id="activity-range" className="input max-w-44" value={range} onChange={(event) => setRange(event.target.value)}><option value="week">Last 7 days</option><option value="month">Last 30 days</option><option value="semester">Last 26 weeks</option></select>
          </div>
          <div className="activity-chart">{activityData ? <ActivityChart data={chartData} /> : <p className="grid h-full place-items-center text-sm text-slate-400">{activityLoading ? 'Loading your activity records…' : 'Activity data is unavailable.'}</p>}</div>
          <div className="chart-legend"><span><i className="legend-dot cyan" />Queries</span><span><i className="legend-dot blue" />Equipment bookings</span><span><i className="legend-dot violet" />Community questions</span><span><i className="legend-dot green" />Attended practicals</span></div>
        </div>
        <div className="activity-score-card">
          <div className="activity-score-ring"><span>{activityData ? recordedActivityCount : '—'}</span><small>events</small></div>
          <h3 className="mt-4 text-xl font-bold text-white">Activity score</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Verified activity records in the selected timeframe. This is a raw count, not a grade or an estimate.</p>
          <p className="mt-4 text-xs text-slate-400">No attendance is counted unless a Lab In-Charge records it.</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white"><TrendingUp className="h-5 w-5 text-cyan-300" />Progress overview</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="progress-metric"><span>Recorded attendance</span><strong>{activityData ? attendancePercentage === null ? 'Not recorded' : `${attendancePercentage}%` : activityLoading ? 'Loading…' : 'Unavailable'}</strong><small>{activityData ? activityData.attendance.recorded ? `${attendedCount} attended of ${activityData.attendance.recorded} recorded` : 'No attendance records yet' : 'Attendance service unavailable'}</small></div>
            <div className="progress-metric"><span>Completed practicals</span><strong>{activityData ? attendedCount : '—'}</strong><small>Based on recorded attendance</small></div>
            <div className="progress-metric"><span>Pending assignments</span><strong>Not tracked</strong><small>Assignment records are not configured in this portal</small></div>
            <div className="progress-metric"><span>Activity trend</span><strong>{activityData ? activityData.lifetime.bookings + activityData.lifetime.queries + activityData.lifetime.questions + attendedCount : '—'}</strong><small>Actual records across all tracked categories</small></div>
          </div>
        </div>
        <section className="card p-5 md:p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white"><Clock className="h-5 w-5 text-cyan-300" />Recent activity</h2>
          {recentActivity.length ? <div className="mt-3 divide-y divide-white/10">{recentActivity.map((item, index) => {
            const Icon = item.icon;
            return <article key={`${item.title}-${item.date}-${index}`} className="recent-activity-row"><span className="dashboard-question-icon"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-100">{item.title}</p><p className="mt-1 text-xs capitalize text-slate-400">{item.detail} · {fmt(item.date)}</p></div></article>;
          })}</div> : <p className="mt-3 text-sm text-slate-400">Your recorded bookings, posts, queries, and practical attendance will appear here.</p>}
        </section>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div><h2 className="flex items-center gap-2 text-lg font-bold text-white"><CalendarDays className="h-5 w-5 text-cyan-300" />Deadlines and attendance</h2><p className="mt-1 text-sm text-slate-400">Assignment due dates and attendance data will appear when institutional records are connected.</p></div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">No assignment feed configured</span>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-xl font-bold text-white">Choose your platform</h2><p className="mt-1 text-sm text-slate-400">Browse questions by subject, or pick a category when you post.</p></div><Link to="/questions" className="inline-flex items-center gap-1 text-sm font-medium text-cyan-200 hover:text-white">All discussions<ArrowRight className="h-4 w-4" /></Link></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => <Link key={category.id} to={`/questions?category=${category.id}`} className="dashboard-category"><span className="question-category-icon"><QuestionCategoryIcon name={category.icon} className="h-5 w-5" /></span><span className="mt-3 block font-semibold text-slate-100">{category.name}</span><span className="mt-1 block text-sm leading-5 text-slate-400">{category.description}</span></Link>)}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <DiscussionList title="Recent questions" icon={MessageCircle} questions={recentQuestions} categories={categories} empty="No questions yet. Start a discussion with your community." action="/questions" />
        <DiscussionList title="Popular discussions" icon={TrendingUp} questions={popularQuestions} categories={categories} empty="Popular discussions will appear here as people respond." action="/questions?sort=popular" />
        <DiscussionList title="My questions" icon={UserRound} questions={myQuestions} categories={categories} empty="Questions you post will be saved here." action="/questions?mine=true" />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Available now</h2><Link to="/resources" className="text-sm font-medium text-cyan-200">Browse all</Link></div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{picks.map((resource) => <ResourceCard key={resource._id} r={resource} onClick={() => nav('/resources/' + resource._id)} />)}</div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Recent equipment bookings</h2>
        {bookings.length === 0 ? <Empty>No equipment requests yet. Pick equipment from the list above to make your first one.</Empty> : (
          <div className="card divide-y divide-white/10">{bookings.slice(0, 5).map((booking) => (
            <div key={booking._id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div><div className="font-bold">{booking.resource?.name}</div><div className="text-sm text-slate-400">{fmt(booking.startDate)} – {fmt(booking.endDate)}</div></div>
              <Badge kind={booking.status} /></div>))}</div>)}
      </section>
    </div>
  );
}
