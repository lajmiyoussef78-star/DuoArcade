import { useEffect, useRef, useState } from 'react';
import {
  getSparksPack, quickPrompts, fullPrompts, promptById,
  sparksRevealLine, afterglowQuestions,
  createTimedSparkHooks, packTimedTriggers,
} from '../lib/watchSparks.js';
import { Confetti } from './CoupleFx.jsx';
import { other } from '../lib/util.js';

/**
 * Sparks = overlay on media sessions, not a hub card.
 * Manual Quick spark / Full pack; blind until both answer; agreement-first.
 * Timed hooks: structure ready when pack has t_sec / timedTriggers; auto-fire off by default.
 */
export default function SparksOverlay({
  duo, myRole, interactive, pushInteractive, onClose,
  positionSec = 0,
}) {
  const pack = getSparksPack();
  const partner = other(myRole) === 'A' ? duo.nameA : duo.nameB;
  const [localPick, setLocalPick] = useState(null);
  const [timedMode, setTimedMode] = useState(!!interactive?.timedMode);
  const [softCue, setSoftCue] = useState(null);
  const hooksRef = useRef(null);
  if (!hooksRef.current) {
    hooksRef.current = createTimedSparkHooks();
    hooksRef.current.seedFromPack(pack);
  }

  const phase = interactive?.phase || 'idle';
  const prompt = promptById(interactive?.promptId);
  const mine = interactive?.answers?.[myRole] ?? null;
  const theirs = interactive?.answers?.[other(myRole)] ?? null;
  const both = mine != null && theirs != null;
  const timedCount = packTimedTriggers(pack).length;

  useEffect(() => {
    if (phase === 'answering') setLocalPick(null);
  }, [interactive?.promptId, phase]);

  /* Timed mode: poll dueAt for soft cue only — never auto-start a prompt. */
  useEffect(() => {
    if (!timedMode || interactive?.on) {
      setSoftCue(null);
      return undefined;
    }
    const hooks = hooksRef.current;
    if (!hooks || !hooks.list().length) return undefined;
    const tick = () => {
      const due = hooks.dueAt(positionSec);
      setSoftCue(due || null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timedMode, positionSec, interactive?.on]);

  const toggleTimedMode = () => {
    const next = !timedMode;
    setTimedMode(next);
    if (next) hooksRef.current?.seedFromPack(pack);
    pushInteractive({
      ...(interactive || { on: false }),
      timedMode: next,
    });
  };

  const startFromCue = (cue) => {
    if (!cue?.promptId) return;
    setSoftCue(null);
    pushInteractive({
      on: true,
      mode: 'timed',
      timedMode: true,
      promptId: cue.promptId,
      phase: 'answering',
      answers: { A: null, B: null },
      queue: [cue.promptId],
      qi: 0,
      packId: pack.id,
    });
  };

  const startQuick = () => {
    const list = quickPrompts();
    const first = list[0];
    if (!first) return;
    pushInteractive({
      on: true,
      mode: 'quick',
      timedMode,
      promptId: first.id,
      phase: 'answering',
      answers: { A: null, B: null },
      queue: list.map(p => p.id),
      qi: 0,
      packId: pack.id,
    });
  };

  const startFull = () => {
    const list = fullPrompts();
    const first = list[0];
    if (!first) return;
    pushInteractive({
      on: true,
      mode: 'full',
      timedMode,
      promptId: first.id,
      phase: 'answering',
      answers: { A: null, B: null },
      queue: list.map(p => p.id),
      qi: 0,
      packId: pack.id,
    });
  };

  const submitAnswer = (choice) => {
    if (mine != null) return;
    const answers = { ...(interactive.answers || { A: null, B: null }), [myRole]: choice };
    const otherAns = answers[other(myRole)];
    const next = { ...interactive, answers };
    if (otherAns != null) {
      next.phase = 'reveal';
      const agree = choice === otherAns;
      next.score = {
        A: (interactive.score?.A || 0) + (agree ? 1 : 0),
        B: (interactive.score?.B || 0) + (agree ? 1 : 0),
      };
    }
    pushInteractive(next);
  };

  const nextPrompt = () => {
    const queue = interactive.queue || [];
    const qi = (interactive.qi || 0) + 1;
    if (qi >= queue.length) {
      pushInteractive({
        ...interactive,
        phase: 'done',
        promptId: null,
      });
      return;
    }
    pushInteractive({
      ...interactive,
      qi,
      promptId: queue[qi],
      phase: 'answering',
      answers: { A: null, B: null },
    });
  };

  if (!interactive?.on) {
    const cuePrompt = softCue ? promptById(softCue.promptId) : null;
    return (
      <div className="wp-sparks-sheet">
        <div className="wp-sparks-head">
          <h4>Sparks</h4>
          <button type="button" className="btn ghost small" onClick={onClose}>Close</button>
        </div>
        <p className="wp-sparks-blurb">{pack.blurb}</p>
        <div className="row">
          <button type="button" className="btn warm small" onClick={startQuick}>Quick spark</button>
          <button type="button" className="btn small" onClick={startFull}>Full pack</button>
        </div>
        {timedCount > 0 && (
          <div className="wp-sparks-timed">
            <label className="wp-sparks-timed-toggle">
              <input
                type="checkbox"
                checked={timedMode}
                onChange={toggleTimedMode}
              />
              Timed cues ({timedCount}) — register only, no auto-fire
            </label>
            {timedMode && softCue && cuePrompt && (
              <div className="wp-sparks-cue">
                <span>Cue at {fmtCue(softCue.atSec)}: {cuePrompt.q}</span>
                <button type="button" className="btn warm small" onClick={() => startFromCue(softCue)}>
                  Drop spark
                </button>
              </div>
            )}
            {timedMode && !softCue && (
              <p className="wp-muted">
                Hooks ready
                {hooksRef.current?.nextAfter(positionSec)
                  ? ` · next at ${fmtCue(hooksRef.current.nextAfter(positionSec).atSec)}`
                  : ' · no upcoming cues'}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (phase === 'done') {
    const qs = afterglowQuestions();
    return (
      <div className="wp-sparks-sheet">
        <div className="wp-sparks-head">
          <h4>Sparks complete</h4>
          <button type="button" className="btn ghost small" onClick={onClose}>Close</button>
        </div>
        <p className="wp-sparks-blurb">
          Agreement moments: {interactive.score?.A || 0}
          {' · '}points are secondary — the mind-reads matter.
        </p>
        <div className="wp-afterglow">
          {qs.slice(0, 2).map((q, i) => <p key={i} className="wp-afterglow-q">{q}</p>)}
        </div>
        <button type="button" className="btn warm small" onClick={() => pushInteractive({ on: false, timedMode })}>
          Turn Sparks off
        </button>
      </div>
    );
  }

  if (phase === 'reveal' && prompt && both) {
    const line = sparksRevealLine(mine, theirs);
    const agree = mine === theirs;
    return (
      <div className="wp-sparks-sheet reveal">
        {agree && <div className="wp-sparks-fx"><Confetti count={18} small /></div>}
        <div className="wp-sparks-head">
          <h4>Reveal</h4>
          <button type="button" className="btn ghost small" onClick={onClose}>Hide</button>
        </div>
        <p className="wp-sparks-q">{prompt.q}</p>
        <p className="wp-sparks-ans">You: <b>{mine}</b> {'·'} {partner}: <b>{theirs}</b></p>
        <p className="wp-sparks-line"><b>{line}</b></p>
        <button type="button" className="btn warm small" onClick={nextPrompt}>Next</button>
      </div>
    );
  }

  // answering
  return (
    <div className="wp-sparks-sheet">
      <div className="wp-sparks-head">
        <h4>
          {interactive.mode === 'quick' ? 'Quick spark'
            : interactive.mode === 'timed' ? 'Timed spark'
              : pack.title}
        </h4>
        <button type="button" className="btn ghost small" onClick={onClose}>Hide</button>
      </div>
      {prompt && (
        <>
          <p className="wp-sparks-q">{prompt.q}</p>
          {mine != null ? (
            <p className="wp-sparks-wait">Answer locked. Waiting for {partner}…</p>
          ) : (
            <div className="wp-sparks-choices">
              {(prompt.choices || []).map(c => (
                <button
                  key={c}
                  type="button"
                  className={'btn small' + (localPick === c ? ' warm' : '')}
                  onClick={() => { setLocalPick(c); submitAnswer(c); }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function fmtCue(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
