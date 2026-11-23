import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { ResourceCard, Empty } from '../ui.jsx';

export default function Resources() {
  const [q, setQ] = useState(''), [category, setCategory] = useState(''), [department, setDepartment] = useState(''), [available, setAvailable] = useState(false);
  const [items, setItems] = useState(null), [meta, setMeta] = useState({ categories: [], departments: [] });
  const { notify } = useApp();
  const nav = useNavigate();

  useEffect(() => { api('/resources/meta').then(setMeta).catch((e) => notify(e.message, 'error')); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams({ q, category, department, available });
      api('/resources?' + p).then(setItems).catch((e) => notify(e.message, 'error'));
    }, 250);
    return () => clearTimeout(t);
  }, [q, category, department, available]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold">Find lab resources</h1>
      <div className="card mt-5 grid gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search by name, purpose, lab… e.g. IoT, oscilloscope" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">All departments</option>{meta.departments.map((c) => <option key={c}>{c}</option>)}</select>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} /> Available now</label>
      </div>
      <div className="mt-6">
        {!items ? <p className="text-slate-500">Loading…</p> : items.length === 0 ? <Empty>No resources match. Try fewer filters or ask the AI assistant.</Empty> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((r) => <ResourceCard key={r._id} r={r} onClick={() => nav('/resources/' + r._id)} />)}</div>)}
      </div>
    </div>
  );
}
