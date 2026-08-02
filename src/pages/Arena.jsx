import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createArenaClient } from '../lib/arena.js';
import { initialArenaState } from '../lib/arenaLogic.js';
import { ENGINES } from '../engines/index.js';
import { artFor } from '../engines/art.js';
import { applyTheme } from '../lib/util.js';
import { ARENA_GAMES, ARENA_UPCOMING_STRONG, ARENA_UPCOMING_MAYBE, ARENA_GAME_INFO, isArenaPlayable } from '../lib/arenaGames.js';
import SettingsMenu from '../arcade/SettingsMenu.jsx';

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
  const gamePlayable = isArenaPlayable(game);

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
    applyTheme(selectedDuo?.theme || 'classic');
  }, [selectedDuo?.theme]);

  useEffect(() => {
    if (!client || !queued || !duoCode) return;
    const poll = setInterval(async () => {
      try {
        const result = await client.queueStatus(duoCode);
        if (result.match) {
          setQueued(false);
          navigate('/app/arena/' + result.match.code);
        } else if (!result.queued) setQueued(false);
      } catch (error) { setStatus(error.message); }
    }, 2500);
    return () => clearInterval(poll);
  }, [client, queued, duoCode, navigate]);

  const stateFor = id => initialArenaState(id, ENGINES[id]);

  const createPrivate = async () => {
    if (!client || !linked || !gamePlayable) return;
    setBusy(true); setStatus('');
    try {
      const match = await client.createPrivate(duoCode, game, stateFor(game));
      navigate('/app/arena/' + match.code);
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };

  const joinPrivate = async event => {
    event.preventDefault();
    if (!client || !linked || !joinCode.trim()) return;
    setBusy(true); setStatus('');
    try {
      const match = await client.joinPrivate(joinCode.trim().toUpperCase(), duoCode);
      navigate('/app/arena/' + match.code);
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };

  const toggleQueue = async () => {
    if (!client || !linked || (!queued && !gamePlayable)) return;
    setBusy(true); setStatus('');
    try {
      if (queued) {
        await client.cancelQueue(duoCode);
        setQueued(false);
      } else {
        const result = await client.joinQueue(duoCode, game, stateFor(game));
        if (result.match) navigate('/app/arena/' + result.match.code);
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
          <Link className="arena-btn warm" to="/app?next=/app/arena">Open DuoArcade</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="arena-page">
      <header className="arena-topbar">
        <Link className="arena-brand" to="/app"><span>Duo</span><b>Arcade</b></Link>
        <nav>
          <Link to="/app">My duo</Link>
          <span className="on">2v2 Arena</span>
          <SettingsMenu />
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
            {ARENA_GAMES.map(id => {
              const info = ARENA_GAME_INFO[id];
              const name = ENGINES[id]?.meta?.name || id;
              return (
              <button key={id} type="button" className={'arena-game-choice' + (game === id ? ' on' : '')}
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

          <div className="arena-upcoming-head">
            <h3>Live Arena — strong 2v2</h3>
            <span>Listed only — needs new server sync</span>
          </div>
          <div className="arena-game-grid arena-game-grid-upcoming">
            {ARENA_UPCOMING_STRONG.map(id => {
              const info = ARENA_GAME_INFO[id];
              const name = ENGINES[id]?.meta?.name || id;
              const selected = game === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={'arena-game-choice upcoming strong' + (selected ? ' on' : '')}
                  onClick={() => setGame(id)}
                  title="Not playable yet — waiting on Live Arena sync"
                >
                  {artFor(id) && (
                    <>
                      <div className="arena-game-art" aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: artFor(id) }} />
                      <div className="arena-game-shade" aria-hidden="true" />
                    </>
                  )}
                  <span className="arena-soon">Soon</span>
                  <div className="arena-gname">{name}</div>
                  <div className="arena-gtag">{info?.tagline || ENGINES[id]?.meta?.tag || ''}</div>
                </button>
              );
            })}
          </div>

          <div className="arena-upcoming-head arena-upcoming-head-maybe">
            <h3>Maybe later</h3>
            <span>Possible with redesign — not native 2v2 yet</span>
          </div>
          <div className="arena-game-grid arena-game-grid-upcoming arena-game-grid-maybe">
            {ARENA_UPCOMING_MAYBE.map(id => {
              const info = ARENA_GAME_INFO[id];
              const name = ENGINES[id]?.meta?.name || id;
              const selected = game === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={'arena-game-choice upcoming maybe' + (selected ? ' on' : '')}
                  onClick={() => setGame(id)}
                  title="Possible later — needs redesign + Live sync"
                >
                  {artFor(id) && (
                    <>
                      <div className="arena-game-art" aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: artFor(id) }} />
                      <div className="arena-game-shade" aria-hidden="true" />
                    </>
                  )}
                  <span className="arena-soon arena-soon-maybe">Maybe</span>
                  <div className="arena-gname">{name}</div>
                  <div className="arena-gtag">{info?.tagline || ENGINES[id]?.meta?.tag || ''}</div>
                </button>
              );
            })}
          </div>
          {!gamePlayable && (
            <div className="arena-warning">
              {ENGINES[game]?.meta?.name || game} is listed for 2v2 but not wired to Arena sync yet.
              Pick a classic relay game above to play now.
            </div>
          )}
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
          <button className="arena-btn" disabled={!linked || busy || !gamePlayable} onClick={createPrivate}>Create challenge</button>
        </article>

        <article className={'arena-action-card public' + (queued ? ' searching' : '')}>
          <span className="action-icon">◎</span>
          <div>
            <div className="arena-kicker">Public matchmaking</div>
            <h2>{queued ? 'Finding your rivals…' : 'Find another duo'}</h2>
            <p>{queued ? 'Keep this page open. We will take you straight to the lobby.' : 'Match with the oldest waiting couple for this game.'}</p>
          </div>
          <button className={'arena-btn warm' + (queued ? ' pulse' : '')}
            disabled={!linked || busy || (!queued && !gamePlayable)} onClick={toggleQueue}>
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
              <button key={m.code} className="arena-match-row" onClick={() => navigate('/app/arena/' + m.code)}>
                <span className={'match-dot ' + m.status} />
                <span className="match-main">
                  <b>{ENGINES[m.game]?.meta?.name || ARENA_GAME_INFO[m.game]?.art || m.game}</b>
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
