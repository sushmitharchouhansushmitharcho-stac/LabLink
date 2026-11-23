import React, { useEffect, useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { Badge, fmt, Empty } from '../ui.jsx';

const tabs = ['all', 'pending', 'approved', 'rejected', 'completed'];

export default function Bookings() {
  const [list, setList] = useState(null), [tab, setTab] = useState('all');
  const { notify } = useApp();
  const load = () => api('/bookings/mine').then(setList).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, []);
  const cancel = async (id) => {
    try { await api('/bookings/' + id, { method: 'DELETE' }); notify('Request cancelled'); load(); } catch (e) { notify(e.message, 'error'); }
  };
  const shown = (list || []).filter((b) => tab === 'all' || b.status === tab);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">My bookings</h1>
      <div className="mt-4 flex flex-wrap gap-2">{tabs.map((t) => (
        <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
          {t}{list && ` (${t === 'all' ? list.length : list.filter((b) => b.status === t).length})`}</button>))}</div>
      <div className="mt-5 space-y-3">
        {!list ? <p className="text-slate-500">Loading…</p> : shown.length === 0 ? <Empty>Nothing here yet.</Empty> : shown.map((b) => (
          <div key={b._id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <div className="font-bold">{b.resource?.name || 'Removed resource'}</div>
              <div className="text-sm text-slate-500">{fmt(b.startDate)} – {fmt(b.endDate)}</div>
              <div className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin className="h-3.5 w-3.5" />{b.resource?.lab}, {b.resource?.location}</div>
              <div className="mt-1 text-sm text-slate-600">{b.purpose}</div>
            </div>
            <div className="flex items-center gap-3"><Badge kind={b.status} />
              {b.status === 'pending' && <button className="btn-ghost" onClick={() => cancel(b._id)}><Trash2 className="h-4 w-4" />Cancel</button>}</div>
          </div>))}
      </div>
    </div>
  );
}
