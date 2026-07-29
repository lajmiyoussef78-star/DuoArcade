/**
 * Online duo bridge for stickman / laser-wall couch games.
 *
 * Role A (host) = Player 1 · Role B (guest) = Player 2.
 * Host runs the sim and streams state; guest streams input.
 * Guest may press the P1 key layout locally — codes remap to P2 when sent.
 */

/** Build P1→P2 remap from parallel KEYS objects: { left, right, ... }. */
export function remapFromKeys(p1Keys, p2Keys) {
  const map = {};
  for (const action of Object.keys(p1Keys)) {
    if (p2Keys[action]) map[p1Keys[action]] = p2Keys[action];
  }
  return map;
}

function payloadBytes(payload) {
  let json;
  try { json = JSON.stringify(payload); } catch { return 0; }
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(json).byteLength;
  return json.length;
}

/**
 * Generic host-state / guest-input bridge for realtime duo games.
 *
 * Laser Wall and other host-authoritative consumers can register a current,
 * complete snapshot with `setStateProvider(() => snapshot)`. `forceState()`
 * sends that provider immediately, and reconnect/sync automatically requests
 * or sends it. Existing `netTick`, `sendUi`, and `sendTrail` calls remain valid.
 *
 * @param {object} opts
 * @param {object|null} opts.rt
 * @param {'A'|'B'} opts.myRole
 * @param {string[]} opts.p1Codes
 * @param {string[]} opts.p2Codes
 * @param {Record<string,string>|null} [opts.remap] P1 code → P2 code for guest comfort
 * @param {(()=>object|null)|null} [opts.stateProvider] Host full-state provider
 * @returns {{
 *   setStateProvider: (fn:(()=>object|null)|null) => (()=>void),
 *   forceState: (stateOrProvider?:(object|(()=>object|null))) => boolean,
 *   sendLifecycle: (type:string, payload?:object) => boolean,
 *   getMetrics: () => {
 *     messagesSent:number, messagesReceived:number, bytesSent:number, bytesReceived:number,
 *     reconnects:number, staleDrops:number, staleInputDrops:number,
 *     staleStateDrops:number, staleTrailDrops:number, stateAgeMs:number|null
 *   }
 * }}
 */
