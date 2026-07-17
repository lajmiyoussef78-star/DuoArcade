// src/arcade/SoccerCard.jsx — Micro Soccer home-screen card.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSoccer } from '../lib/soccer.js';
import '../styles/soccer.css';

export default function SoccerCard({ code }) {
  const [rec, setRec] = useState({ a: 0, b: 0, d: 0 });
  useEffect(() => { loadSoccer(code).then(setRec).catch(() => {}); }, [code]);
  const played = rec.a + rec.b + rec.d;
  return (
    <div className="scc">
      <div className="scc-emoji">{'\u26BD'}</div>
      <div className="scc-body">
        <h3>Micro Soccer</h3>
        <p>Two cars, one ball, 90 seconds of chaos. Nudge it into their net — highest score wins.</p>
        <div className="scc-rec">{played > 0 ? `record ${rec.a}\u2013${rec.b}${rec.d ? ' \u00b7 ' + rec.d + ' draws' : ''}` : 'no matches yet'}</div>
      </div>
      <Link className="btn warm small" to={`/soccer/${code}`}>Kick off</Link>
    </div>
  );
}
