import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Bell, CalendarDays, CheckCircle2, ClipboardList, FlaskConical,
  PackageCheck, ShieldCheck, Users, Wrench,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { Stat, Empty } from '../ui.jsx';

const headings = {
  facultyCoordinator: ['Faculty Coordinator', 'Coordinate student support and academic activity.'],
  labInCharge: ['Laboratory Operations', 'Manage your laboratory equipment, bookings and maintenance.'],
  dean: ['Institution Overview', 'Review aggregate activity and institutional reports.'],
  admin: ['System Administration', 'Manage accounts and platform access securely.'],
};

function QuickLink({ to, icon: Icon, title, description }) {
  return <Link to={to} className="portal-quick-link"><span className="portal-quick-icon"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-100">{title}</span><span className="mt-1 block text-sm text-slate-400">{description}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" /></Link>;
}

export default function RoleDashboard() {
  const { user, notify } = useApp();
  const [stats, setStats] = useState(null);
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, subtitle] = headings[user.role] || headings.admin;

  useEffect(() => {
    let active = true;
    const calls = [
      api('/announcements').then((items) => { if (active) setAnnouncements(items); }),
      api('/resources').then((items) => { if (active) setResources(items); }),
      api('/labs/sessions').then((items) => { if (active) setSessions(items); }),
    ];
    if (['facultyCoordinator', 'dean', 'admin'].includes(user.role)) {
      calls.push(api('/portal/stats').then((data) => { if (active) setStats(data); }));
    }
    if (['labInCharge', 'admin'].includes(user.role)) {
      calls.push(
        api('/bookings').then((items) => { if (active) setBookings(items); }),
        api('/maintenance').then((items) => { if (active) setMaintenance(items); }),
      );
    }
    Promise.all(calls).catch((error) => { if (active) notify(error.message, 'error'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [notify, user.role]);

  const statsCards = user.role === 'facultyCoordinator' || user.role === 'dean' || user.role === 'admin'
    ? [
      [Users, 'Registered students', stats?.students ?? '—'],
      [ClipboardList, 'Pending queries', stats?.pendingQueries ?? '—'],
      [CheckCircle2, 'Resolved queries', stats?.resolvedQueries ?? '—'],
      [FlaskConical, 'Laboratories', stats?.laboratories ?? '—'],
    ]
    : [
      [PackageCheck, 'Equipment records', resources.length],
      [ClipboardList, 'Pending bookings', bookings.filter((item) => item.status === 'pending').length],
      [Wrench, 'Open maintenance', maintenance.filter((item) => item.status !== 'resolved').length],
      [CalendarDays, 'Upcoming sessions', sessions.length],
    ];

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 md:py-10">
      <header className="role-dashboard-heading">
        <div className="min-w-0">
          <p className="landing-eyebrow">{title.toUpperCase()}</p>
          <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">Welcome, {user.name.split(' ')[0]}</h1>
          <p className="mt-2 max-w-2xl text-slate-400">{subtitle}</p>
        </div>
        <div className="role-dashboard-avatar" aria-label={`Signed in as ${title}`}>{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsCards.map(([icon, label, value]) => <Stat key={label} icon={icon} label={label} value={loading ? '…' : value} />)}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold text-white">Your workspace</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {user.role === 'facultyCoordinator' && <>
            <QuickLink to="/queries" icon={ClipboardList} title="Student queries" description="Review, respond to, assign and track student requests." />
            <QuickLink to="/announcements" icon={Bell} title="Academic announcements" description="Publish updates for students and coordinators." />
            <QuickLink to="/schedule" icon={CalendarDays} title="Lab sessions" description="Review the upcoming practical schedule." />
            <QuickLink to="/analytics" icon={CheckCircle2} title="Query reports" description="Review current query status totals." />
          </>}
          {user.role === 'labInCharge' && <>
            <QuickLink to="/manage" icon={PackageCheck} title="Bookings & equipment" description="Review bookings and maintain equipment inventory." />
            <QuickLink to="/maintenance" icon={Wrench} title="Maintenance" description="Report damage and track equipment service work." />
            <QuickLink to="/queries" icon={ClipboardList} title="Assigned lab queries" description="Respond to equipment and practical questions." />
            <QuickLink to="/schedule" icon={CalendarDays} title="Laboratory schedule" description="Manage upcoming practical sessions." />
            <QuickLink to="/announcements" icon={Bell} title="Lab announcements" description="Share laboratory updates with students." />
          </>}
          {user.role === 'dean' && <>
            <QuickLink to="/analytics" icon={CheckCircle2} title="Institution reports" description="Review authorized institutional statistics." />
            <QuickLink to="/queries" icon={ClipboardList} title="Query overview" description="Monitor query volume and resolution status." />
            <QuickLink to="/announcements" icon={Bell} title="Important announcements" description="Publish institution-wide notices." />
          </>}
          {user.role === 'admin' && <>
            <QuickLink to="/users" icon={ShieldCheck} title="User accounts & roles" description="Create accounts and manage authorized access." />
            <QuickLink to="/manage" icon={PackageCheck} title="Bookings & inventory" description="Review equipment requests and catalogue records." />
            <QuickLink to="/analytics" icon={CheckCircle2} title="Platform reports" description="Review aggregate platform activity." />
            <QuickLink to="/schedule" icon={CalendarDays} title="Laboratories & schedule" description="Configure labs and avoid schedule conflicts." />
          </>}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {['dean', 'admin'].includes(user.role) && stats && (
          <section className="card p-5 md:p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Institution snapshot</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[['Faculty Coordinators', stats.faculty], ['Lab In-Charges', stats.labInCharges], ['Equipment units', stats.equipmentUnits], ['Units available', stats.availableUnits], ['Pending bookings', stats.pendingBookings], ['Total queries', stats.totalQueries]].map(([label, value]) => (
                <div key={label} className="portal-stat-cell"><dt className="text-slate-400">{label}</dt><dd className="mt-1 text-xl font-bold text-cyan-100">{value}</dd></div>
              ))}
            </dl>
          </section>
        )}
        {user.role === 'labInCharge' && (
          <section className="card p-5 md:p-6">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold text-white">Pending equipment requests</h2><Link to="/manage" className="text-sm text-cyan-200">Review</Link></div>
            {bookings.filter((item) => item.status === 'pending').slice(0, 4).map((item) => <p key={item._id} className="border-t border-white/10 py-3 text-sm text-slate-300">{item.resource?.name} · {item.user?.name} · {new Date(item.startDate).toLocaleDateString()}</p>)}
            {!bookings.some((item) => item.status === 'pending') && <Empty>No pending equipment requests.</Empty>}
          </section>
        )}
        <section className="card p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold text-white">Recent announcements</h2><Link to="/announcements" className="text-sm text-cyan-200">View all</Link></div>
          {announcements.length ? announcements.slice(0, 4).map((item) => <article key={item._id} className="border-t border-white/10 py-3 first:border-0"><h3 className="font-semibold text-slate-100">{item.title}{item.important && <span className="ml-2 text-xs text-cyan-200">Important</span>}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-400">{item.body}</p></article>) : <Empty>No announcements are available for your role.</Empty>}
        </section>
      </div>
    </div>
  );
}
