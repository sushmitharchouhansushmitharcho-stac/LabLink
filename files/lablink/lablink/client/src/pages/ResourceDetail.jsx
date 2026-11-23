import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Building2, ThumbsUp } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { CatIcon, stockBadge } from '../ui.jsx';

export default function ResourceDetail() {
  const { id } = useParams();
  const { user, notify } = useApp();
  const nav = useNavigate();
  const [r, setR] = useState(null);
  const [form, setForm] = useState({ startDate: '', endDate: '', purpose: '' });
  const [note, setNote] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const load = () => api('/resources/' + id).then(setR).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, [id]);
  if (!r) return <div className="p-10 text-center text-slate-500">Loading…</div>;

  const book = async (e) => {
    e.preventDefault();
    try { await api('/bookings', { method: 'POST', body: { ...form, resource: id } }); notify('Request sent. Track it under My bookings.'); nav('/bookings'); }
    catch (err) { notify(err.message, 'error'); }
  };
  const recommend = async () => {
    try { setR(await api(`/resources/${id}/recommend`, { method: 'POST', body: { note } })); setNote(''); notify('Recommendation added'); }
    catch (err) { notify(err.message, 'error'); }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-5">
        <div className="card overflow-hidden">
          <div className="flex h-44 items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700"><CatIcon category={r.category} className="h-16 w-16 text-cyan-400" /></div>
          <div className="space-y-3 p-6">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{r.name}</h1>{stockBadge(r)}</div>
            <p className="text-slate-600">{r.description}</p>
            <div className="flex flex-wrap gap-5 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" />{r.department} · {r.lab}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{r.location}</span>
            </div>
          </div>
        </div>
        <div className="card p-6"><h2 className="font-bold">Specifications</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{r.specs.map((s) => <li key={s} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">{s}</li>)}</ul></div>
        {r.recommendations.length > 0 && (
          <div className="card p-6"><h2 className="font-bold">Faculty recommendations</h2>
            {r.recommendations.map((x, i) => <p key={i} className="mt-2 text-sm text-slate-600"><b>{x.by}:</b> {x.note}</p>)}</div>)}
      </div>
      <aside className="space-y-5">
        {user.role === 'student' && (
          <form onSubmit={book} className="card space-y-3 p-6">
            <h2 className="font-bold">Request this equipment</h2>
            <div><label className="label">From</label><input type="date" min={today} required className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="label">To</label><input type="date" min={form.startDate || today} required className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div><label className="label">Purpose</label><textarea className="input" rows={3} required placeholder="What will you use it for?" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            <button className="btn-primary w-full" disabled={r.status === 'maintenance'}>{r.status === 'maintenance' ? 'Unavailable during maintenance' : 'Send request'}</button>
          </form>)}
        {user.role === 'faculty' && (
          <div className="card space-y-3 p-6"><h2 className="font-bold">Recommend for projects</h2>
            <textarea className="input" rows={3} placeholder="Which projects or courses is this suited to?" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-cyan w-full" onClick={recommend}><ThumbsUp className="h-4 w-4" />Add recommendation</button></div>)}
        {user.role === 'admin' && <div className="card p-6 text-sm text-slate-600">Edit this item under <b>Manage → Resources</b>.</div>}
      </aside>
    </div>
  );
}
