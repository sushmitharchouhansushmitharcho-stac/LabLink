import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { useApp } from './ctx.jsx';

export default function NotificationBell() {
  const { notify } = useApp();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const root = useRef(null);
  const load = () => api('/notifications').then(setData).catch((error) => notify(error.message, 'error'));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const markRead = async (id) => {
    try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); await load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  const markAllRead = async () => {
    try { await api('/notifications/read-all', { method: 'PATCH' }); await load(); }
    catch (error) { notify(error.message, 'error'); }
  };

  return (
    <div className="notification-root" ref={root}>
      <button type="button" className="notification-trigger" aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Bell className="h-4 w-4" />{data.unread > 0 && <span className="notification-count">{data.unread > 99 ? '99+' : data.unread}</span>}
      </button>
      {open && <div className="notification-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h2 className="font-semibold text-white">Notifications</h2><button type="button" className="text-xs text-cyan-200 disabled:opacity-40" disabled={!data.unread} onClick={markAllRead}><CheckCheck className="mr-1 inline h-3.5 w-3.5" />Mark all read</button></div>
        <div className="max-h-96 overflow-y-auto">{data.items.length ? data.items.map((item) => <button key={item._id} type="button" className={`notification-item ${!item.readAt ? 'notification-unread' : ''}`} onClick={() => markRead(item._id)}><span className="block font-medium text-slate-100">{item.title}</span><span className="mt-1 block text-sm text-slate-400">{item.body}</span><span className="mt-2 block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span></button>) : <p className="p-5 text-sm text-slate-400">You’re all caught up.</p>}</div>
        <Link to="/notifications" className="block border-t border-white/10 px-4 py-3 text-center text-sm text-cyan-200" onClick={() => setOpen(false)}>View notification center</Link>
      </div>}
    </div>
  );
}
