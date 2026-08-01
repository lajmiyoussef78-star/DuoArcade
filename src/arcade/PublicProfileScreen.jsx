import { useState } from 'react';
import { createSync } from '../lib/sync.js';
import DuoProfileView from './DuoProfileView.jsx';

/**
 * Username public profile (lobby search) — pick a public duo to open the
 * full Duo Profile card.
 */
export default function PublicProfileScreen({ profile, onBack }) {
  const [duo, setDuo] = useState(null);
  const [status, setStatus] = useState('');

  if (!profile) return null;

  if (duo) {
    return (
      <DuoProfileView
        duo={duo}
        mode="public"
        onBack={() => setDuo(null)}
        status={status}
      />
    );
  }

  const openDuo = async d => {
    setStatus('Loading…');
    try {
      const sync = await createSync();
      if (!sync.getPublicDuo) throw new Error('Public duo lookup unavailable');
      const full = await sync.getPublicDuo(profile.username, d.name_a, d.name_b);
      setDuo(full);
      setStatus('');
    } catch (e) {
      setStatus(e.message || 'Could not open this duo.');
    }
  };

  const stats = d => {
    let a = 0, b = 0, dd = 0;
    for (const rec of Object.values(d.records || {})) { a += rec.a || 0; b += rec.b || 0; dd += rec.d || 0; }
    const taste = d.taste_total > 0 ? Math.round(100 * d.taste_agree / d.taste_total) + '%' : '—';
    return `${a + b + dd} games · ${d.evenings || 0} evenings · best streak ${d.best_streak || 0} · taste match ${taste}`;
  };

  return (
    <section className="on">
      <div className="card">
        <div className="duo-head">
          <h3 style={{ fontSize: 18 }}>@{profile.username}</h3>
          <button type="button" className="btn small ghost" onClick={onBack}>{'←'} Back</button>
        </div>
        <div>
          {!profile.duos.length && <div className="status">No public duos.</div>}
          {profile.duos.map((d, i) => (
            <button
              type="button"
              className="pub-duo"
              key={i}
              onClick={() => openDuo(d)}
              style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <div className="dn">{d.name_a} & {d.name_b}</div>
              <div className="dm">{stats(d)}</div>
            </button>
          ))}
          {status ? <div className="status">{status}</div> : null}
        </div>
      </div>
    </section>
  );
}
