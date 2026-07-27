import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ENGINES } from '../engines/index.js';
import { createFriendsClient } from '../lib/friends.js';
import '../styles/friends.css';

const LOBBY_COUNTDOWN_MS = 3000;

function RealtimeBoard({ eng, session, myRole, names, client, code, onFinish }) {
  const hostRef = useRef(null);
  const key = (session.game || '') + ':' + (session.startedAt || 0);
  useEffect(() => {
    if (!hostRef.current || !eng?.mount) return;
    const rt = client.rt(code);
    eng.mount(hostRef.current, {
      myRole, rt, names, onFinish, code,
      startedAt: session.startedAt || 0,
    });
    return () => {
      try { eng.unmount(); } catch { /* */ }
      try { rt.close(); } catch { /* */ }
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={hostRef} className="gv-board-wrap" />;
}

function TurnBoard({ eng, session, myRole, onMove, names, onProceed }) {
  const hostRef = useRef(null);
  const onProceedRef = useRef(onProceed);
  useEffect(() => { onProceedRef.current = onProceed; }, [onProceed]);
  useEffect(() => {
    if (!hostRef.current || !eng?.render) return;
    eng.render(hostRef.current, session.gs, {
      myRole,
      turn: session.turn,
      winner: session.winner,
      names,
      onMove,
      onProceed: () => onProceedRef.current?.()
    });
  }, [eng, session, myRole, onMove, names]);
  return <div ref={hostRef} />;
}

export default function FriendMatchScreen() {
  const { matchCode } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [match, setMatch] = useState(null);
  const [status, setStatus] = useState('Opening friend match…');
  const [goAt, setGoAt] = useState(null);
  const [, tick] = useState(0);
  const presenceRef = useRef(null);

  const myRole = (() => {
    if (!client?.user || !match) return null;
    if (client.user.id === match.hostId) return 'A';
    if (client.user.id === match.guestId) return 'B';
    return null;
  })();

  const load = useCallback(async api => {
    const m = await api.getMatch(matchCode);
    setMatch(m);
    setStatus('');
    return m;
  }, [matchCode]);

  useEffect(() => {
    let alive = true;
    let unsub = () => {};
    createFriendsClient().then(async api => {
      if (!alive) return;
      setClient(api);
      if (!api.user) {
        setStatus('Sign in to open this friend match.');
        return;
      }
      try {
        const m = await load(api);
        const names = m.session?.names || {};
        const other = api.user.id === m.hostId ? names.B : names.A;
        presenceRef.current = api.startPresence({
          status: 'busy',
          busyLabel: 'Playing with @' + (other || 'friend'),
          matchCode: m.code
        });
        unsub = api.subscribeMatch(m.code, row => {
          if (row) setMatch(row);
        });
      } catch (e) {
        setStatus(e.message);
      }
    }).catch(e => setStatus(e.message));

    return () => {
      alive = false;
      unsub();
      try { presenceRef.current?.close(); } catch { /* */ }
    };
  }, [load, matchCode]);

  const session = match?.session || {};
  const eng = session.game ? ENGINES[session.game] : null;
  const names = session.names || { A: 'Host', B: 'Guest' };

  useEffect(() => {
    if (session.phase === 'live' && session.liveAt && !session.winner) {
      setGoAt(Date.now() + LOBBY_COUNTDOWN_MS);
    } else {
      setGoAt(null);
    }
  }, [session.liveAt, session.phase, session.winner, session.startedAt, session.game]);

  const counting = goAt != null && Date.now() < goAt && !session.winner;
  useEffect(() => {
    if (!counting) return;
    const t = setTimeout(() => tick(n => n + 1), 200);
    return () => clearTimeout(t);
  });

  const pushSession = async next => {
    if (!client || !match) return;
    setMatch({ ...match, session: next });
    try {
      setMatch(await client.updateMatchSession(match.code, next));
    } catch (e) {
      setStatus(e.message);
    }
  };

  const pressReady = async () => {
    if (!myRole || session.phase !== 'lobby') return;
    const ready = { ...(session.ready || {}), [myRole]: true };
    let next = { ...session, ready };
    if (ready.A && ready.B) {
      next = {
        ...next,
        phase: 'live',
        liveAt: Date.now() + LOBBY_COUNTDOWN_MS,
        turn: session.turn || 'A',
        gs: session.gs || (eng?.initial ? eng.initial() : null)
      };
    }
    await pushSession(next);
  };

  const onMove = async action => {
    if (!eng || !myRole || session.winner || session.phase !== 'live') return;
    if (counting) return;
    if (eng.meta?.realtime) return;
    const result = eng.apply?.(session.gs, action, myRole);
    if (!result) return;
    const next = {
      ...session,
      gs: result.gs ?? result,
      turn: result.turn ?? (session.turn === 'A' ? 'B' : 'A'),
      winner: result.winner || null
    };
    await pushSession(next);
    if (next.winner) {
      try { await client.endMatch(match.code, next.winner); } catch { /* */ }
    }
  };

  const onRealtimeFinish = async w => {
    if (!client || !match) return;
    try {
      await client.endMatch(match.code, w || 'draw');
      const next = { ...session, phase: 'ended', winner: w || 'draw' };
      await client.updateMatchSession(match.code, next).catch(() => {});
      setMatch(m => m ? { ...m, status: 'ended', winner: w || 'draw', session: next } : m);
    } catch (e) {
      setStatus(e.message);
    }
  };

  const leave = async () => {
    if (match && match.status !== 'ended' && match.status !== 'declined') {
      try { await client?.endMatch(match.code, session.winner || null); } catch { /* */ }
    }
    try { presenceRef.current?.setOnline?.(); } catch { /* */ }
    navigate('/app');
  };

  if (status && !match) {
    return (
      <div className="arcade-page">
        <div className="fm-screen">
          <p className="status">{status}</p>
          <Link className="btn ghost" to="/app">Back</Link>
        </div>
      </div>
    );
  }

  if (!match || !myRole) {
    return (
      <div className="arcade-page">
        <div className="fm-screen"><p className="status">Loading…</p></div>
      </div>
    );
  }

  const waitingInvite = match.status === 'invite' && myRole === 'A';
  const inLobby = match.status === 'lobby' || session.phase === 'lobby';
  const live = (match.status === 'live' || session.phase === 'live') && !session.winner && match.status !== 'ended';
  const ended = match.status === 'ended' || session.phase === 'ended' || !!session.winner;

  return (
    <div className="arcade-page">
      <div className="fm-screen">
        <div className="fm-bar">
          <div>
            <h2>{eng?.meta?.name || session.game}</h2>
            <div className="status" style={{ margin: 0 }}>
              @{names.A} vs @{names.B} · you are {myRole === 'A' ? names.A : names.B}
            </div>
          </div>
          <button type="button" className="btn small ghost" onClick={leave}>Leave</button>
        </div>

        {status && <p className="friends-status">{status}</p>}

        {waitingInvite && (
          <div className="fm-lobby">
            <p>Waiting for @{names.B} to accept…</p>
          </div>
        )}

        {inLobby && match.status !== 'invite' && (
          <div className="fm-lobby">
            <p>Both press ready, then play.</p>
            <p>
              A: {session.ready?.A ? '✓' : '…'} · B: {session.ready?.B ? '✓' : '…'}
            </p>
            <button
              type="button"
              className="btn warm"
              disabled={!!session.ready?.[myRole]}
              onClick={pressReady}
            >
              {session.ready?.[myRole] ? 'Ready' : 'I\'m ready'}
            </button>
          </div>
        )}

        {counting && (
          <div className="fm-lobby">
            <h2>{Math.max(1, Math.ceil((goAt - Date.now()) / 1000))}</h2>
          </div>
        )}

        {live && !counting && eng && client && (
          eng.meta?.realtime ? (
            <RealtimeBoard
              eng={eng}
              session={session}
              myRole={myRole}
              names={names}
              client={client}
              code={match.code}
              onFinish={onRealtimeFinish}
            />
          ) : (
            <TurnBoard eng={eng} session={session} myRole={myRole} onMove={onMove} names={names} />
          )
        )}

        {ended && (
          <div className="fm-lobby">
            <h2>
              {session.winner === 'draw' || match.winner === 'draw'
                ? 'Draw'
                : `@${names[session.winner || match.winner]} wins`}
            </h2>
            <button type="button" className="btn warm" onClick={leave}>Back to duo</button>
          </div>
        )}
      </div>
    </div>
  );
}
