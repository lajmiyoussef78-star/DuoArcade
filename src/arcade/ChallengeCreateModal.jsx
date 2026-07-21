// ChallengeCreateModal.jsx — compact create flow on the home screen.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GAME_LIST, STAKE_GROUPS, createChallenge,
} from '../lib/challenges.js';
import { artFor } from '../engines/art.js';
import { ENGINES } from '../engines/index.js';
import '../styles/challenges.css';

const MAX_REROLLS = 2;

function pickRandom(stakes, avoidSet) {
  const avoid = avoidSet instanceof Set ? avoidSet : new Set(avoidSet ? [avoidSet] : []);
  const pool = stakes.filter(s => !avoid.has(s));
  const use = pool.length ? pool : stakes;
  if (!use.length) return '';
  return use[Math.floor(Math.random() * use.length)];
}

export default function ChallengeCreateModal({ code, open, onClose, onCreated }) {
  const [step, setStep] = useState('stake'); // stake | game
  const [stake, setStake] = useState('');
  const [assistOpen, setAssistOpen] = useState(false);
  const [groupId, setGroupId] = useState(null);
  const [rerollsLeft, setRerollsLeft] = useState(MAX_REROLLS);
  const [seenStakes, setSeenStakes] = useState([]);
  const [game1, setGame1] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [spin, setSpin] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setStep('stake');
    setStake('');
    setAssistOpen(false);
    setGroupId(null);
    setRerollsLeft(MAX_REROLLS);
    setSeenStakes([]);
    setGame1(null);
    setBusy(false);
    setErr('');
    setSpin(false);
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
    // Only reset when the modal opens — not when onClose identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const group = STAKE_GROUPS.find(g => g.id === groupId);
  const stakeOk = stake.trim().length >= 1 && stake.trim().length <= 140;

  const chooseTheme = (id) => {
    const g = STAKE_GROUPS.find(x => x.id === id);
    if (!g) return;
    const first = pickRandom(g.stakes, []);
    setGroupId(id);
    setStake(first);
    setSeenStakes(first ? [first] : []);
    setRerollsLeft(MAX_REROLLS);
    setErr('');
  };

  const reroll = () => {
    if (!group || rerollsLeft <= 0 || spin) return;
    setSpin(true);
    setErr('');
    const avoid = new Set(seenStakes);
    let ticks = 0;
    const id = setInterval(() => {
      setStake(pickRandom(group.stakes, avoid));
      ticks += 1;
      if (ticks >= 8) {
        clearInterval(id);
        const next = pickRandom(group.stakes, avoid);
        setStake(next);
        if (next) setSeenStakes(prev => (prev.includes(next) ? prev : [...prev, next]));
        setRerollsLeft(n => n - 1);
        setSpin(false);
      }
    }, 55);
  };

  const send = async () => {
    if (!code || !stakeOk || !game1) return;
    setBusy(true);
    setErr('');
    try {
      await createChallenge(code, stake.trim(), game1);
      onCreated?.();
      onClose?.();
    } catch (e) {
      setErr(e.message || 'Could not send challenge');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="chal-pop-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="chal-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chal-pop-title"
      >
        <header className="chal-pop-head">
          <div>
            <div className="chal-pop-kicker">New challenge</div>
            <h2 id="chal-pop-title">
              {step === 'stake' ? 'The stake' : 'Your game'}
            </h2>
          </div>
          <button type="button" className="chal-pop-x" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="chal-pop-body">
          {step === 'stake' && (
            <>
              {!groupId && (
                <>
                  <p className="chal-pop-lead">Write your own stake — or roll a random one for inspiration.</p>

                  <label className="chal-pop-field-label" htmlFor="chal-stake-input">Stake</label>
                  <textarea
                    id="chal-stake-input"
                    className="chal-pop-textarea"
                    rows={3}
                    maxLength={140}
                    value={stake}
                    disabled={spin}
                    onChange={e => {
                      setStake(e.target.value);
                      setErr('');
                    }}
                    placeholder="Loser cooks dinner…"
                  />
                  <div className="chal-pop-count">{stake.trim().length}/140</div>

                  <button
                    type="button"
                    className={'chal-pop-assist-toggle' + (assistOpen ? ' on' : '')}
                    aria-expanded={assistOpen}
                    onClick={() => setAssistOpen(v => !v)}
                  >
                    {assistOpen ? 'Hide random stakes' : 'Need a random stake?'}
                  </button>

                  {assistOpen && (
                    <div className="chal-pop-assist">
                      <p className="chal-pop-assist-lead">Pick a theme — we fill the stake for you.</p>
                      <div className="chal-pop-themes">
                        {STAKE_GROUPS.map(g => (
                          <button
                            key={g.id}
                            type="button"
                            className="chal-pop-theme"
                            onClick={() => chooseTheme(g.id)}
                          >
                            <span className="chal-pop-theme-label">{g.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="chal-pop-actions">
                    <button
                      type="button"
                      className="btn warm"
                      disabled={!stakeOk || spin}
                      onClick={() => { setStep('game'); setErr(''); }}
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {groupId && (
                <>
                  <div className={'chal-pop-stake' + (spin ? ' spinning' : '')}>
                    {stake}
                  </div>
                  <div className="chal-pop-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={rerollsLeft <= 0 || spin}
                      onClick={reroll}
                    >
                      {rerollsLeft > 0 ? `Reroll (${rerollsLeft} left)` : 'No rerolls left'}
                    </button>
                    <button
                      type="button"
                      className="btn warm"
                      disabled={!stakeOk || spin}
                      onClick={() => { setStep('game'); setErr(''); }}
                    >
                      Continue
                    </button>
                  </div>
                  <button
                    type="button"
                    className="chal-pop-back"
                    onClick={() => {
                      setGroupId(null);
                      setAssistOpen(true);
                      setRerollsLeft(MAX_REROLLS);
                      setSeenStakes([]);
                    }}
                  >
                    Change theme
                  </button>
                </>
              )}
            </>
          )}

          {step === 'game' && (
            <>
              <div className="chal-pop-stake mini">{stake.trim()}</div>
              <p className="chal-pop-lead">Pick Game 1 — your partner will pick Game 2.</p>
              <div className="chal-pop-games">
                {GAME_LIST.map(g => {
                  const art = artFor(g.id);
                  const tag = ENGINES[g.id]?.meta?.tag || '';
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={'chal-pop-gcard' + (game1 === g.id ? ' on' : '')}
                      aria-label={g.name}
                      aria-pressed={game1 === g.id}
                      onClick={() => setGame1(g.id)}
                    >
                      {art ? (
                        <span
                          className="chal-pop-gcard-art"
                          aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: art }}
                        />
                      ) : null}
                      <span className="chal-pop-gcard-veil" aria-hidden="true" />
                      <span className="chal-pop-gname">{g.name}</span>
                      {tag ? <span className="chal-pop-gtag">{tag}</span> : null}
                    </button>
                  );
                })}
              </div>
              <div className="chal-pop-actions">
                <button type="button" className="btn ghost" onClick={() => setStep('stake')}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn warm"
                  disabled={!game1 || busy}
                  onClick={send}
                >
                  {busy ? 'Sending…' : 'Send challenge'}
                </button>
              </div>
            </>
          )}

          {err && <p className="chal-pop-err">{err}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}
