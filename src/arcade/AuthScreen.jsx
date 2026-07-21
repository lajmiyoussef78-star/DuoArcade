import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function AuthScreen({ notice, mode, onSubmit, defaultTab = 'in' }) {
  const [tab, setTab] = useState(defaultTab);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [status, setStatus] = useState(notice || '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setStatus('…');
    const msg = await onSubmit(tab, email.trim(), pw);
    setStatus(msg);
    setBusy(false);
  };

  return (
    <section className="on auth-gate">
      <div className="card">
        <div className="tabs">
          <div className={'tab' + (tab === 'in' ? ' on' : '')} onClick={() => setTab('in')}>Sign in</div>
          <div className={'tab' + (tab === 'up' ? ' on' : '')} onClick={() => setTab('up')}>Create account</div>
        </div>
        <label htmlFor="email">Email</label>
        <input type="email" id="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="password">Password</label>
        <input type="password" id="password" autoComplete="current-password" placeholder="••••••••"
          value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        <div className="row">
          <button className="btn warm" onClick={submit} disabled={busy}>
            {tab === 'in' ? 'Sign in' : 'Create account'}
          </button>
          <Link className="btn ghost small" to="/">Back</Link>
        </div>
        <div className="status">{status}</div>
        {mode && (
          <div className={'mode-pill ' + mode}>
            {mode === 'supabase' ? 'live sync · supabase' : 'demo mode · this browser only'}
          </div>
        )}
      </div>
    </section>
  );
}
