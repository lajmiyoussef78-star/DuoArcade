// ChallengeHistory.jsx — past challenges with shelf-style game tiles.

import { useCallback, useEffect, useState } from 'react';
import {
  celebrationLine, completedChallenges, duoNames, getChallenges,
  otherRole, scoreOf, setStakeFulfilled, subscribeChallengeSync,
} from '../lib/challenges.js';
import { artFor } from '../engines/art.js';
import { ENGINES } from '../engines/index.js';
import '../styles/challenges.css';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch (_) {
    return '';
  }
}

/** Only games that were actually played (won). */
function playedGames(c) {
  const out = [];
  if (c.game1 && c.win1) out.push({ slot: 1, gameId: c.game1, win: c.win1 });
  if (c.game2 && c.win2) out.push({ slot: 2, gameId: c.game2, win: c.win2 });
  if (c.game3 && c.win3) out.push({ slot: 3, gameId: c.game3, win: c.win3 });
  return out;
}

function HistGameTile({ gameId, slot, win, names }) {
  const art = artFor(gameId);
  const eng = ENGINES[gameId];
  const winner = win ? names[win] : null;
  return (
    <div className={'chal-hist-tile' + (win ? ' won-' + win.toLowerCase() : '')}>
      <div className="chal-hist-tile-slot">Game {slot}</div>
      {art ? (
        <>
          <div className="chal-hist-tile-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
          <div className="chal-hist-tile-veil" aria-hidden="true" />
        </>
      ) : null}
      <div className="chal-hist-tile-name">{eng?.meta?.name || gameId}</div>
      {winner ? (
        <div className={'chal-hist-tile-win ' + win.toLowerCase()}>{winner} won</div>
      ) : null}
    </div>
  );
}

export default function ChallengeHistory({ code, myRole, compact = false }) {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const [list, n] = await Promise.all([getChallenges(code), duoNames(code)]);
      setRows(completedChallenges(list));
      setNames(n);
      setErr('');
    } catch (e) {
      setErr(e.message || 'Could not load history');
    }
  }, [code]);

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    refresh();
    const unsub = subscribeChallengeSync(code, msg => {
      if (!alive) return;
      if (msg?.c?.status === 'done') refresh();
      else if (msg?.t === 'stake' && msg.c) {
        setRows(prev => prev.map(c => (c.id === msg.c.id ? msg.c : c)));
      } else if (msg?.k === 'chal') refresh();
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [code, refresh]);

  const toggleStake = async (c, checked) => {
    if (!c?.id || busyId) return;
    setBusyId(c.id);
    setErr('');
    try {
      const updated = await setStakeFulfilled(c.id, checked);
      setRows(prev => prev.map(row => (row.id === updated.id ? updated : row)));
    } catch (e) {
      setErr(e.message || 'Could not update stake');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={'chal-history-page' + (compact ? ' chal-history-compact' : '')} id="sect-challenge-history">
      {!compact && (
        <header className="chal-history-hero">
          <div className="chal-history-kicker">Your memory book</div>
          <h3 className="chal-history-title">Challenge history</h3>
          <p className="chal-history-lead">
            Finished best-of-threes — stakes, scores, and who hosted.
          </p>
        </header>
      )}

      {!rows.length ? (
        <div className="chal-history-empty">
          <p>No finished challenges yet.</p>
          <span>Win a best-of-three and it&apos;ll show up here.</span>
        </div>
      ) : (
        <ul className="chal-history-list">
          {rows.map(c => {
            const sc = scoreOf(c);
            const hostRole = c.created_by;
            const hostName = names[hostRole] || hostRole;
            const winnerRole = c.overall_winner;
            const winner = winnerRole ? names[winnerRole] : '?';
            const loserRole = winnerRole ? otherRole(winnerRole) : null;
            const loserName = loserRole ? names[loserRole] : '?';
            const iAmWinner = myRole === winnerRole;
            const fulfilled = !!c.stake_fulfilled;
            const stakeLine = winnerRole
              ? celebrationLine(c.stake, winner, loserName)
              : c.stake;
            const stakeParts = stakeLine.split(' wins — ');
            const stakeBody = stakeParts.length > 1 ? stakeParts.slice(1).join(' wins — ') : c.stake;
            const games = playedGames(c);

            return (
              <li key={c.id} className={'chal-hist-card' + (fulfilled ? ' fulfilled' : '')}>
                <div className="chal-hist-head">
                  <time className="chal-hist-date">{formatDate(c.resolved_at || c.created_at)}</time>
                  <span className="chal-hist-host-pill">
                    Hosted by <strong>{hostName}</strong>
                  </span>
                </div>

                <div className="chal-hist-scoreboard">
                  <span className="chal-hist-player a">{names.A}</span>
                  <span className="chal-hist-tally">
                    <strong>{sc.a}</strong>
                    <em>–</em>
                    <strong>{sc.b}</strong>
                  </span>
                  <span className="chal-hist-player b">{names.B}</span>
                </div>

                <div className="chal-hist-stake-box">
                  <span className="chal-hist-winner-label">{winner} wins</span>
                  <p className="chal-hist-stake-text">{stakeBody}</p>
                </div>

                {games.length > 0 ? (
                  <div className={'chal-hist-shelf cols-' + Math.min(games.length, 3)}>
                    {games.map(g => (
                      <HistGameTile
                        key={g.slot}
                        gameId={g.gameId}
                        slot={g.slot}
                        win={g.win}
                        names={names}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="chal-hist-foot">
                  {iAmWinner ? (
                    <button
                      type="button"
                      className={'chal-stake-toggle' + (fulfilled ? ' on' : '')}
                      disabled={busyId === c.id}
                      onClick={() => toggleStake(c, !fulfilled)}
                    >
                      <span className="chal-stake-toggle-mark" aria-hidden="true">
                        {fulfilled ? '✓' : ''}
                      </span>
                      <span className="chal-stake-toggle-copy">
                        {fulfilled
                          ? `${loserName} completed the stake`
                          : `Mark ${loserName}'s stake as done`}
                      </span>
                    </button>
                  ) : (
                    <div className={'chal-stake-pill' + (fulfilled ? ' done' : ' pending')}>
                      {fulfilled
                        ? `Stake confirmed by ${winner}`
                        : `Waiting for ${winner} to confirm the stake`}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {err ? <p className="chal-status err">{err}</p> : null}
    </div>
  );
}
