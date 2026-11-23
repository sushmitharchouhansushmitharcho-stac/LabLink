import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { FlaskConical, LogOut, Menu, X } from 'lucide-react';
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
import Questions from './pages/Questions.jsx';
import RoleDashboard from './pages/RoleDashboard.jsx';
import PortalPage from './pages/PortalPage.jsx';
import MedicalBackdrop from './MedicalBackdrop.jsx';
import NotificationBell from './NotificationBell.jsx';

const links = {
  student: [['/dashboard', 'Dashboard'], ['/queries', 'My queries'], ['/questions', 'Community'], ['/resources', 'Equipment'], ['/bookings', 'My bookings'], ['/schedule', 'Lab schedule']],
  facultyCoordinator: [['/faculty', 'Dashboard'], ['/queries', 'Student queries'], ['/questions', 'Community'], ['/announcements', 'Announcements'], ['/schedule', 'Lab schedule']],
  labInCharge: [['/lab', 'Dashboard'], ['/manage', 'Bookings & equipment'], ['/queries', 'Lab queries'], ['/maintenance', 'Maintenance'], ['/schedule', 'Lab schedule'], ['/announcements', 'Announcements']],
  dean: [['/dean', 'Overview'], ['/analytics', 'Reports'], ['/queries', 'Queries'], ['/announcements', 'Announcements']],
  admin: [['/admin', 'System admin'], ['/manage', 'Bookings & equipment'], ['/users', 'User accounts'], ['/resources', 'Inventory'], ['/analytics', 'Reports']],
};
export const home = (u) => ({
  student: '/dashboard',
  facultyCoordinator: '/faculty',
  faculty: '/faculty',
  labInCharge: '/lab',
  dean: '/dean',
  admin: '/admin',
}[u?.role] || '/');

function Nav() {
  const { user, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const items = user ? links[user.role] : [];
  const cls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-cyan-300/10 text-cyan-200' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`;
  return (
    <header className="app-header sticky top-0 z-40 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to={user ? home(user) : '/'} className="app-logo flex items-center gap-2 font-display text-lg font-extrabold">
          <FlaskConical className="h-6 w-6 text-cyan-300" /> LabLink
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {items.map(([to, l]) => <NavLink key={to} to={to} className={cls}>{l}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (<>
            <span className="text-sm text-slate-300">{user.name} <span className="rounded bg-cyan-400/20 px-1.5 py-0.5 text-xs text-cyan-300">{user.role}</span></span>
            <NotificationBell />
            <Link to="/profile" className="rounded-lg px-2 py-1 text-sm text-cyan-100 hover:bg-white/10">Profile</Link>
            <button onClick={() => { signOut(); nav('/'); }} className="rounded-lg p-2 hover:bg-white/10" aria-label="Log out"><LogOut className="h-4 w-4" /></button>
          </>) : <><Link to="/auth" className="text-sm font-medium text-slate-300 hover:text-white">Log in</Link><Link to="/auth?mode=register" className="btn-cyan">Get started</Link></>}
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="flex flex-col gap-1 border-t border-white/10 px-4 pb-4 pt-2 lg:hidden" onClick={() => setOpen(false)}>
          {items.map(([to, l]) => <NavLink key={to} to={to} className={cls}>{l}</NavLink>)}
          {user && <><NavLink to="/profile" className={cls}>My profile</NavLink><NavLink to="/notifications" className={cls}>Notifications</NavLink></>}
          {user ? <button className="px-3 py-2 text-left text-sm text-slate-300" onClick={() => { signOut(); nav('/'); }}>Log out</button>
            : <><Link to="/auth" className="px-3 py-2 text-sm text-slate-300">Log in</Link><Link to="/auth?mode=register" className="px-3 py-2 text-sm font-bold text-cyan-200">Get started</Link></>}
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
  const location = useLocation();
  return (
    <AppProvider>
      <Nav />
      <main className="app-main">
        <MedicalBackdrop />
        <div key={location.pathname} className="page-transition">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/welcome" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Guard roles={['student']}><Dashboard /></Guard>} />
          <Route path="/faculty" element={<Guard roles={['facultyCoordinator']}><RoleDashboard /></Guard>} />
          <Route path="/lab" element={<Guard roles={['labInCharge']}><RoleDashboard /></Guard>} />
          <Route path="/dean" element={<Guard roles={['dean']}><RoleDashboard /></Guard>} />
          <Route path="/admin" element={<Guard roles={['admin']}><RoleDashboard /></Guard>} />
          <Route path="/queries" element={<Guard><PortalPage /></Guard>} />
          <Route path="/queries/:queryId" element={<Guard><PortalPage /></Guard>} />
          <Route path="/announcements" element={<Guard><PortalPage /></Guard>} />
          <Route path="/schedule" element={<Guard><PortalPage /></Guard>} />
          <Route path="/maintenance" element={<Guard roles={['labInCharge', 'admin']}><PortalPage /></Guard>} />
          <Route path="/users" element={<Guard roles={['admin']}><PortalPage /></Guard>} />
          <Route path="/profile" element={<Guard><PortalPage /></Guard>} />
          <Route path="/notifications" element={<Guard><PortalPage /></Guard>} />
          <Route path="/questions" element={<Guard><Questions /></Guard>} />
          <Route path="/questions/:questionId" element={<Guard><Questions /></Guard>} />
          <Route path="/resources" element={<Guard><Resources /></Guard>} />
          <Route path="/resources/:id" element={<Guard><ResourceDetail /></Guard>} />
          <Route path="/bookings" element={<Guard roles={['student']}><Bookings /></Guard>} />
          <Route path="/manage" element={<Guard roles={['labInCharge', 'admin']}><Manage /></Guard>} />
          <Route path="/analytics" element={<Guard roles={['facultyCoordinator', 'dean', 'admin']}><Analytics /></Guard>} />
          <Route path="/assistant" element={<Guard><Assistant /></Guard>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </div>
      </main>
    </AppProvider>
  );
}
