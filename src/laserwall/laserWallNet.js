const STATES = new Set(['menu', 'intro', 'play', 'roundEnd', 'done']);

const finite = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const bounded = (value, min, max, fallback = min) =>
  Math.max(min, Math.min(max, finite(value, fallback)));

function copyArt(art) {
  if (!art) return null;
  return {
    x: +finite(art.x, 250).toFixed(1),
    face: art.face < 0 ? -1 : 1,
  };
}

function copyRunner(run) {
  if (!run) return null;
  return {
    x: +finite(run.x, 1000).toFixed(1),
    y: +finite(run.y, 450).toFixed(1),
    vx: +finite(run.vx).toFixed(1),
    vy: +finite(run.vy).toFixed(1),
    onWall: !!run.onWall,
    onGround: !!run.onGround,
    stickCd: +Math.max(0, finite(run.stickCd)).toFixed(3),
    squash: +Math.max(0, finite(run.squash)).toFixed(3),
  };
}

function copyMouse(mouse) {
  if (!mouse) return null;
  return {
    x: +finite(mouse.x, 1000).toFixed(1),
    y: +finite(mouse.y, 500).toFixed(1),
    down: !!mouse.down,
  };
}

function copyBeam(beam) {
  if (!beam) return null;
  return {
    hx: +finite(beam.hx).toFixed(1),
    hy: +finite(beam.hy).toFixed(1),
    x: +finite(beam.x).toFixed(1),
    y: +finite(beam.y).toFixed(1),
    blocked: !!beam.blocked,
    g: beam.g ? 1 : 0,
  };
}

/** Compact, game-specific snapshot. Role A is the only caller allowed to send it. */
export function packLaserWallState(E, settings, extra = {}) {
  const publicExtra = { ...(extra || {}) };
  delete publicExtra.forceFp;
  return {
    state: STATES.has(E?.state) ? E.state : 'menu',
    timer: +Math.max(0, finite(E?.timer)).toFixed(2),
    covered: Math.max(0, Number.isInteger(E?.covered) ? E.covered : 0),
    offTime: +Math.max(0, finite(E?.offTime)).toFixed(2),
    artist: E?.artist === 1 ? 1 : 0,
    round: E?.round === 2 ? 2 : 1,
    tplName: typeof E?.tpl?.name === 'string' ? E.tpl.name : '',
    map: Math.max(0, Number.isInteger(settings?.map) ? settings.map : 0),
    time: Math.max(1, Number.isInteger(settings?.time) ? settings.time : 60),
    matchAt: Math.max(0, finite(E?._matchAt)),
    art: copyArt(E?.art),
    run: copyRunner(E?.run),
    mouse: copyMouse(E?.mouse),
    beam: copyBeam(E?.beam),
    accs: [
      bounded(E?.accs?.[0], 0, 100),
      bounded(E?.accs?.[1], 0, 100),
    ],
    roundEnd: E?.state === 'roundEnd' && E?._roundEnd
      ? { ...E._roundEnd }
      : null,
    finalRes: E?._finalRes ? {
      accs: [
        bounded(E._finalRes.accs?.[0], 0, 100),
        bounded(E._finalRes.accs?.[1], 0, 100),
      ],
      winner: [-1, 0, 1].includes(E._finalRes.winner)
        ? E._finalRes.winner
        : -1,
    } : null,
    ...publicExtra,
  };
}

/** Guest intent contains controls/aim only—never player or world poses. */
export function packLaserWallGuestIntent(E) {
  return {
    t: finite(E?.now),
    mouse: copyMouse(E?.mouse),
  };
}

export function sanitizeLaserWallState(value) {
  if (!value || typeof value !== 'object' || !STATES.has(value.state)) return null;
  if (![0, 1].includes(value.artist) || ![1, 2].includes(value.round)) return null;
  if (!Array.isArray(value.accs) || value.accs.length !== 2) return null;
  return {
    ...value,
    timer: Math.max(0, finite(value.timer)),
    covered: Math.max(0, Number.isInteger(value.covered) ? value.covered : 0),
    offTime: Math.max(0, finite(value.offTime)),
    art: copyArt(value.art),
    run: copyRunner(value.run),
    mouse: copyMouse(value.mouse),
    beam: copyBeam(value.beam),
    accs: [
      bounded(value.accs[0], 0, 100),
      bounded(value.accs[1], 0, 100),
    ],
  };
}

function boundedAxis(current, target, dt, rate, maxStep) {
  const error = target - current;
  const alpha = 1 - Math.exp(-Math.max(0, dt) * rate);
  return current + Math.max(-maxStep, Math.min(maxStep, error * alpha));
}

/**
 * Apply role-A authority while preserving immediate role-B movement. The guest
 * owns only presentation prediction; large errors still snap to host truth.
 */