export function createDuoStickmanNet({
  rt,
  myRole,
  p1Codes,
  p2Codes,
  remap = null,
  stateProvider: initialStateProvider = null,
}) {
  const online = !!(rt && myRole);
  const isHost = !online || myRole === 'A';
  const myCodes = new Set(isHost ? p1Codes : p2Codes);
  const otherCodes = isHost ? p2Codes : p1Codes;
  const guestRemap = remap || {};

  /** @type {Record<string, boolean>} */
  let remoteKeys = {};
  /** @type {Record<string, boolean>} */
  let prevRemoteKeys = {};
  /** @type {string[]} */
  let remotePressed = [];
  /** @type {object|null} */
  let remoteExtra = null;
  let remoteState = null;
  let lastState = null;
  let remoteTrail = null;
  let seq = 0;
  let lastSeq = -1;
  let inputSeq = 0;
  let lastInputSeq = -1;
  let trailSeq = 0;
  let lastTrailSeq = -1;
  let stateProvider = typeof initialStateProvider === 'function' ? initialStateProvider : null;
  let lastTickStateProvider = null;
  let lastHostState = null;
  let lastStateAt = null;
  /** @type {((m:any)=>void)|null} */
  let uiHandler = null;
  /** edge buffer for local presses to send */
  let localPressedBuf = [];

  const localHeld = {};
  let unsub = null;
  let unsubReconnect = null;
  const metrics = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    reconnects: 0,
    staleInputDrops: 0,
    staleStateDrops: 0,
    staleTrailDrops: 0,
  };

  function sendMessage(message) {
    if (!online || !rt?.send) return false;
    metrics.messagesSent += 1;
    metrics.bytesSent += payloadBytes(message);
    rt.send(message);
    return true;
  }

  const onMsg = (m) => {
    metrics.messagesReceived += 1;
    metrics.bytesReceived += payloadBytes(m);
    if (!m || !m.k) return;
    if (m.k === 'inp') {
      // Host receives guest (P2). Guest may also receive host P1 if we mirror — host only needs guest.
      if (isHost && m.role !== 'A') {
        if (typeof m.seq === 'number' && m.seq <= lastInputSeq) {
          metrics.staleInputDrops += 1;
          return;
        }
        if (typeof m.seq === 'number') lastInputSeq = m.seq;
        remoteKeys = { ...(m.keys || {}) };
        if (Array.isArray(m.pressed)) remotePressed.push(...m.pressed);
        if (m.extra) remoteExtra = m.extra;
      } else if (!isHost && m.role === 'A') {
        remoteKeys = { ...(m.keys || {}) };
        if (Array.isArray(m.pressed)) remotePressed.push(...m.pressed);
        if (m.extra) remoteExtra = m.extra;
      }
    } else if (m.k === 'st' && !isHost) {
      if (typeof m.seq === 'number' && m.seq <= lastSeq) {
        metrics.staleStateDrops += 1;
        return;
      }
      if (typeof m.seq === 'number') lastSeq = m.seq;
      remoteState = m.st;
      lastState = m.st;
      lastStateAt = Date.now();
    } else if (m.k === 'trail' && !isHost) {
      // Dedicated laser trail channel — never blocked by empty st snapshots
      if (typeof m.seq === 'number' && m.seq <= lastTrailSeq) {
        metrics.staleTrailDrops += 1;
        return;
      }
      if (typeof m.seq === 'number') lastTrailSeq = m.seq;
      remoteTrail = m;
    } else if (m.k === 'ui' && uiHandler) {
      uiHandler(m);
    } else if ((m.k === 'start' || m.k === 'ready' || m.k === 'sel' || m.k === 'menu' || m.k === 'round' || m.k === 'over') && uiHandler) {
      // Top-level lobby events (more reliable than nested ui for some clients)
      uiHandler({ type: m.k, ...m });
    } else if (m.k === 'sync' && isHost) {
      forceState();
    }
  };

  if (online && rt) {
    if (typeof rt.subscribe === 'function') unsub = rt.subscribe(onMsg);
    else if (typeof rt.on === 'function') rt.on(onMsg);
    if (typeof rt.subscribeReconnect === 'function') {
      unsubReconnect = rt.subscribeReconnect(() => {
        metrics.reconnects += 1;
        if (isHost) forceState();
        else sendMessage({ k: 'sync' });
      });
    }
  }

  function resolveLocalCode(code) {
    if (!online) return code;
    if (isHost) return myCodes.has(code) ? code : null;
    // Guest: accept native P2 codes, or P1 layout remapped to P2
    if (myCodes.has(code)) return code;
    const mapped = guestRemap[code];
    if (mapped && myCodes.has(mapped)) return mapped;
    return null;
  }

  function ensureKeyBags(S) {
    if (!S.keys) S.keys = {};
    if (!S.pressed) S.pressed = {};
  }

  /** Call from keydown. Returns the code written into S.keys, or null if ignored. */
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

  /** Call from keyup. */
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

  /**
   * Merge remote player's keys into S before the sim step.
   * Returns key codes that were just released remotely (for hold-to-fire games).
   */
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
    for (const code of remotePressed) {
      S.pressed[code] = true;
    }
    remotePressed = [];
    return released;
  }

  /** Guest: pull newest unread host snapshot (clears unread flag). */
  function takeState() {
    if (!remoteState) return null;
    const st = remoteState;
    remoteState = null;
    return st;
  }

  /** Guest: last known host snapshot (kept between packets). */
  function peekState() {
    return lastState;
  }

  /** Drop cached host snapshots (menu / leave match). */
  function clearState() {
    remoteState = null;
    lastState = null;
    remoteTrail = null;
    lastStateAt = null;
    lastSeq = -1;
    lastTrailSeq = -1;
  }

  /** Host: send laser ink on its own coalesced channel (separate from st). */
  function sendTrail(data) {
    if (!online || !rt?.send || !isHost) return;
    if (!data) return;
    trailSeq += 1;
    sendMessage({
      k: 'trail',
      seq: trailSeq,
      ink: Array.isArray(data.ink) ? data.ink : null,
      enc: data.enc ? 1 : 0,
      n: data.n || 0,
      len: data.len || 0,
    });
  }

  /** Guest: pull newest unread trail packet. */
  function takeTrail() {
    if (!remoteTrail) return null;
    const t = remoteTrail;
    remoteTrail = null;
    return t;
  }

  /**
   * Host: register the provider used by forceState(), reconnect recovery, and
   * guest `sync` requests. Pass null to clear it. Returns a scoped cleanup.
   */
  function setStateProvider(provider) {
    stateProvider = typeof provider === 'function' ? provider : null;
    const registered = stateProvider;
    return () => {
      if (stateProvider === registered) stateProvider = null;
    };
  }

  /**
   * Host: immediately enqueue one full `st` snapshot.
   * With no argument, uses setStateProvider(), the latest netTick provider,
   * then the last packed state. Returns true only when a state was sent.
   */
  function forceState(stateOrProvider) {
    if (!online || !isHost || !rt?.send) return false;
    const explicit = arguments.length > 0;
    let source = explicit
      ? stateOrProvider
      : (stateProvider || lastTickStateProvider);
    let st = typeof source === 'function' ? source() : source;
    if (st == null && !explicit) st = lastHostState;
    if (st == null) return false;
    lastHostState = st;
    lastStateAt = Date.now();
    seq += 1;
    return sendMessage({ k: 'st', seq, st, full: 1 });
  }

  /** Host → broadcast state; guest → broadcast input. Call ~20Hz. */
  function netTick(packState, guestExtra) {
    if (!online || !rt?.send) return;
    if (isHost) {
      seq += 1;
      if (typeof packState === 'function') lastTickStateProvider = packState;
      const st = typeof packState === 'function' ? packState() : packState;
      if (st != null) {
        lastHostState = st;
        lastStateAt = Date.now();
        sendMessage({ k: 'st', seq, st });
      }
    } else {
      const keys = {};
      for (const code of p2Codes) keys[code] = !!localHeld[code];
      const pressed = localPressedBuf.splice(0, localPressedBuf.length);
      inputSeq += 1;
      const payload = { k: 'inp', role: 'B', seq: inputSeq, keys, pressed };
      if (guestExtra != null) payload.extra = typeof guestExtra === 'function' ? guestExtra() : guestExtra;
      sendMessage(payload);
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

  /** Optional: host also mirrors P1 keys so a predicting guest can soft-sim. */
  function netTickHostInput() {
    if (!online || !rt?.send || !isHost) return;
    const keys = {};
    for (const code of p1Codes) keys[code] = !!localHeld[code];
    const pressed = localPressedBuf.splice(0, localPressedBuf.length);
    sendMessage({ k: 'inp', role: 'A', keys, pressed });
  }

  function sendUi(payload) {
    if (!online || !rt?.send) return;
    const type = payload?.type;
    // Prefer dedicated kinds for lobby handshake so they never get lost behind inp/st
    if (type === 'start' || type === 'ready' || type === 'sel' || type === 'menu' || type === 'round' || type === 'over') {
      sendLifecycle(type, payload);
    }
    sendMessage({ k: 'ui', ...payload });
  }

  /** Send one explicit top-level lifecycle packet without a nested `ui` copy. */
  function sendLifecycle(type, payload = {}) {
    if (!['start', 'ready', 'sel', 'menu', 'round', 'over'].includes(type)) return false;
    return sendMessage({ ...payload, k: type, type });
  }

  function onUi(fn) {
    uiHandler = fn;
  }

  /** Return a snapshot of transport/application counters for diagnostics. */
  function getMetrics() {
    const staleDrops = metrics.staleInputDrops
      + metrics.staleStateDrops
      + metrics.staleTrailDrops;
    return {
      ...metrics,
      staleDrops,
      stateAgeMs: lastStateAt == null ? null : Math.max(0, Date.now() - lastStateAt),
    };
  }

  function dispose() {
    try { unsub?.(); } catch { /* ignore */ }
    try { unsubReconnect?.(); } catch { /* ignore */ }
    unsub = null;
    unsubReconnect = null;
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
    setStateProvider,
    forceState,
    netTick,
    netTickHostInput,
    takeRemoteExtra,
    peekRemoteExtra,
    sendLifecycle,
    sendUi,
    onUi,
    getMetrics,
    touchSet,
    dispose,
    myCodes,
    p1Codes,
    p2Codes,
  };
}
