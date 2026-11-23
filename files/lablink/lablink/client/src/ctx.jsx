import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const Ctx = createContext();
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('token')) return setReady(true);
    api('/auth/me').then((d) => setUser(d.user)).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  const signIn = (d) => { localStorage.setItem('token', d.token); setUser(d.user); };
  const signOut = () => { localStorage.removeItem('token'); setUser(null); };

  return (
    <Ctx.Provider value={{ user, ready, signIn, signOut, notify }}>
      {children}
      {toast && (
        <div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-navy-900 text-white'}`}>
          {toast.message}
        </div>
      )}
    </Ctx.Provider>
  );
}
