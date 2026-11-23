import React from 'react';
import {
  Cpu, Gauge, AppWindow, Server, Printer, FlaskConical, Code2, BrainCircuit, Cloud,
  Database, BookOpenCheck, BriefcaseBusiness, Sparkles,
} from 'lucide-react';

const icons = { 'Development Kit': Cpu, Instrument: Gauge, Software: AppWindow, Computing: Server, Fabrication: Printer };
const questionIcons = { Code2, BrainCircuit, Cloud, Database, Cpu, BookOpenCheck, BriefcaseBusiness };
export const CatIcon = ({ category, ...p }) => { const I = icons[category] || FlaskConical; return <I {...p} />; };
export const QuestionCategoryIcon = ({ name, ...props }) => { const I = questionIcons[name] || Sparkles; return <I {...props} />; };

const tone = {
  pending: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800', completed: 'bg-slate-200 text-slate-700',
  maintenance: 'bg-orange-100 text-orange-800', available: 'bg-cyan-100 text-cyan-800',
};
export const Badge = ({ kind, children }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${tone[kind] || tone.completed}`}>{children ?? kind}</span>
);
export const stockBadge = (r) => r.status === 'maintenance' ? <Badge kind="maintenance">Under maintenance</Badge>
  : r.available > 0 ? <Badge kind="available">{r.available} of {r.total} free</Badge> : <Badge kind="rejected">All in use</Badge>;

export const ResourceCard = ({ r, onClick }) => (
  <button onClick={onClick} className="card group flex flex-col overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex h-24 items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700">
      <CatIcon category={r.category} className="h-9 w-9 text-cyan-400" />
    </div>
    <div className="flex flex-1 flex-col gap-2 p-4">
      <h3 className="font-bold leading-snug">{r.name}</h3>
      <p className="text-sm text-slate-500">{r.department} · {r.lab}</p>
      <div className="mt-auto pt-1">{stockBadge(r)}</div>
    </div>
  </button>
);

export const Stat = ({ icon: I, label, value }) => (
  <div className="card flex items-center gap-4 p-5">
    <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-200"><I className="h-5 w-5" /></div>
    <div><div className="font-display text-2xl font-bold">{value}</div><div className="text-sm text-slate-500">{label}</div></div>
  </div>
);
export const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const Empty = ({ children }) => <div className="card p-10 text-center text-slate-500">{children}</div>;