export function applyLaserWallGuestState(E, rawState, dt = 1 / 60) {
  const state = sanitizeLaserWallState(rawState);
  if (!state) return { accepted: false, corrections: null };

  E.artist = state.artist;
  E.round = state.round;
  E.state = state.state;
  E.timer = state.timer;
  E.covered = state.covered;
  E.offTime = state.offTime;
  E.accs = [...state.accs];
  const guestIsShooter = state.artist === 1;
  if (state.mouse && !guestIsShooter) Object.assign(E.mouse, state.mouse);
  E.beam = state.beam ? { ...state.beam } : null;

  const corrections = { art: 0, run: 0 };

  if (state.art && E.art) {
    const error = Math.abs(state.art.x - E.art.x);
    corrections.art = error;
    if (!guestIsShooter || error > 180) {
      Object.assign(E.art, state.art);
    } else {
      E.art.x = boundedAxis(E.art.x, state.art.x, dt, 10, 14);
    }
  }

  if (state.run && E.run) {
    const error = Math.hypot(state.run.x - E.run.x, state.run.y - E.run.y);
    corrections.run = error;
    if (guestIsShooter || error > 220) {
      Object.assign(E.run, state.run);
    } else {
      E.run.x = boundedAxis(E.run.x, state.run.x, dt, 11, 18);
      E.run.y = boundedAxis(E.run.y, state.run.y, dt, 11, 18);
      E.run.vx += (state.run.vx - finite(E.run.vx)) * 0.2;
      E.run.vy += (state.run.vy - finite(E.run.vy)) * 0.2;
      E.run.onWall = state.run.onWall;
      E.run.onGround = state.run.onGround;
      E.run.stickCd = state.run.stickCd;
      E.run.squash = state.run.squash;
    }
  }

  return { accepted: true, state, corrections };
}

export function laserWallWinnerRole(finalRes) {
  if (!finalRes || ![-1, 0, 1].includes(finalRes.winner)) return null;
  return finalRes.winner === -1 ? 'draw' : (finalRes.winner === 0 ? 'A' : 'B');
}

/** Drop oldest completed strokes only — never thin mid-stroke points. */
export function inkBoundPreserveStrokes(ink, maxLen = 2700) {
  if (!Array.isArray(ink) || ink.length <= maxLen) return ink;
  let cut = ink.length - maxLen;
  cut -= cut % 3;
  for (let i = cut; i + 2 < ink.length; i += 3) {
    if (ink[i] < 0) return ink.slice(i + 3);
  }
  return ink.slice(Math.max(0, cut));
}

/**
 * Host trail packet: append-only deltas. `reset` replaces guest ink.
 * `from` is the absolute ink index the delta starts at.
 */
export function packLaserWallTrailDelta(ink, sentLen, {
  compact = (values) => values,
  maxDelta = 900,
  maxReset = 2400,
} = {}) {
  if (!Array.isArray(ink) || ink.length < 3) return null;
  let safeSent = Math.max(0, Number(sentLen) || 0);
  if (safeSent > ink.length) safeSent = 0;
  if (safeSent === ink.length) return null;

  const remaining = ink.length - safeSent;

  // Fresh sync / large catch-up: send a replace window (full ink when it fits).
  if (safeSent === 0 || remaining > maxDelta) {
    if (ink.length <= maxReset) {
      return {
        ink: compact(ink.slice()),
        enc: 1,
        from: 0,
        len: ink.length,
        reset: 1,
        nextSent: ink.length,
      };
    }
    const start = ink.length - maxDelta;
    const aligned = start - (start % 3);
    return {
      ink: compact(ink.slice(aligned)),
      enc: 1,
      from: 0,
      len: ink.length - aligned,
      reset: 1,
      nextSent: ink.length,
    };
  }

  return {
    ink: compact(ink.slice(safeSent)),
    enc: 1,
    from: safeSent,
    len: ink.length,
    reset: 0,
    nextSent: ink.length,
  };
}

/** Guest: append deltas or replace on reset. Never deletes newer local points unless reset. */
export function applyLaserWallTrailDelta(currentInk, pkt, expand = (v) => v) {
  if (!pkt || !Array.isArray(pkt.ink) || pkt.ink.length < 3) {
    return { ink: currentInk || [], changed: false };
  }
  const chunk = pkt.enc ? expand(pkt.ink) : pkt.ink;
  if (!chunk || chunk.length < 3) return { ink: currentInk || [], changed: false };

  const from = Number.isInteger(pkt.from) ? pkt.from : 0;
  const reset = !!pkt.reset || from === 0;
  const cur = Array.isArray(currentInk) ? currentInk : [];

  if (reset) {
    if (from <= 0) return { ink: chunk.slice(), changed: true };
    if (from > cur.length) return { ink: chunk.slice(), changed: true };
    return { ink: cur.slice(0, from).concat(chunk), changed: true };
  }

  if (from === cur.length) {
    return { ink: cur.concat(chunk), changed: true };
  }
  if (from < cur.length) {
    // Overlap / resend of a suffix — replace from `from` forward.
    return { ink: cur.slice(0, from).concat(chunk), changed: true };
  }
  // Gap — cannot append safely; ignore until a reset arrives.
  return { ink: cur, changed: false, gap: true };
}
