// ChallengeCard.jsx — home-screen challenge CTA (arena-entry style).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  challengeChannel, duoNames, getChallenges, scoreOf,
} from '../lib/challenges.js';
import ChallengeCreateModal from './ChallengeCreateModal.jsx';
import '../styles/challenges.css';

function live(list) {
  return (list || []).find(c => c.status === 'pending' || c.status === 'active') || null;
}

function DuelMark() {
  return (
    <svg className="chal-entry-mark" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <circle className="chal-entry-mark-bg" cx="24" cy="24" r="22" />
      <path
        className="chal-entry-mark-stroke"
        d="M14 34 L20 14 L24 20 L28 14 L34 34"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="chal-entry-dot a" cx="18" cy="30" r="2.2" />
      <circle className="chal-entry-dot b" cx="30" cy="30" r="2.2" />
    </svg>
  );
}

export default function ChallengeCard({ code, myRole }) {
  const navigate = useNavigate();
  const [cur, setCur] = useState(null);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await getChallenges(code);
      setCur(live(rows));
    } catch (_) {
      setCur(null);
    }
  }, [code]);

  const closeCreate = useCallback(() => setCreateOpen(false), []);

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    let ch = null;
    (async () => {
      try {
        setNames(await duoNames(code));
        const rows = await getChallenges(code);
        if (alive) setCur(live(rows));
      } catch (_) {
        if (alive) setCur(null);
      }
      try {
        ch = await challengeChannel(code);
        if (!alive) { ch.close(); return; }
        ch.on(async m => {
          if (m?.k !== 'chal') return;
          try {
            const rows = await getChallenges(code);
            if (alive) setCur(live(rows));
          } catch (_) { /* ignore */ }
        });
      } catch (_) { /* ignore */ }
    })();
    return () => {
      alive = false;
      ch?.close();
    };
  }, [code]);

  if (!code) return null;

  let title = 'Challenge your partner';
  let sub = 'Best of three games. Winner picks the stake.';
  let liveOn = false;

  if (cur?.status === 'pending') {
    liveOn = true;
    if (cur.created_by === myRole) {
      title = `Waiting on ${names[cur.created_by === 'A' ? 'B' : 'A']}`;
      sub = cur.stake;
    } else {
      title = `Challenge from ${names[cur.created_by]}`;
      sub = cur.stake;
    }
  } else if (cur?.status === 'active') {
    liveOn = true;
    const sc = scoreOf(cur);
    title = `Challenge · ${sc.a}–${sc.b}`;
    sub = cur.stake;
  }

  const onClick = () => {
    if (liveOn) {
      navigate(`/challenges/${encodeURIComponent(code)}`);
      return;
    }
    setCreateOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={'chal-entry' + (liveOn ? ' live' : '')}
        id="sect-challenges"
        onClick={onClick}
      >
        <DuelMark />
        <div className="chal-entry-copy">
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
        <strong className="chal-entry-arrow" aria-hidden="true">→</strong>
      </button>

      <ChallengeCreateModal
        code={code}
        open={createOpen}
        onClose={closeCreate}
        onCreated={refresh}
      />
    </>
  );
}
