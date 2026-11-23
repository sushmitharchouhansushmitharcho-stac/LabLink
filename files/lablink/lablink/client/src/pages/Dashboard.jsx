import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, ClipboardList, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { Stat, Badge, ResourceCard, fmt, Empty } from '../ui.jsx';

export default function Dashboard() {
  const { user, notify } = useApp();
  const nav = useNavigate();
  const [bookings, setBookings] = useState([]), [resources, setResources] = useState([]);
  useEffect(() => {
    api('/bookings/mine').then(setBookings).catch((e) => notify(e.message, 'error'));
    api('/resources?available=true').then(setResources).catch(() => {});
  }, []);
  const n = (s) => bookings.filter((b) => b.status === s).length;
  const picks = resources.filter((r) => r.recommendations.length).concat(resources).filter((r, i, a) => a.indexOf(r) === i).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Hello, {user.name.split(' ')[0]}</h1>
        <Link to="/assistant" className="btn-cyan"><Sparkles className="h-4 w-4" />Describe your project to the AI</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Clock} label="Pending requests" value={n('pending')} />
        <Stat icon={CheckCircle2} label="Approved" value={n('approved')} />
        <Stat icon={ClipboardList} label="Total requests" value={bookings.length} />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Available now</h2><Link to="/resources" className="text-sm font-medium text-cyan-600">Browse all</Link></div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{picks.map((r) => <ResourceCard key={r._id} r={r} onClick={() => nav('/resources/' + r._id)} />)}</div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Recent bookings</h2>
        {bookings.length === 0 ? <Empty>No requests yet. Pick equipment from the list above to make your first one.</Empty> : (
          <div className="card divide-y divide-slate-100">{bookings.slice(0, 5).map((b) => (
            <div key={b._id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div><div className="font-bold">{b.resource?.name}</div><div className="text-sm text-slate-500">{fmt(b.startDate)} – {fmt(b.endDate)}</div></div>
              <Badge kind={b.status} /></div>))}</div>)}
      </section>
    </div>
  );
}
