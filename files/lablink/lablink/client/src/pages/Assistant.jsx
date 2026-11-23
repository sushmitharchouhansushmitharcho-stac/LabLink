import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../ctx.jsx';
import { ResourceCard } from '../ui.jsx';

const examples = ['I am building an IoT weather station with a camera', 'I need to train a small vision model', 'Which labs can help with a wireless antenna project?'];

export default function Assistant() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: 'Tell me about your project and I will find the equipment, kits and software across all departments that fit it.' }]);
  const [input, setInput] = useState(''), [busy, setBusy] = useState(false);
  const { notify } = useApp();
  const nav = useNavigate();
  const end = useRef();
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = async (text) => {
    if (!text.trim() || busy) return;
    const history = msgs.slice(1).map(({ role, text }) => ({ role, text }));
    setMsgs((m) => [...m, { role: 'user', text }]); setInput(''); setBusy(true);
    try {
      const d = await api('/ai/recommend', { method: 'POST', body: { message: text, history } });
      setMsgs((m) => [...m, { role: 'assistant', text: d.reply, resources: d.resources }]);
    } catch (e) { notify(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-8" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <h1 className="flex items-center gap-2 text-3xl font-bold"><Sparkles className="h-7 w-7 text-cyan-500" />AI resource assistant</h1>
      <div className="mt-5 flex-1 space-y-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-navy-900 text-white' : 'card'}`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.resources?.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">{m.resources.map((r) => <ResourceCard key={r._id} r={r} onClick={() => nav('/resources/' + r._id)} />)}</div>}
            </div>
          </div>))}
        {busy && <div className="card inline-block px-4 py-3 text-sm text-slate-500">Thinking…</div>}
        {msgs.length === 1 && <div className="flex flex-wrap gap-2">{examples.map((e) => <button key={e} className="btn-ghost !text-xs" onClick={() => send(e)}>{e}</button>)}</div>}
        <div ref={end} />
      </div>
      <form className="sticky bottom-4 mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input className="input shadow" placeholder="Describe your project…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn-primary" disabled={busy} aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
