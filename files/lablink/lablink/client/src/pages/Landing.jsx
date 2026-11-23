import React from 'react';
import { Link } from 'react-router-dom';
import { Search, CalendarCheck, Sparkles, Share2, Activity, ShieldCheck } from 'lucide-react';
import { useApp } from '../ctx.jsx';
import { home } from '../App.jsx';

const features = [
  [Search, 'Find equipment across labs', 'Search every department by name, category or purpose, with specs and room numbers.'],
  [CalendarCheck, 'Book in minutes', 'Pick dates, state your purpose, and track approval from pending to completed.'],
  [Sparkles, 'Ask the AI assistant', 'Describe your project in plain language and get kit recommendations with reasons.'],
  [Share2, 'Share between departments', 'Expensive instruments stop sitting idle when other departments can request them.'],
  [Activity, 'Live availability', 'Free units update as soon as a booking is approved or returned.'],
  [ShieldCheck, 'Role-based access', 'Students request, faculty review, lab admins manage the inventory.'],
];

export default function Landing() {
  const { user } = useApp();
  return (
    <>
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Every lab on campus, one request away.</h1>
            <p className="mt-5 max-w-lg text-lg text-slate-300">LabLink connects students, faculty and lab administrators so specialised equipment, dev kits and software reach the people who need them.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? home(user) : '/auth?mode=register'} className="btn-cyan">{user ? 'Open your dashboard' : 'Create a student account'}</Link>
              {!user && <Link to="/auth" className="btn border border-white/30 text-white hover:bg-white/10">Log in</Link>}
            </div>
          </div>
          <div className="card border-white/10 bg-white/5 p-6 text-white backdrop-blur">
            <div className="mb-4 flex items-center gap-2 text-sm text-cyan-300"><span className="relative flex h-3 w-3"><span className="pulse-ring absolute h-3 w-3 rounded-full bg-cyan-400" /><span className="h-3 w-3 rounded-full bg-cyan-400" /></span>Live availability</div>
            {[['NVIDIA Jetson Orin Nano', 'AI & ML Lab', '4 of 4 free'], ['Spectrum Analyzer', 'RF Lab', '1 of 2 free'], ['FPGA Artix-7 Board', 'VLSI Lab', '6 of 8 free']].map(([n, l, a]) => (
              <div key={n} className="flex items-center justify-between border-t border-white/10 py-3 first:border-0">
                <div><div className="font-bold">{n}</div><div className="text-sm text-slate-400">{l}</div></div>
                <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-bold text-cyan-300">{a}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="max-w-xl text-3xl font-bold">Built for how labs actually work</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([I, t, d]) => (
            <div key={t} className="card p-6"><I className="h-6 w-6 text-cyan-600" /><h3 className="mt-4 font-bold">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>
          ))}
        </div>
      </section>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">LabLink – Making College Laboratories More Accessible</footer>
    </>
  );
}
