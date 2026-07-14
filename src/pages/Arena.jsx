import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createArenaClient } from '../lib/arena.js';
import { initialArenaState } from '../lib/arenaLogic.js';
import { ENGINES } from '../engines/index.js';
import { artFor } from '../engines/art.js';
import { applyTheme } from '../lib/util.js';
import { ARENA_GAMES, ARENA_GAME_INFO } from '../lib/arenaGames.js';

const GAME_CHOICES = ARENA_GAMES;

export default function Arena() {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [duos, setDuos] = useState([]);
  const [matches, setMatches] = useState([]);
  const [duoCode, setDuoCode] = useState('');
  const [game, setGame] = useState('connect4');
  const [joinCode, setJoinCode] = useState('');
  const [status, setStatus] = useState('Loading Arena…');
  const [queued, setQueued] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedDuo = useMemo(() => duos.find(d => d.code === duoCode), [duos, duoCode]);
  const linked = !!selectedDuo?.memberA && !!selectedDuo?.memberB;

  const refresh = async api => {
    const [myDuos, myMatches] = await Promise.all([api.listDuos(), api.listMatches()]);
    setDuos(myDuos);
    setMatches(myMatches);
    setDuoCode(old => old || myDuos[0]?.code || '');
    setStatus('');
  };

  useEffect(() => {
    let alive = true;
    createArenaClient().then(async api => {
      if (!alive) return;
      setClient(api);
      if (!api.user) { setStatus('Sign in first to enter Arena.'); return; }
      try { await refresh(api); }
      catch (error) { setStatus(error.message); }
    }).catch(error => setStatus(error.message));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    applyTheme(selectedDuo?.theme || 'night');
  }, [selectedDuo?.theme]);

  useEffect(() => {
    if (!client || !queued || !duoCode) return;
    const poll = setInterval(async () => {
      try {
        const result = await client.queueStatus(duoCode);
        if (result.match) {
          setQueued(false);
          navigate('/arena/' + result.match.code);
        } else if (!result.queued) setQueued(false);
      } catch (error) { setStatus(error.message); }
    }, 2500);
    return () => clearInterval(poll);
  }, [client, queued, duoCode, navigate]);

  const stateFor = id => initialArenaState(id, ENGINES[id]);

  const createPrivate = async () => {
    if (!client || !linked) return;
    setBusy(true); setStatus('');
    try {
      const match = await client.createPrivate(duoCode, game, stateFor(game));
      navigate('/arena/' + match.code);
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };

  const joinPrivate = async event => {
    event.preventDefault();
    if (!client || !linked || !joinCode.trim()) return;
    setBusy(true); setStatus('');
    try {
      const match = await client.joinPrivate(joinCode.trim().toUpperCase(), duoCode);
      navigate('/arena/' + match.code);
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };

  const toggleQueue = async () => {
    if (!client || !linked) return;
    setBusy(true); setStatus('');
    try {
      if (queued) {
        await client.cancelQueue(duoCode);
        setQueued(false);
      } else {
        const result = await client.joinQueue(duoCode, game, stateFor(game));
        if (result.match) navigate('/arena/' + result.match.code);
        else setQueued(true);
      }
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };

  if (client && !client.user) {
    return (
      <main className="arena-page arena-center">
        <div className="arena-auth-card">
          <div className="arena-kicker">Couple vs couple</div>
          <h1>Sign in to enter Arena</h1>
          <p>Both partners need linked DuoArcade accounts before your duo can compete.</p>
          <Link className="arena-btn warm" to="/app?next=/arena">Open DuoArcade</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="arena-page">
      <header className="arena-topbar">
        <Link className="arena-brand" to="/"><span>Duo</span><b>Arcade</b></Link>
        <nav>
          <Link to="/app">My duo</Link>
          <span className="on">2v2 Arena</span>
        </nav>
      </header>

      <section className="arena-hero">
        <div>
          <div className="arena-kicker">Four hearts. Two teams. One board.</div>
          <h1>Couples Arena</h1>
          <p>Challenge another duo or enter public matchmaking. Partners alternate every move, so every win belongs to both of you.</p>
        </div>
        <div className="arena-versus" aria-hidden="true">
          <div className="arena-pair team-a"><i>1</i><i>2</i></div>
          <div className="arena-vs">VS</div>
          <div className="arena-pair team-b"><i>1</i><i>2</i></div>
          <span className="arena-spark">✦</span>
        </div>
      </section>

      <section className="arena-controls">
        <div className="arena-panel">
          <div className="arena-panel-head">
            <div><span className="step">01</span><h2>Choose your duo</h2></div>
          </div>
          {duos.length ? (
            <select value={duoCode} onChange={e => { setDuoCode(e.target.value); setQueued(false); }}>
              {duos.map(d => <option key={d.code} value={d.code}>{d.nameA} & {d.nameB}</option>)}
            </select>
          ) : <p className="arena-muted">Create a duo in the arcade first.</p>}
          {selectedDuo && !linked && (
            <div className="arena-warning">Both partners must open the duo invite while signed in before this duo can play 2v2.</div>
          )}
        </div>

        <div className="arena-panel">
          <div className="arena-panel-head">
            <div><span className="step">02</span><h2>Pick a game</h2></div>
          </div>
          <div className="arena-game-grid">
            {GAME_CHOICES.map(id => {
              const info = ARENA_GAME_INFO[id];
              const name = ENGINES[id]?.meta?.name || id;
              return (
              <button key={id} className={'arena-game-choice' + (game === id ? ' on' : '')}
                onClick={() => setGame(id)}>
                {artFor(id) && (
                  <>
                    <div className="arena-game-art" aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: artFor(id) }} />
                    <div className="arena-game-shade" aria-hidden="true" />
                  </>
                )}
                <div className="arena-gname">{name}</div>
                <div className="arena-gtag">{info?.tagline || ENGINES[id]?.meta?.tag || ''}</div>
              </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="arena-actions-grid">
        <article className="arena-action-card private">
          <span className="action-icon">⌁</span>
          <div>
            <div className="arena-kicker">Private challenge</div>
            <h2>Invite a couple</h2>
            <p>Create a private Arena code and send it to the other duo.</p>
          </div>
          <button className="arena-btn" disabled={!linked || busy} onClick={createPrivate}>Create challenge</button>
        </article>

        <article className={'arena-action-card public' + (queued ? ' searching' : '')}>
          <span className="action-icon">◎</span>
          <div>
            <div className="arena-kicker">Public matchmaking</div>
            <h2>{queued ? 'Finding your rivals…' : 'Find another duo'}</h2>
            <p>{queued ? 'Keep this page open. We will take you straight to the lobby.' : 'Match with the oldest waiting couple for this game.'}</p>
          </div>
          <button className={'arena-btn warm' + (queued ? ' pulse' : '')}
            disabled={!linked || busy} onClick={toggleQueue}>
            {queued ? 'Cancel search' : 'Enter matchmaking'}
          </button>
        </article>
      </section>

      <form className="arena-join" onSubmit={joinPrivate}>
        <div><div className="arena-kicker">Have a code?</div><h2>Join a private challenge</h2></div>
        <input value={joinCode} onChange={e => setJoinCode(e.target.value)}
          placeholder="A-XXXXXX" maxLength={8} />
        <button className="arena-btn" disabled={!linked || busy}>Join Arena</button>
      </form>

      {status && <div className="arena-status">{status}</div>}

      <section className="arena-history">
        <div className="arena-section-head"><h2>Your Arena matches</h2><span>{matches.length} total</span></div>
        {!matches.length ? <div className="arena-empty">Your first rival is waiting somewhere.</div> : (
          <div className="arena-match-list">
            {matches.slice(0, 8).map(m => (
              <button key={m.code} className="arena-match-row" onClick={() => navigate('/arena/' + m.code)}>
                <span className={'match-dot ' + m.status} />
                <span className="match-main">
                  <b>{GAME_LABEL[m.game]?.[0] || m.game}</b>
                  <small>{m.teamA ? `${m.teamA.nameA} & ${m.teamA.nameB}` : m.duoA}
                    {' vs '}{m.teamB ? `${m.teamB.nameA} & ${m.teamB.nameB}` : 'Waiting for rivals'}</small>
                </span>
                <span className="match-state">{m.winner ? (m.winner === 'draw' ? 'Draw' : `Team ${m.winner} won`) : m.status}</span>
                <span>→</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
