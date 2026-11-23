import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { home } from '../App.jsx';

export default function Auth() {
  const [sp] = useSearchParams();
  const [mode, setMode] = useState(sp.get('mode') === 'register' ? 'register' : 'login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student', department: '', code: '' });
  const [busy, setBusy] = useState(false);
  const { signIn, notify } = useApp();
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const d = await api(`/auth/${mode}`, { method: 'POST', body: f });
      signIn(d); notify(mode === 'login' ? `Welcome back, ${d.user.name}` : 'Account created'); nav(home(d.user));
    } catch (err) { notify(err.message, 'error'); } finally { setBusy(false); }
  };
  const demo = (email) => setF({ ...f, email, password: 'password123' });

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h1 className="text-2xl font-bold">{mode === 'login' ? 'Log in to LabLink' : 'Create your account'}</h1>
        {mode === 'register' && (<>
          <div><label className="label">I am a</label>
            <select className="input" value={f.role} onChange={set('role')}><option value="student">Student</option><option value="faculty">Faculty</option><option value="admin">Laboratory administrator</option></select></div>
          <div><label className="label">Full name</label><input className="input" required value={f.name} onChange={set('name')} /></div>
          <div><label className="label">Department</label><input className="input" placeholder="e.g. Electronics" value={f.department} onChange={set('department')} /></div>
          {f.role !== 'student' && <div><label className="label">Invite code</label><input className="input" required value={f.code} onChange={set('code')} /></div>}
        </>)}
        <div><label className="label">Email</label><input type="email" className="input" required value={f.email} onChange={set('email')} /></div>
        <div><label className="label">Password</label><input type="password" minLength={6} className="input" required value={f.password} onChange={set('password')} /></div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        <button type="button" className="w-full text-sm text-cyan-600 hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already registered? Log in'}</button>
        {mode === 'login' && (
          <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
            Demo accounts (password <b>password123</b>):
            <div className="mt-2 flex flex-wrap gap-2">{['student', 'faculty', 'admin'].map((r) => (
              <button type="button" key={r} className="rounded-lg bg-white px-2 py-1 font-medium shadow-sm" onClick={() => demo(`${r}@lablink.edu`)}>{r}</button>))}</div>
          </div>)}
      </form>
    </div>
  );
}
