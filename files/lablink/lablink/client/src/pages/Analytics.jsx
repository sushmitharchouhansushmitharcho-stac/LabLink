import React, { useEffect, useState } from 'react';
import { Boxes, Activity, Wrench, ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { Stat } from '../ui.jsx';

const COLORS = ['#06b6d4', '#12305a', '#22d3ee', '#1b447e', '#67e8f9', '#0b1f3a'];
const Box = ({ title, children }) => <div className="card p-5"><h2 className="mb-3 font-bold">{title}</h2><div className="h-64">{children}</div></div>;

export default function Analytics() {
  const [d, setD] = useState(null);
  const { notify } = useApp();
  useEffect(() => { api('/analytics').then(setD).catch((e) => notify(e.message, 'error')); }, []);
  if (!d) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  const t = d.totals, util = t.units ? Math.round((t.inUse / t.units) * 100) : 0;
  const empty = (arr) => arr.length === 0 && <p className="pt-20 text-center text-sm text-slate-500">No approved bookings yet.</p>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Resource utilisation</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Boxes} label={`Equipment types (${t.units} units)`} value={t.resources} />
        <Stat icon={Activity} label="Units in use today" value={`${t.inUse} (${util}%)`} />
        <Stat icon={ClipboardList} label="Requests waiting" value={t.pending} />
        <Stat icon={Wrench} label="Under maintenance" value={t.maintenance} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Box title="Most requested equipment">{empty(d.topResources) || <ResponsiveContainer><BarChart data={d.topResources} layout="vertical" margin={{ left: 40 }}><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" fill="#06b6d4" radius={6} /></BarChart></ResponsiveContainer>}</Box>
        <Box title="Bookings by department">{empty(d.byDepartment) || <ResponsiveContainer><PieChart><Pie data={d.byDepartment} dataKey="value" nameKey="name" outerRadius={90} label>{d.byDepartment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>}</Box>
        <Box title="Requests per month">{empty(d.byMonth) || <ResponsiveContainer><LineChart data={d.byMonth}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="value" stroke="#12305a" strokeWidth={3} /></LineChart></ResponsiveContainer>}</Box>
        <Box title="Request outcomes">{empty(d.byStatus) || <ResponsiveContainer><BarChart data={d.byStatus}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#12305a" radius={6} /></BarChart></ResponsiveContainer>}</Box>
      </div>
      {d.maintenance.length > 0 && <div className="card p-5"><h2 className="mb-2 font-bold">Maintenance queue</h2>{d.maintenance.map((m) => <p key={m.name} className="text-sm text-slate-600">{m.name} — {m.lab}</p>)}</div>}
    </div>
  );
}
