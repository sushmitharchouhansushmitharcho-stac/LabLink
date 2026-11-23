import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpenCheck, Eye, EyeOff, FlaskConical, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { home } from '../App.jsx';

const roles = [
  { id: 'student', label: 'Student', icon: UserRound },
  { id: 'facultyCoordinator', label: 'Faculty Coordinator', icon: UsersRound },
  { id: 'labInCharge', label: 'Lab In-Charge', icon: FlaskConical },
  { id: 'dean', label: 'Dean', icon: BookOpenCheck },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

export default function Auth() {
  const [sp] = useSearchParams();
  const [mode, setMode] = useState(sp.get('mode') === 'register' ? 'register' : 'login');
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student', department: '' });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const { signIn, notify } = useApp();
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const d = await api(`/auth/${mode}`, { method: 'POST', body: mode === 'login' ? { ...f, remember } : { ...f, role: 'student' } });
      signIn(d); notify(mode === 'login' ? `Welcome back, ${d.user.name}` : 'Account created'); nav(home(d.user));
    } catch (err) { notify(err.message, 'error'); } finally { setBusy(false); }
  };
  const selectedRole = roles.find((role) => role.id === f.role);
  return (
    <div className="auth-scene">
      <div className="auth-glow auth-glow-cyan" aria-hidden="true" />
      <div className="auth-glow auth-glow-blue" aria-hidden="true" />
      <div className="auth-grid" aria-hidden="true" />
      <form onSubmit={submit} className="auth-card">
        <div className="mb-7 text-center">
          <div className="auth-brand">
            <FlaskConical className="h-7 w-7 text-cyan-300" />
            <span>LabLink</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">Your medical laboratory community, connected.</p>
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold text-white">{mode === 'login' ? 'Welcome to LabLink' : 'Create your student account'}</h1>
        {mode === 'login' && <p className="mb-4 text-center text-sm text-slate-400">Choose your role to continue securely.</p>}
        {mode === 'login' && <div className="auth-role-grid" role="group" aria-label="Select your role">
          {roles.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} className={`auth-role-option ${f.role === id ? 'auth-role-selected' : ''}`} aria-pressed={f.role === id} onClick={() => setF((current) => ({ ...current, role: id }))}>
              <Icon className="h-4 w-4" /><span>{label}</span>
            </button>
          ))}
        </div>}
        {mode === 'register' && (<>
          <div><label className="auth-label">Full name</label><input className="auth-input" required value={f.name} onChange={set('name')} /></div>
          <div><label className="auth-label">Department</label><input className="auth-input" placeholder="e.g. Electronics" value={f.department} onChange={set('department')} /></div>
        </>)}
        <div><label className="auth-label" htmlFor="auth-email">Institutional email</label><input id="auth-email" type="email" className="auth-input" required autoComplete="username" value={f.email} onChange={set('email')} placeholder="name@institution.edu" /></div>
        <div>
          <label className="auth-label" htmlFor="auth-password">Password</label>
          <div className="auth-password-wrap">
            <input id="auth-password" type={showPassword ? 'text' : 'password'} minLength={mode === 'register' ? 8 : undefined} className="auth-input" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {mode === 'login' && <label className="auth-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Remember me <span className="ml-auto text-xs text-cyan-100/70">{selectedRole?.label}</span></label>}
        <button className="auth-submit" disabled={busy}>{busy ? <><span className="auth-spinner" />Signing in…</> : mode === 'login' ? `Sign in as ${selectedRole?.label || 'Student'}` : 'Create student account'}</button>
        <button type="button" className="w-full text-sm text-cyan-300 hover:text-cyan-200 hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create an account' : 'Already registered? Log in'}</button>
        {mode === 'login' && <p className="text-center text-xs text-slate-500">Need access? Contact your institution’s LabLink administrator.</p>}
      </form>
    </div>
  );
}
