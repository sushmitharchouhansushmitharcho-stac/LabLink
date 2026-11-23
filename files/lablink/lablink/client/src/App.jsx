import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, FlaskConical } from 'lucide-react';
import { AppProvider, useApp } from './ctx.jsx';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Resources from './pages/Resources.jsx';
import ResourceDetail from './pages/ResourceDetail.jsx';
import Bookings from './pages/Bookings.jsx';
import Manage from './pages/Manage.jsx';
import Analytics from './pages/Analytics.jsx';
import Assistant from './pages/Assistant.jsx';

const links = {
  student: [['/dashboard', 'Dashboard'], ['/resources', 'Resources'], ['/bookings', 'My bookings'], ['/assistant', 'AI assistant']],
  faculty: [['/manage', 'Requests'], ['/resources', 'Resources'], ['/analytics', 'Usage'], ['/assistant', 'AI assistant']],
  admin: [['/manage', 'Manage'], ['/resources', 'Resources'], ['/analytics', 'Analytics'], ['/assistant', 'AI assistant']],
};
export const home = (u) => (u?.role === 'student' ? '/dashboard' : '/manage');

function Nav() {
  const { user, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const items = user ? links[user.role] : [];
  const cls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-slate-300 hover:text-white'}`;
  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white shadow">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to={user ? home(user) : '/'} className="flex items-center gap-2 font-display text-lg font-extrabold">
          <FlaskConical className="h-6 w-6 text-cyan-400" /> LabLink
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {items.map(([to, l]) => <NavLink key={to} to={to} className={cls}>{l}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (<>
            <span className="text-sm text-slate-300">{user.name} <span className="rounded bg-cyan-400/20 px-1.5 py-0.5 text-xs text-cyan-300">{user.role}</span></span>
            <button onClick={() => { signOut(); nav('/'); }} className="rounded-lg p-2 hover:bg-white/10" aria-label="Log out"><LogOut className="h-4 w-4" /></button>
          </>) : <><Link to="/auth" className="text-sm font-medium text-slate-300 hover:text-white">Log in</Link><Link to="/auth?mode=register" className="btn-cyan">Get started</Link></>}
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="flex flex-col gap-1 border-t border-white/10 px-4 pb-4 pt-2 md:hidden" onClick={() => setOpen(false)}>
          {items.map(([to, l]) => <NavLink key={to} to={to} className={cls}>{l}</NavLink>)}
          {user ? <button className="px-3 py-2 text-left text-sm text-slate-300" onClick={() => { signOut(); nav('/'); }}>Log out</button>
            : <Link to="/auth" className="px-3 py-2 text-sm text-slate-300">Log in</Link>}
        </div>
      )}
    </header>
  );
}

function Guard({ roles, children }) {
  const { user, ready } = useApp();
  if (!ready) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={home(user)} replace />;
  return children;
}

export default function App() {
  return (
    <AppProvider>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Guard roles={['student']}><Dashboard /></Guard>} />
          <Route path="/resources" element={<Guard><Resources /></Guard>} />
          <Route path="/resources/:id" element={<Guard><ResourceDetail /></Guard>} />
          <Route path="/bookings" element={<Guard roles={['student']}><Bookings /></Guard>} />
          <Route path="/manage" element={<Guard roles={['faculty', 'admin']}><Manage /></Guard>} />
          <Route path="/analytics" element={<Guard roles={['faculty', 'admin']}><Analytics /></Guard>} />
          <Route path="/assistant" element={<Guard><Assistant /></Guard>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </AppProvider>
  );
}
