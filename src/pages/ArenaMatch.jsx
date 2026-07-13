import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createArenaClient } from '../lib/arena.js';
import { applyArenaMove, rematchState, startIfDue, teamOf } from '../lib/arenaLogic.js';
import { ENGINES } from '../engines/index.js';
import { applyTheme } from '../lib/util.js';
import { Confetti } from '../arcade/CoupleFx.jsx';

function ArenaBoard({ engine, state, seat, onMove }) {
  const ref = useRef(null);
  const canAct = state.activeSeat === seat && state.phase === 'live';
  const myTeam = teamOf(seat);
  useEffect(() => {
    if (!ref.current) return;
    engine.render(ref.current, state.gs, {
      myRole: canAct ? myTeam : '__watching',
      turn: state.turn,
      winner: state.winner,
      onMove
    });
  }, [engine, state, seat, canAct, myTeam, onMove]);
  return <div className="arena-board" ref={ref} />;
}

const seatName = (seat, a, b) => {
  const team = seat?.[0] === 'A' ? a : b;
  return seat?.[1] === '1' ? team?.nameA : team?.nameB;
};

export default function ArenaMatch() {
  const { matchCode } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [match, setMatch] = useState(null);
  const [seat, setSeat] = useState(null);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [presence, setPresence] = useState({});
  const [status, setStatus] = useState('Opening Arena…');
  const [joinDuos, setJoinDuos] = useState(null);
  const [joinDuo, setJoinDuo] = useState('');
  const [copied, setCopied] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async api => {
    try {
      const data = await api.openMatch(matchCode);
      setMatch(data.match); setSeat(data.seat);
      setTeamA(data.teamA); setTeamB(data.teamB);
      applyTheme((data.seat?.[0] === 'A' ? data.teamA : data.teamB)?.theme || 'night');
      setJoinDuos(null); setStatus('');
      return data;
    } catch (error) {
      if (/not in this match/i.test(error.message)) {
        const duos = await api.listDuos();
        setJoinDuos(duos);
        setJoinDuo(duos.find(d => d.memberA && d.memberB)?.code || '');
        setStatus('');
        return null;
      }
      throw error;
    }
  }, [matchCode]);

  useEffect(() => {
    let closeMatch, closePresence, alive = true;
    createArenaClient().then(async api => {
      if (!alive) return;
      setClient(api);
      if (!api.user) {
        localStorage.setItem('duoarcade-arena-next', '/arena/' + matchCode);
        setStatus('Sign in to open this Arena challenge.');
        return;
      }
      try {
        const data = await load(api);
        if (!data) return;
        let teamsLoaded = !!data.teamB?.code;
        closeMatch = api.subscribe(matchCode, async updated => {
          setMatch(updated);
          if (updated.duoB && !teamsLoaded) {
            teamsLoaded = true;
            try {
              const full = await api.openMatch(matchCode);
              setMatch(full.match); setTeamA(full.teamA); setTeamB(full.teamB);
            } catch { /* next reconcile/open will recover */ }
          }
        });
        closePresence = api.presence(matchCode, data.seat, setPresence);
      } catch (error) { setStatus(error.message); }
    }).catch(error => setStatus(error.message));
    return () => { alive = false; closeMatch?.(); closePresence?.(); };
  }, [matchCode, load]);

  const state = match?.state ? startIfDue(match.state) : null;
  const counting = state?.phase === 'countdown' && state.liveAt > Date.now();

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => tick(n => n + 1), 200);
    return () => clearInterval(timer);
  }, [counting]);

  const refresh = async () => {
    if (!client) return;
    try { await load(client); } catch (error) { setStatus(error.message); }
  };

  const joinChallenge = async () => {
    if (!client || !joinDuo) return;
    try {
      await client.joinPrivate(matchCode, joinDuo);
      await load(client);
      window.location.reload(); // establish participant-scoped realtime + presence
    } catch (error) { setStatus(error.message); }
  };

  const ready = async () => {
    try { setMatch(await client.ready(match.code, match.revision)); }
    catch (error) { setStatus(error.message); await refresh(); }
  };

  const move = useCallback(async action => {
    if (!client || !match || !state) return;
    const engine = ENGINES[match.game];
    const next = applyArenaMove(state, action, seat, engine);
    if (!next) return;
    const previous = match;
    setMatch({ ...match, state: next, revision: match.revision + 1, status: next.winner ? 'done' : 'live' });
    try { setMatch(await client.move(match.code, match.revision, next)); }
    catch (error) {
      setMatch(previous);
      setStatus(error.message);
      await refresh();
    }
  }, [client, match, state, seat]); // eslint-disable-line react-hooks/exhaustive-deps

  const rematch = async () => {
    const engine = ENGINES[match.game];
    try { setMatch(await client.rematch(match.code, match.revision, rematchState(state, engine))); }
    catch (error) { setStatus(error.message); await refresh(); }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  };

  const cancelMatch = async () => {
    try {
      await client.cancelMatch(match.code);
      navigate('/arena');
    } catch (error) { setStatus(error.message); }
  };

  if (client && !client.user) {
    return (
      <main className="arena-page arena-center">
        <div className="arena-auth-card">
          <div className="arena-kicker">Arena invitation</div>
          <h1>Sign in to join the match</h1>
          <p>After signing in, this challenge will reopen automatically.</p>
          <Link className="arena-btn warm" to={`/app?next=${encodeURIComponent('/arena/' + matchCode)}`}>Sign in</Link>
        </div>
      </main>
    );
  }

  if (joinDuos) {
    return (
      <main className="arena-page arena-center">
        <div className="arena-auth-card arena-join-card">
          <div className="arena-kicker">Private challenge · {matchCode}</div>
          <h1>Bring your duo into Arena</h1>
          <p>Select the fully linked couple that will accept this challenge.</p>
          <select value={joinDuo} onChange={e => setJoinDuo(e.target.value)}>
            {joinDuos.map(d => (
              <option key={d.code} value={d.code} disabled={!d.memberA || !d.memberB}>
                {d.nameA} & {d.nameB}{!d.memberA || !d.memberB ? ' · partner not linked' : ''}
              </option>
            ))}
          </select>
          <button className="arena-btn warm" disabled={!joinDuo} onClick={joinChallenge}>Accept challenge</button>
          {status && <div className="arena-status">{status}</div>}
          <Link to="/arena">Back to Arena</Link>
        </div>
      </main>
    );
  }

  if (!match || !state) {
    return <main className="arena-page arena-center"><div className="arena-status">{status}</div></main>;
  }

  const engine = ENGINES[match.game];
  const names = { A: `${teamA?.nameA} & ${teamA?.nameB}`, B: `${teamB?.nameA} & ${teamB?.nameB}` };
  const myReady = !!state.ready?.[seat];
  const activeName = seatName(state.activeSeat, teamA, teamB);
  const myTurn = state.activeSeat === seat;

  if (match.status === 'waiting') {
    return (
      <main className="arena-page arena-center">
        <div className="arena-wait-card">
          <div className="arena-versus small" aria-hidden="true">
            <div className="arena-pair team-a"><i>{teamA?.nameA?.[0]}</i><i>{teamA?.nameB?.[0]}</i></div>
            <div className="arena-vs">VS</div>
            <div className="arena-pair ghost"><i>?</i><i>?</i></div>
          </div>
          <div className="arena-kicker">Private challenge ready</div>
          <h1>Waiting for your rivals</h1>
          <p>Send this code or link to another couple.</p>
          <div className="arena-code">{match.code}</div>
          <button className="arena-btn warm" onClick={copyLink}>{copied ? 'Copied!' : 'Copy challenge link'}</button>
          <button className="arena-btn" onClick={cancelMatch}>Cancel challenge</button>
        </div>
      </main>
    );
  }

  if (match.status === 'cancelled') {
    return (
      <main className="arena-page arena-center">
        <div className="arena-auth-card">
          <div className="arena-kicker">Challenge closed</div>
          <h1>This Arena match was cancelled</h1>
          <Link className="arena-btn warm" to="/arena">Return to Arena</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="arena-page match-page">
      <header className="arena-topbar">
        <Link className="arena-brand" to="/"><span>Duo</span><b>Arcade</b></Link>
        <div className="match-code">Arena {match.code}</div>
        <Link to="/arena">Leave view</Link>
      </header>

      <section className="match-scoreboard">
        <div className={'match-team team-a' + (state.turn === 'A' && !state.winner ? ' active' : '')}>
          <span className="team-label">Team A</span><h2>{names.A}</h2>
          <div className="seat-dots">
            {['A1', 'A2'].map(s => <i key={s} className={(presence[s] ? 'online' : '') + (state.activeSeat === s ? ' current' : '')} />)}
          </div>
        </div>
        <div className="match-center">
          <span>Round {state.round || 1}</span><strong>VS</strong><small>{engine.meta.name}</small>
        </div>
        <div className={'match-team team-b' + (state.turn === 'B' && !state.winner ? ' active' : '')}>
          <span className="team-label">Team B</span><h2>{names.B}</h2>
          <div className="seat-dots">
            {['B1', 'B2'].map(s => <i key={s} className={(presence[s] ? 'online' : '') + (state.activeSeat === s ? ' current' : '')} />)}
          </div>
        </div>
      </section>

      {state.phase === 'ready' ? (
        <section className="arena-ready-stage">
          <div className="arena-kicker">All four players check in</div>
          <h1>Ready your hearts</h1>
          <div className="four-seats">
            {['A1', 'A2', 'B1', 'B2'].map(s => (
              <div key={s} className={'four-seat ' + s[0] + (state.ready?.[s] ? ' ready' : '')}>
                <div className="seat-avatar">{seatName(s, teamA, teamB)?.[0] || '?'}</div>
                <b>{seatName(s, teamA, teamB)}</b>
                <small>{state.ready?.[s] ? 'Ready' : presence[s] ? 'Online' : 'Waiting'}</small>
              </div>
            ))}
          </div>
          <button className="arena-btn warm" disabled={myReady} onClick={ready}>
            {myReady ? 'Waiting for everyone…' : "I'm ready"}
          </button>
        </section>
      ) : counting ? (
        <section className="arena-countdown">
          <span>Four players ready</span>
          <strong>{Math.max(1, Math.ceil((state.liveAt - Date.now()) / 1000))}</strong>
          <p>{seatName(state.activeSeat, teamA, teamB)} opens the match</p>
        </section>
      ) : state.winner ? (
        <section className="arena-result">
          <Confetti count={65} />
          <div className="result-crown">♛</div>
          <div className="arena-kicker">Match complete</div>
          <h1>{state.winner === 'draw' ? 'Perfectly matched' : `${names[state.winner]} win!`}</h1>
          <p>{state.winner === 'draw' ? 'No couple gives an inch.' : 'Four players showed up. One duo takes the glory.'}</p>
          <div className="result-actions">
            <button className="arena-btn warm" onClick={rematch}>Start rematch</button>
            <Link className="arena-btn" to="/arena">Arena lobby</Link>
          </div>
        </section>
      ) : (
        <section className="arena-game-stage">
          <div className={'turn-callout' + (myTurn ? ' yours' : '')}>
            <span className="turn-pulse" />
            {myTurn ? 'Your move' : `${activeName}'s move`}
            <small>{myTurn ? 'Your partner plays after the rival team.' : `Active seat · ${state.activeSeat}`}</small>
          </div>
          <ArenaBoard engine={engine} state={state} seat={seat} onMove={move} />
          <div className="relay-order">
            {['A1', 'B1', 'A2', 'B2'].map(s => (
              <span key={s} className={state.activeSeat === s ? 'on' : ''}>{seatName(s, teamA, teamB)}</span>
            ))}
          </div>
        </section>
      )}

      {status && <div className="arena-status floating">{status}</div>}
    </main>
  );
}
