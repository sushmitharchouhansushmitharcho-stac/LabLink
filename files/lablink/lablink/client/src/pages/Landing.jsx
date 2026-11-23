import React from 'react';
import { Link } from 'react-router-dom';
import { Search, CalendarCheck, Sparkles, Share2, Activity, ShieldCheck, ArrowRight, FlaskConical } from 'lucide-react';
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
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-orb landing-orb-one" aria-hidden="true" />
        <div className="landing-orb landing-orb-two" aria-hidden="true" />
        <div className="landing-particles" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
          <div className="relative">
            <div className="landing-eyebrow"><FlaskConical className="h-4 w-4" /> THE CAMPUS LAB NETWORK</div>
            <h1 className="landing-title">LabLink</h1>
            <p className="landing-tagline">Connect. Collaborate. Create.</p>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 md:text-lg">One connected platform for discovering campus equipment, requesting lab access and bringing ambitious ideas to life.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? home(user) : '/auth?mode=register'} className="btn-cyan landing-cta">{user ? 'Open your dashboard' : 'Get Started'}<ArrowRight className="h-4 w-4" /></Link>
              {!user && <Link to="/auth" className="btn landing-login">Login</Link>}
            </div>
          </div>
          <div className="landing-preview">
            <div className="mb-4 flex items-center gap-2 text-sm text-cyan-200"><span className="relative flex h-3 w-3"><span className="pulse-ring absolute h-3 w-3 rounded-full bg-cyan-300" /><span className="h-3 w-3 rounded-full bg-cyan-300" /></span>Live availability</div>
            {[['NVIDIA Jetson Orin Nano', 'AI & ML Lab', '4 of 4 free'], ['Spectrum Analyzer', 'RF Lab', '1 of 2 free'], ['FPGA Artix-7 Board', 'VLSI Lab', '6 of 8 free']].map(([n, l, a]) => (
              <div key={n} className="landing-resource-row">
                <div><div className="font-semibold text-slate-100">{n}</div><div className="mt-1 text-sm text-slate-400">{l}</div></div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-200">{a}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="landing-features mx-auto max-w-7xl px-4 py-16 md:py-20">
        <div className="mb-8 max-w-2xl">
          <div className="landing-eyebrow">ONE PLATFORM. MORE POSSIBILITIES.</div>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">Built for how labs actually work</h2>
          <p className="mt-3 text-slate-400">From the first search to the final checkout, keep your campus projects moving.</p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([I, t, d]) => (
            <div key={t} className="feature-card"><div className="feature-icon"><I className="h-5 w-5" /></div><h3 className="mt-4 font-bold text-slate-100">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{d}</p></div>
          ))}
        </div>
      </section>
      <footer className="landing-footer">LabLink · Making college laboratories more accessible</footer>
    </div>
  );
}
