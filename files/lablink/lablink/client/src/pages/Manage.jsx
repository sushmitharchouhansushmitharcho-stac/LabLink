import React, { useEffect, useState } from 'react';
import { Check, X, Pencil, Trash2, Plus, PackageCheck } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { Badge, fmt, Empty, stockBadge } from '../ui.jsx';

/* ---------------- Requests (faculty + admin) ---------------- */
function Requests() {
  const [list, setList] = useState(null), [f, setF] = useState('pending');
  const { notify } = useApp();
  const load = () => api('/bookings').then(setList).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, []);
  const act = async (id, status) => {
    try { await api(`/bookings/${id}/status`, { method: 'PATCH', body: { status } }); notify(`Request ${status}`); load(); } catch (e) { notify(e.message, 'error'); }
  };
  const shown = (list || []).filter((b) => f === 'all' || b.status === f);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">{['pending', 'approved', 'rejected', 'completed', 'all'].map((t) => (
        <button key={t} onClick={() => setF(t)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${f === t ? 'bg-navy-900 text-white' : 'bg-white ring-1 ring-slate-200'}`}>{t}</button>))}</div>
      {!list ? <p className="text-slate-500">Loading…</p> : shown.length === 0 ? <Empty>No {f} requests.</Empty> : (
        <div className="space-y-3">{shown.map((b) => (
          <div key={b._id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <div className="font-bold">{b.resource?.name}</div>
              <div className="text-sm text-slate-500">{b.user?.name} ({b.user?.department || 'n/a'}) · {fmt(b.startDate)} – {fmt(b.endDate)}</div>
              <div className="mt-1 text-sm text-slate-600">{b.purpose}</div>
            </div>
            <div className="flex items-center gap-2"><Badge kind={b.status} />
              {b.status === 'pending' && <><button className="btn-primary" onClick={() => act(b._id, 'approved')}><Check className="h-4 w-4" />Approve</button>
                <button className="btn-ghost" onClick={() => act(b._id, 'rejected')}><X className="h-4 w-4" />Reject</button></>}
              {b.status === 'approved' && <><button className="btn-cyan" onClick={() => act(b._id, 'completed')}><PackageCheck className="h-4 w-4" />Mark returned</button>
                <button className="btn-ghost" onClick={() => act(b._id, 'rejected')}>Revoke</button></>}
            </div>
          </div>))}</div>)}
    </div>
  );
}

/* ---------------- Resources (admin) ---------------- */
const blank = { name: '', category: 'Development Kit', department: '', lab: '', location: '', description: '', specs: '', tags: '', total: 1, status: 'active' };
function ResourcesAdmin() {
  const [list, setList] = useState([]), [form, setForm] = useState(null);
  const { notify } = useApp();
  const load = () => api('/resources').then(setList).catch((e) => notify(e.message, 'error'));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const body = { ...form, total: Number(form.total), specs: form.specs.split('\n').map((s) => s.trim()).filter(Boolean), tags: form.tags.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) };
    try {
      if (form._id) await api('/resources/' + form._id, { method: 'PUT', body }); else await api('/resources', { method: 'POST', body });
      notify(form._id ? 'Equipment updated' : 'Equipment added'); setForm(null); load();
    } catch (err) { notify(err.message, 'error'); }
  };
  const remove = async (r) => {
    if (!confirm(`Remove ${r.name} and its bookings?`)) return;
    try { await api('/resources/' + r._id, { method: 'DELETE' }); notify('Equipment removed'); load(); } catch (e) { notify(e.message, 'error'); }
  };
  const toggle = async (r) => {
    try { await api('/resources/' + r._id, { method: 'PUT', body: { status: r.status === 'active' ? 'maintenance' : 'active' } }); load(); } catch (e) { notify(e.message, 'error'); }
  };

  if (form) return (
    <form onSubmit={save} className="card grid gap-4 p-6 md:grid-cols-2">
      <h2 className="text-xl font-bold md:col-span-2">{form._id ? 'Edit equipment' : 'Add equipment'}</h2>
      {[['name', 'Name'], ['category', 'Category'], ['department', 'Department'], ['lab', 'Laboratory'], ['location', 'Location']].map(([k, l]) => (
        <div key={k}><label className="label">{l}</label><input className="input" required value={form[k]} onChange={set(k)} /></div>))}
      <div><label className="label">Total units</label><input type="number" min={1} className="input" value={form.total} onChange={set('total')} /></div>
      <div><label className="label">Status</label><select className="input" value={form.status} onChange={set('status')}><option value="active">Active</option><option value="maintenance">Under maintenance</option></select></div>
      <div><label className="label">Tags (comma separated)</label><input className="input" value={form.tags} onChange={set('tags')} /></div>
      <div className="md:col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={set('description')} /></div>
      <div className="md:col-span-2"><label className="label">Specifications (one per line)</label><textarea className="input" rows={4} value={form.specs} onChange={set('specs')} /></div>
      <div className="flex gap-3 md:col-span-2"><button className="btn-primary">Save equipment</button><button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
    </form>
  );
  return (
    <div>
      <button className="btn-cyan mb-4" onClick={() => setForm(blank)}><Plus className="h-4 w-4" />Add equipment</button>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">Name</th><th>Department</th><th>Lab</th><th>Availability</th><th className="pr-3 text-right">Actions</th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r._id} className="border-t border-slate-100">
              <td className="p-3 font-medium">{r.name}</td><td>{r.department}</td><td>{r.lab}</td><td>{stockBadge(r)}</td>
              <td className="space-x-1 whitespace-nowrap pr-3 text-right">
                <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => toggle(r)}>{r.status === 'active' ? 'Set maintenance' : 'Mark active'}</button>
                <button className="btn-ghost !px-2.5 !py-1.5" aria-label="Edit" onClick={() => setForm({ ...r, specs: r.specs.join('\n'), tags: r.tags.join(', ') })}><Pencil className="h-4 w-4" /></button>
                <button className="btn-ghost !px-2.5 !py-1.5 text-red-600" aria-label="Delete" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></button>
              </td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Users (admin) ---------------- */
function Users() {
  const [list, setList] = useState([]);
  useEffect(() => { api('/users').then(setList).catch(() => {}); }, []);
  return (
    <div className="card overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Department</th></tr></thead>
      <tbody>{list.map((u) => <tr key={u.id} className="border-t border-slate-100"><td className="p-3 font-medium">{u.name}</td><td>{u.email}</td><td className="capitalize">{u.role}</td><td>{u.department}</td></tr>)}</tbody>
    </table></div>
  );
}

export default function Manage() {
  const { user } = useApp();
  const tabs = [['requests', 'Booking requests'], ...(user.role === 'admin' ? [['resources', 'Resources'], ['users', 'Users']] : [])];
  const [tab, setTab] = useState('requests');
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">{user.role === 'admin' ? 'Laboratory administration' : `Requests for ${user.department || 'your department'}`}</h1>
      <div className="mb-6 mt-4 flex gap-6 border-b border-slate-200">{tabs.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 pb-2 text-sm font-bold ${tab === k ? 'border-cyan-500 text-navy-900' : 'border-transparent text-slate-500'}`}>{l}</button>))}</div>
      {tab === 'requests' ? <Requests /> : tab === 'resources' ? <ResourcesAdmin /> : <Users />}
    </div>
  );
}
