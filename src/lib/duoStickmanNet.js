/**
 * Online duo bridge for stickman / laser-wall couch games.
 *
 * Role A (host) = Player 1 · Role B (guest) = Player 2.
 * Host streams `st` snapshots; guest streams `inp` (+ optional pose in extra).
 * Guest may press the P1 key layout locally — codes remap to P2 when sent.
 * Host may press the P2 key layout (arrows) locally — codes remap to P1.
 */

/** Build P1→P2 remap from parallel KEYS objects: { left, right, ... }. */
export function remapFromKeys(p1Keys, p2Keys) {
  const map = {};
  for (const action of Object.keys(p1Keys)) {
    if (p2Keys[action]) map[p1Keys[action]] = p2Keys[action];
  }
  return map;
}

/**
 * @param {object} opts
 * @param {object|null} opts.rt
 * @param {'A'|'B'} opts.myRole
 * @param {string[]} opts.p1Codes
 * @param {string[]} opts.p2Codes
 * @param {Record<string,string>|null} [opts.remap]
 */
export function createDuoStickmanNet({ rt, myRole, p1Codes, p2Codes, remap = null }) {
  const online = !!(rt && myRole);
  const isHost = !online || myRole === 'A';
  const myCodes = new Set(isHost ? p1Codes : p2Codes);
  const otherCodes = isHost ? p2Codes : p1Codes;
  const guestRemap = remap || {};
  const hostRemap = {};
  for (const [from, to] of Object.entries(guestRemap)) {
    if (to) hostRemap[to] = from;
  }

  let remoteKeys = {};
  let prevRemoteKeys = {};
  let remotePressed = [];
  let remoteExtra = null;
  let remoteState = null;
  let lastState = null;
  let remoteTrail = null;
  let seq = 0;
  let lastSeq = -1;
  let trailSeq = 0;
  let lastTrailSeq = -1;
  let uiHandler = null;
  let localPressedBuf = [];
  const localHeld = {};
  let unsub = null;

  const onMsg = (m) => {
    if (!m || !m.k) return;
    if (m.k === 'inp') {
      if (isHost && (m.role === 'B' || m.role == null)) {
        remoteKeys = { ...(m.keys || {}) };
        if (Array.isArray(m.pressed)) remotePressed.push(...m.pressed);
        if (m.extra) remoteExtra = m.extra;
      } else if (!isHost && m.role === 'A') {
        remoteKeys = { ...(m.keys || {}) };
        if (Array.isArray(m.pressed)) remotePressed.push(...m.pressed);
        if (m.extra) remoteExtra = m.extra;
      }
    } else if (m.k === 'pose' && m.pose) {
      // Optional dedicated pose (racing may send both inp.extra + pose).
      if (isHost && m.role === 'B') remoteExtra = { pose: m.pose };
      else if (!isHost && m.role === 'A') remoteExtra = { pose: m.pose };
    } else if (m.k === 'p1' && !isHost) {
      // Flat host body → same shape as st so takeState/peekState both work.
      if (typeof m.seq === 'number') {
        if (m.seq <= lastSeq) {
          const hostRestarted = lastSeq > 60 && m.seq < 15;
          if (!hostRestarted) return;
        }
        lastSeq = m.seq;
      }
      if (typeof m.x === 'number') {
        remoteExtra = { pose: m, from: 'p1' };
        remoteState = {
          raceT: m.raceT, mode: m.mode, modeT: m.modeT, done: m.done,
          state: m.state, countT: m.countT,
          players: [m, m.p2status || null],
          p: m,
        };
        lastState = remoteState;
      }
    } else if (m.k === 'p2' && isHost) {
      if (typeof m.x === 'number') remoteExtra = { pose: m, from: 'p2' };
    } else if (m.k === 'st' && !isHost) {
      if (typeof m.seq === 'number') {
        // Drop older snapshots, but accept host remount / seq reset so P1
        // doesn't freeze forever on the invited screen.
        if (m.seq <= lastSeq) {
          const hostRestarted = lastSeq > 60 && m.seq < 15;
          if (!hostRestarted) return;
        }
        lastSeq = m.seq;
      }
      remoteState = m.st;
      lastState = m.st;
    } else if (m.k === 'trail' && !isHost) {
      if (typeof m.seq === 'number' && m.seq <= lastTrailSeq) return;
      if (typeof m.seq === 'number') lastTrailSeq = m.seq;
      remoteTrail = m;
    } else if (m.k === 'ui' && uiHandler) {
      uiHandler(m);
    } else if ((m.k === 'start' || m.k === 'ready' || m.k === 'sel' || m.k === 'menu' || m.k === 'round' || m.k === 'finish') && uiHandler) {
      uiHandler({ type: m.k, ...m });
    }
  };

  if (online && rt) {
    if (typeof rt.subscribe === 'function') unsub = rt.subscribe(onMsg);
    else if (typeof rt.on === 'function') rt.on(onMsg);
  }

  function resolveLocalCode(code) {
    if (!online) return code;
    if (myCodes.has(code)) return code;
    const mapped = isHost ? hostRemap[code] : guestRemap[code];
    if (mapped && myCodes.has(mapped)) return mapped;
    return null;
  }

  function ensureKeyBags(S) {
    if (!S.keys) S.keys = {};
    if (!S.pressed) S.pressed = {};
  }

  function onKeyDown(code, S) {
    ensureKeyBags(S);
    if (!online) {
      if (!S.keys[code]) S.pressed[code] = true;
      S.keys[code] = true;
      localHeld[code] = true;
      return code;
    }
    const resolved = resolveLocalCode(code);
    if (!resolved) return null;
    if (!S.keys[resolved]) {
      S.pressed[resolved] = true;
      localPressedBuf.push(resolved);
    }
    S.keys[resolved] = true;
    localHeld[resolved] = true;
    return resolved;
  }

  function onKeyUp(code, S) {
    ensureKeyBags(S);
    if (!online) {
      S.keys[code] = false;
      localHeld[code] = false;
      return code;
    }
    const resolved = resolveLocalCode(code);
    if (!resolved) return null;
    S.keys[resolved] = false;
    localHeld[resolved] = false;
    return resolved;
  }

  function mergeRemoteInto(S) {
    if (!online) return [];
    ensureKeyBags(S);
    const released = [];
    for (const code of otherCodes) {
      const next = !!remoteKeys[code];
      if (prevRemoteKeys[code] && !next) released.push(code);
      S.keys[code] = next;
    }
    prevRemoteKeys = { ...remoteKeys };
    for (const code of remotePressed) S.pressed[code] = true;
    remotePressed = [];
    return released;
  }

  function takeState() {
    if (!remoteState) return null;
    const st = remoteState;
    remoteState = null;
    return st;
  }

  function peekState() {
    return lastState;
  }

  function clearState() {
    remoteState = null;
    lastState = null;
    remoteTrail = null;
    remoteExtra = null;
    remoteKeys = {};
    prevRemoteKeys = {};
    remotePressed = [];
    lastSeq = -1;
    lastTrailSeq = -1;
  }

  function sendTrail(data) {
    if (!online || !rt?.send || !isHost || !data) return;
    trailSeq += 1;
    rt.send({
      k: 'trail',
      seq: trailSeq,
      ink: Array.isArray(data.ink) ? data.ink : null,
      enc: data.enc ? 1 : 0,
      n: data.n || 0,
      len: data.len || 0,
    });
  }

  function takeTrail() {
    if (!remoteTrail) return null;
    const t = remoteTrail;
    remoteTrail = null;
    return t;
  }

  /**
   * Host → { k:'st', st }. Guest → { k:'inp', extra? }.
   * Matches Kart Racing (proven path).
   */
  function netTick(packState, extraPack) {
    const send = (rt && (rt.sendNow || rt.send)) || null;
    if (!online || !send) return;
    if (isHost) {
      seq += 1;
      const st = typeof packState === 'function' ? packState() : packState;
      if (st != null) send({ k: 'st', seq, st });
    } else {
      const keys = {};
      for (const code of p2Codes) keys[code] = !!localHeld[code];
      const pressed = localPressedBuf.splice(0, localPressedBuf.length);
      const payload = { k: 'inp', role: 'B', keys, pressed };
      if (extraPack != null) {
        const extra = typeof extraPack === 'function' ? extraPack() : extraPack;
        if (extra != null) payload.extra = extra;
      }
      send(payload);
    }
  }

  function takeRemoteExtra() {
    const x = remoteExtra;
    remoteExtra = null;
    return x;
  }

  function peekRemoteExtra() {
    return remoteExtra;
  }

  /** Direct pose channel for kart/racing — avoids st+inp fighting for authority. */
  function sendPose(pose) {
    const send = (rt && (rt.sendNow || rt.send)) || null;
    if (!online || !send || !pose) return;
    if (isHost) {
      seq += 1;
      send({ k: 'p1', seq, role: 'A', ...pose });
    } else {
      send({ k: 'p2', role: 'B', ...pose });
    }
  }

  function netTickHostInput() {
    if (!online || !rt?.send || !isHost) return;
    const keys = {};
    for (const code of p1Codes) keys[code] = !!localHeld[code];
    const pressed = localPressedBuf.splice(0, localPressedBuf.length);
    rt.send({ k: 'inp', role: 'A', keys, pressed });
  }

  function sendUi(payload) {
    if (!online || !rt?.send) return;
    const type = payload?.type;
    if (type === 'start' || type === 'ready' || type === 'sel' || type === 'menu' || type === 'round' || type === 'finish') {
      rt.send({ k: type, ...payload });
    }
    rt.send({ k: 'ui', ...payload });
  }

  function onUi(fn) {
    uiHandler = fn;
  }

  function dispose() {
    try { unsub?.(); } catch { /* ignore */ }
    unsub = null;
    uiHandler = null;
  }

  function touchSet(code, isDown, S) {
    if (!online) {
      if (isDown && !S.keys[code]) S.pressed[code] = true;
      S.keys[code] = isDown;
      localHeld[code] = isDown;
      return;
    }
    const resolved = resolveLocalCode(code);
    if (!resolved) return;
    if (isDown && !S.keys[resolved]) {
      S.pressed[resolved] = true;
      localPressedBuf.push(resolved);
    }
    S.keys[resolved] = isDown;
    localHeld[resolved] = isDown;
  }

  return {
    online,
    isHost,
    myRole: myRole || 'A',
    onKeyDown,
    onKeyUp,
    mergeRemoteInto,
    takeState,
    peekState,
    clearState,
    sendTrail,
    takeTrail,
    netTick,
    netTickHostInput,
    takeRemoteExtra,
    peekRemoteExtra,
    sendPose,
    sendUi,
    onUi,
    touchSet,
    dispose,
    myCodes,
    p1Codes,
    p2Codes,
  };
}
