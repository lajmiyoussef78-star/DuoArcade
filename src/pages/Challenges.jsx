// src/pages/Challenges.jsx — route: /challenges/:code

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  GAME_LIST, STAKE_GROUPS, celebrationLine, challengeChannel, createChallenge,
  cancelChallenge, duoNames, gameName, getChallenges, myRoleInDuo,
  pickRandomGame3, respondChallenge, scoreOf, setChallengeResult,
} from '../lib/challenges.js';
import { applyTheme } from '../lib/util.js';
import '../styles/challenges.css';

function live(list) {
  return (list || []).find(c => c.status === 'pending' || c.status === 'active') || null;
}

function history(list) {
  return (list || []).filter(c => ['done', 'declined', 'cancelled'].includes(c.status));
}

export default function Challenges() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [role, setRole] = useState(undefined);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // create form
  const [stake, setStake] = useState('');
  const [game1, setGame1] = useState(null);

  // accept flow
  const [pickingG2, setPickingG2] = useState(false);
  const [fateReveal, setFateReveal] = useState(null); // game3 id while animating
  const fateTimer = useRef(null);

  const chRef = useRef(null);
  const cur = live(list);
  const past = history(list);

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const rows = await getChallenges(code);
      setList(rows);
      setErr('');
    } catch (e) {
      setErr(e.message || 'Could not load challenges');
    }
  }, [code]);

  useEffect(() => {
    applyTheme('night');
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) {
        setStatus('Sign in and open this duo first.');
        return;
      }
      setNames(await duoNames(code));
      await refresh();
      const ch = await challengeChannel(code);
      if (!alive) { ch.close(); return; }
      chRef.current = ch;
      ch.on(m => { if (m?.k === 'chal') refresh(); });
    })();
    return () => {
      alive = false;
      chRef.current?.close();
      if (fateTimer.current) clearInterval(fateTimer.current);
    };
  }, [code, refresh]);

  const sendPing = () => chRef.current?.send({ k: 'chal' });

  const onCreate = async () => {
    if (!stake.trim() || !game1) {
      setErr('Choose a stake and Game 1.');
      return;
    }
    setBusy(true); setErr('');
    try {
      await createChallenge(code, stake.trim(), game1);
      sendPing();
      setStake(''); setGame1(null);
      await refresh();
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  const onDecline = async () => {
    if (!cur) return;
    setBusy(true); setErr('');
    try {
      await respondChallenge(cur.id, false);
      sendPing();
      await refresh();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const onAcceptPick = async (g2) => {
    if (!cur || g2 === cur.game1) return;
    setPickingG2(false);
    const ids = GAME_LIST.map(g => g.id);
    const pool = ids.filter(id => id !== cur.game1 && id !== g2);
    // rolling animation
    let ticks = 0;
    if (fateTimer.current) clearInterval(fateTimer.current);
    fateTimer.current = setInterval(() => {
      const i = Math.floor(Math.random() * pool.length);
      setFateReveal(pool[i] || null);
      ticks += 1;
      if (ticks >= 12) {
        clearInterval(fateTimer.current);
        fateTimer.current = null;
        const g3 = pickRandomGame3(ids, cur.game1, g2);
        setFateReveal(g3);
        (async () => {
          setBusy(true); setErr('');
          try {
            await respondChallenge(cur.id, true, g2, g3);
            sendPing();
            await refresh();
          } catch (e) { setErr(e.message); }
          finally {
            setBusy(false);
            setTimeout(() => setFateReveal(null), 900);
          }
        })();
      }
    }, 90);
  };

  const onCancel = async () => {
    if (!cur) return;
    setBusy(true); setErr('');
    try {
      await cancelChallenge(cur.id);
      sendPing();
      await refresh();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const onSetWin = async (slot, winner) => {
    if (!cur) return;
    setBusy(true); setErr('');
    try {
      await setChallengeResult(cur.id, slot, winner);
      sendPing();
      await refresh();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const justDone = useMemo(() => {
    const d = (list || []).find(c => c.status === 'done' && c.overall_winner);
    if (!d) return null;
    if (cur && cur.id !== d.id) return null;
    if (cur && cur.status === 'active') return null;
    const t = d.resolved_at ? new Date(d.resolved_at).getTime() : 0;
    if (t && Date.now() - t > 48 * 3600 * 1000) return null;
    return d;
  }, [list, cur]);

  if (role === undefined) {
    return (
      <div className="chal-page">
        <div className="chal-wrap"><p className="chal-sub">Loading…</p></div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="chal-page">
        <div className="chal-wrap">
          <div className="chal-top">
            <h1>Challenges</h1>
            <Link className="btn ghost small" to="/app">Back</Link>
          </div>
          <p className="chal-status err">{status || 'You are not a member of this duo.'}</p>
        </div>
      </div>
    );
  }

  const sc = cur ? scoreOf(cur) : { a: 0, b: 0 };
  const iAmCreator = cur && cur.created_by === role;
  const iAmReceiver = cur && cur.created_by !== role;

  return (
    <div className="chal-page">
      <div className="chal-wrap">
        <div className="chal-top">
          <div>
            <h1>Challenges</h1>
            <p className="chal-sub">{names.A} & {names.B} · best of 3</p>
          </div>
          <button type="button" className="btn ghost small" onClick={() => navigate(`/app?duo=${encodeURIComponent(code)}`)}>
            Back to arcade
          </button>
        </div>

        {justDone && justDone.status === 'done' && (!cur || cur.id === justDone.id) && (
          <div className="chal-banner" role="status">
            <h2>Challenge complete</h2>
            <p>
              {celebrationLine(
                justDone.stake,
                names[justDone.overall_winner],
                names[justDone.overall_winner === 'A' ? 'B' : 'A']
              )}
            </p>
          </div>
        )}

        {fateReveal && (
          <div className="chal-fate">
            <div className="spin">Rolling fate&apos;s pick…</div>
            <div style={{ marginTop: 8, fontFamily: 'Fraunces, serif', fontSize: 20 }}>
              {gameName(fateReveal)}
            </div>
          </div>
        )}

        {!cur && !pickingG2 && (
          <section className="chal-card">
            <h2>Send a challenge</h2>
            <p>Pick the stake and Game 1. Your partner accepts by picking Game 2 — fate picks Game 3.</p>

            <label className="chal-label" htmlFor="chal-stake">The stake</label>
            <input
              id="chal-stake"
              className="chal-input"
              maxLength={140}
              value={stake}
              onChange={e => setStake(e.target.value)}
              placeholder="Loser cooks dinner"
            />

            {STAKE_GROUPS.map(g => (
              <div key={g.id} className="chal-group">
                <div className="chal-group-label">{g.label}</div>
                <div className="chal-chips">
                  {g.stakes.map(s => (
                    <button
                      key={s}
                      type="button"
                      className={'chal-chip' + (stake === s ? ' on' : '')}
                      onClick={() => setStake(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <label className="chal-label">Game 1 (your pick)</label>
            <div className="chal-games">
              {GAME_LIST.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className={'chal-game' + (game1 === g.id ? ' on' : '')}
                  onClick={() => setGame1(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>

            <div className="chal-actions">
              <button type="button" className="btn warm" disabled={busy} onClick={onCreate}>
                Send challenge
              </button>
            </div>
          </section>
        )}

        {cur?.status === 'pending' && iAmCreator && (
          <section className="chal-card">
            <h2>Waiting for a response</h2>
            <div className="chal-stake-pin">
              <div className="k">Stake</div>
              <div className="v">{cur.stake}</div>
            </div>
            <p>Game 1: <strong>{gameName(cur.game1)}</strong>. {names[cur.created_by === 'A' ? 'B' : 'A']} still needs to accept or decline.</p>
            <div className="chal-actions">
              <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>Cancel challenge</button>
            </div>
          </section>
        )}

        {cur?.status === 'pending' && iAmReceiver && !pickingG2 && (
          <section className="chal-card">
            <h2>Incoming challenge</h2>
            <p>From <strong>{names[cur.created_by]}</strong></p>
            <div className="chal-stake-pin">
              <div className="k">Stake</div>
              <div className="v">{cur.stake}</div>
            </div>
            <p>Game 1: <strong>{gameName(cur.game1)}</strong></p>
            <div className="chal-actions">
              <button type="button" className="btn warm" disabled={busy} onClick={() => setPickingG2(true)}>
                Accept — pick Game 2
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={onDecline}>
                Decline
              </button>
            </div>
          </section>
        )}

        {cur?.status === 'pending' && iAmReceiver && pickingG2 && (
          <section className="chal-card">
            <h2>Pick Game 2</h2>
            <p>Must differ from Game 1 ({gameName(cur.game1)}). Then fate rolls Game 3.</p>
            <div className="chal-games">
              {GAME_LIST.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className="chal-game"
                  disabled={g.id === cur.game1 || busy}
                  onClick={() => onAcceptPick(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
            <div className="chal-actions">
              <button type="button" className="btn ghost" onClick={() => setPickingG2(false)}>Back</button>
            </div>
          </section>
        )}

        {cur?.status === 'active' && (
          <section className="chal-card">
            <div className="chal-stake-pin">
              <div className="k">At stake</div>
              <div className="v">{cur.stake}</div>
            </div>
            <div className="chal-score" aria-label="Score">
              <span className="pA">{sc.a}</span>
              <span className="dash">–</span>
              <span className="pB">{sc.b}</span>
            </div>
            <div className="chal-slots">
              {[
                { slot: 1, game: cur.game1, win: cur.win1, who: `${names[cur.created_by]}'s pick` },
                { slot: 2, game: cur.game2, win: cur.win2, who: `${names[cur.created_by === 'A' ? 'B' : 'A']}'s pick` },
                { slot: 3, game: cur.game3, win: cur.win3, who: "Fate's pick" },
              ].map(s => (
                <div key={s.slot} className="chal-slot">
                  <div className="chal-slot-h">
                    <span className="who">{s.who}</span>
                    <span className="gn">{gameName(s.game)}</span>
                  </div>
                  <div className="chal-slot-row">
                    <Link className="btn small ghost" to="/app">Play</Link>
                    {s.win ? (
                      <span className="chal-win">Won by {names[s.win]}</span>
                    ) : null}
                    <button type="button" className="btn small" disabled={busy}
                      onClick={() => onSetWin(s.slot, 'A')}>{names.A} won</button>
                    <button type="button" className="btn small" disabled={busy}
                      onClick={() => onSetWin(s.slot, 'B')}>{names.B} won</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="chal-actions">
              <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>
                Call it off
              </button>
            </div>
          </section>
        )}

        <section className="chal-card">
          <h2>History</h2>
          <p>Past challenges — your couple&apos;s memory book.</p>
          {!past.length && <p className="chal-status">No past challenges yet.</p>}
          {past.map(c => {
            const s = scoreOf(c);
            return (
              <div key={c.id} className="chal-hist-item">
                <div className="chal-hist-top">
                  <strong>{c.stake}</strong>
                  <span className={'chal-chip-status ' + c.status}>{c.status}</span>
                </div>
                <div className="chal-sub">
                  {gameName(c.game1)}
                  {c.game2 ? ` · ${gameName(c.game2)}` : ''}
                  {c.game3 ? ` · ${gameName(c.game3)}` : ''}
                  {c.status === 'done' && c.overall_winner
                    ? ` · ${s.a}–${s.b} · ${names[c.overall_winner]} won`
                    : ''}
                  {c.created_at ? ` · ${new Date(c.created_at).toLocaleDateString()}` : ''}
                </div>
              </div>
            );
          })}
        </section>

        <p className={'chal-status' + (err ? ' err' : '')}>{err || status}</p>
      </div>
    </div>
  );
}
