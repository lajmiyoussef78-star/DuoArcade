// engines/sparksplash.js — Spark & Splash remote co-op
//
// Sync model (must stay this simple or desync returns):
//   • Guest B owns Splash body — sends lightweight pose ~30Hz (+ instant on key change)
//   • Host A owns world (level, gates, deaths, doors) — broadcasts state ~20Hz
//   • Host NEVER simulates Splash from keyboard input (that put Splash in the wrong place)
//   • Guest NEVER overwrites local Splash from host state during play
//   • Poses are level-tagged; wrong-level poses are ignored (no door-leak into next cavern)

import { createSparkSplashGame } from './sparksplashCore.js';

export const meta = {
  id: 'sparksplash',
  name: 'Spark & Splash',
  tag: 'co-op · platformer · remote',
  accent: 'candle',
  realtime: true
};

let raf = null;
let sendTimer = null;
let cleanupFns = [];
let game = null;

function padButton(label, cls) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ss-pad-btn ' + cls;
  b.textContent = label;
  b.setAttribute('aria-label', label);
  return b;
}

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';

  const isHost = ctx.myRole === 'A';
  const myLabel = isHost ? ctx.names.A : ctx.names.B;
  const theirLabel = isHost ? ctx.names.B : ctx.names.A;

  const wrap = document.createElement('div');
  wrap.className = 'ss-wrap';

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 520;
  canvas.className = 'ss-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Spark and Splash');

  const hint = document.createElement('div');
  hint.className = 'dots-score ss-hint';
  hint.textContent = isHost
    ? `Spark (${myLabel}) — A/D move · W jump · or use the pad`
    : `Splash (${myLabel}) — ← → ↑ / A D W · or use the pad`;

  const status = document.createElement('div');
  status.className = 'ss-net';

  const pad = document.createElement('div');
  pad.className = 'ss-pad';
  const btnL = padButton('◀', 'left');
  const btnR = padButton('▶', 'right');
  const btnJ = padButton('JUMP', 'jump');
  pad.append(btnL, btnJ, btnR);

  wrap.append(canvas, hint, status, pad);
  el.appendChild(wrap);
  try { canvas.focus({ preventScroll: true }); } catch { /* ignore */ }

  const keys = { left: false, right: false, jump: false };
  let alive = true;
  let finished = false;
  let linked = false;
  let lastStateAt = 0;
  let lastPoseSend = 0;
  let stateSeq = 0;
  let poseSeq = 0;
  let lastHostSeq = 0;
  let lastPoseSeq = 0;
  let lastPose = null;
  let lastPoseLvl = -1;
  let remoteAt = 0;
  let guestReady = false;
  let hostLevel = 0;
  let hostPhase = 'play';
  let lastNeedPoseAt = 0;

  game = createSparkSplashGame(canvas);
  game.startRemote(
    isHost ? () => finishCoop(true) : () => {},
    { fire: ctx.names.A, water: ctx.names.B }
  );
  hostLevel = game.getLevelIdx();
  hostPhase = game.getState();
  setStatus(isHost ? `Hosting — waiting for ${theirLabel}…` : `Connecting to ${theirLabel}…`, isHost);

  function setStatus(text, ok) {
    status.textContent = text || '';
    status.classList.toggle('ok', !!ok);
    status.classList.toggle('bad', !ok && !!text);
  }

  function readKeys() {
    return { left: keys.left, right: keys.right, jump: keys.jump };
  }

  const send = payload => {
    if (!alive || finished || !ctx.rt) return Promise.resolve();
    try { return ctx.rt.send(payload); } catch { return Promise.resolve(); }
  };

  function clearPose() {
    lastPose = null;
    lastPoseLvl = -1;
    lastPoseSeq = 0;
  }

  function sendState() {
    if (!isHost || !alive || finished) return;
    const st = game.exportState();
    if (!st) return;
    // Mark splash as display-only for the guest (guest keeps local body).
    st.splashAuth = 'guest';
    stateSeq += 1;
    send({ k: 'state', st, seq: stateSeq });
  }

  /** Compact pose — this is what keeps Splash aligned on Spark's screen. */
  function sendPose(force) {
    if (isHost || !alive || finished || !guestReady) return;
    const now = Date.now();
    const k = readKeys();
    const moving = k.left || k.right || k.jump;
    if (!force && now - lastPoseSend < (moving ? 24 : 50)) return;
    lastPoseSend = now;
    poseSeq += 1;
    let splash = null;
    let boxes = null;
    try { splash = game.exportSplash(); } catch { return; }
    try {
      const bx = game.exportBoxes?.();
      if (bx?.length) boxes = bx;
    } catch { /* ignore */ }
    send({
      k: 'pose',
      p: splash,
      boxes,
      left: k.left,
      right: k.right,
      jump: k.jump,
      lvl: game.getLevelIdx(),
      seq: poseSeq,
      t: now
    });
  }

  function sendClaim(gems, pads) {
    if (isHost || !alive || finished) return;
    if ((!gems || !gems.length) && (!pads || !pads.length)) return;
    send({
      k: 'claim',
      gems: gems || [],
      pads: pads || [],
      lvl: game.getLevelIdx(),
      t: Date.now()
    });
  }

  function setKey(which, down) {
    if (keys[which] === down) return false;
    keys[which] = down;
    return true;
  }

  function applyKey(which, down, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!setKey(which, down)) return;
    try { game.initAudio(); } catch { /* ignore */ }
    if (!isHost) sendPose(true);
  }

  function clearKeys() {
    const any = keys.left || keys.right || keys.jump;
    keys.left = keys.right = keys.jump = false;
    if (any && !isHost) sendPose(true);
  }

  const onKeyDown = e => {
    if (e.repeat || finished) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') applyKey('left', true, e);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') applyKey('right', true, e);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') applyKey('jump', true, e);
    else if (isHost && (k === 'p' || k === 'P')) { game.togglePause(); e.preventDefault(); }
    else if (isHost && (k === 'r' || k === 'R')) {
      game.restartLevel();
      clearPose();
      sendState();
      e.preventDefault();
    }
  };
  const onKeyUp = e => {
    if (finished) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') applyKey('left', false, e);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') applyKey('right', false, e);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') applyKey('jump', false, e);
  };
  const onBlur = () => clearKeys();
  const onVis = () => { if (document.hidden) clearKeys(); };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('pointerdown', () => {
    try { canvas.focus({ preventScroll: true }); } catch { /* ignore */ }
  });
  cleanupFns.push(() => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVis);
  });

  function bindPad(btn, which) {
    const down = e => { e.preventDefault(); applyKey(which, true, null); btn.classList.add('held'); };
    const up = e => { e.preventDefault(); applyKey(which, false, null); btn.classList.remove('held'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
    cleanupFns.push(() => {
      btn.removeEventListener('pointerdown', down);
      btn.removeEventListener('pointerup', up);
      btn.removeEventListener('pointerleave', up);
      btn.removeEventListener('pointercancel', up);
    });
  }
  bindPad(btnL, 'left');
  bindPad(btnR, 'right');
  bindPad(btnJ, 'jump');

  function finishCoop(fromHost) {
    if (finished) return;
    finished = true;
    if (isHost) send({ k: 'done' });
    if (fromHost) ctx.onFinish('draw');
    setStatus('All caverns cleared — great teamwork!', true);
  }

  function applyGuestPose(msg) {
    const body = msg.p || msg.splash;
    if (!body || typeof body.x !== 'number') return false;
    if (game.getState() !== 'play') return false;
    if (game.isSplashDead()) return false;
    const lvl = typeof msg.lvl === 'number' ? msg.lvl : game.getLevelIdx();
    // Only same cavern — blocks door-pose leak after level clear.
    if (lvl !== game.getLevelIdx()) return false;
    if (typeof msg.seq === 'number') {
      if (msg.seq < lastPoseSeq) return false;
      lastPoseSeq = msg.seq;
    }
    game.importSplash(body, {
      ignoreIfDead: true,
      levelIdx: lvl,
      requirePlay: true
    });
    if (game.isSplashDead()) return false;
    lastPose = body;
    lastPoseLvl = lvl;
    remoteAt = Date.now();
    linked = true;
    if (msg.boxes?.length) {
      try { game.importBoxes(msg.boxes, { levelIdx: lvl }); } catch { /* ignore */ }
    }
    return true;
  }

  ctx.rt.on(msg => {
    if (!alive || finished || !msg || typeof msg !== 'object') return;

    if (isHost) {
      // Accept both 'pose' (new) and legacy 'inp' with splash.
      if (msg.k === 'pose' || msg.k === 'inp') {
        applyGuestPose(msg);
      } else if (msg.k === 'claim') {
        if (typeof msg.lvl === 'number' && msg.lvl !== game.getLevelIdx()) return;
        let dirty = false;
        if (msg.gems?.length) dirty = game.applyGemClaims(msg.gems) > 0 || dirty;
        if (msg.pads?.length) dirty = game.applyPadPress(msg.pads) > 0 || dirty;
        if (dirty) sendState();
      } else if (msg.k === 'needstate') {
        linked = true;
        sendState();
      }
      return;
    }

    // Guest
    if (msg.k === 'state' && msg.st) {
      if (typeof msg.seq === 'number') {
        if (msg.seq < lastHostSeq) return;
        lastHostSeq = msg.seq;
      }
      try {
        const prevLvl = game.getLevelIdx();
        const res = game.importState(msg.st, { guest: true });
        guestReady = true;
        linked = true;
        lastStateAt = Date.now();
        if (res?.levelChanged || game.getLevelIdx() !== prevLvl) {
          clearKeys();
          sendPose(true);
        }
        setStatus(`Linked with ${theirLabel} · you are Splash`, true);
      } catch (e) {
        console.warn('Spark & Splash import failed', e);
        guestReady = false;
        setStatus('Sync glitch — retrying…', false);
      }
    } else if (msg.k === 'needpose') {
      sendPose(true);
    } else if (msg.k === 'done') {
      finishCoop(false);
    }
  });

  const startNet = () => {
    if (!alive || finished) return;
    if (isHost) {
      sendState();
      sendTimer = setInterval(() => {
        if (!alive || finished) return;
        sendState();
        // If Splash pose goes quiet, ask the guest to resend (fixes “stuck at spawn”).
        if (linked && Date.now() - remoteAt > 700 && Date.now() - lastNeedPoseAt > 600) {
          lastNeedPoseAt = Date.now();
          send({ k: 'needpose' });
          setStatus(`Waiting for ${theirLabel}'s Splash…`, false);
        }
      }, 50);
    } else {
      send({ k: 'needstate' });
      sendTimer = setInterval(() => {
        if (!alive || finished) return;
        sendPose(false);
        if (!lastStateAt || Date.now() - lastStateAt > 1800) {
          send({ k: 'needstate' });
          if (lastStateAt) setStatus('Reconnecting…', false);
        }
      }, 50);
    }
  };

  const ready = ctx.rt?.ready ? ctx.rt.ready : Promise.resolve();
  ready.then(() => { if (alive) startNet(); }).catch(() => { if (alive) startNet(); });

  function frame() {
    if (!alive) return;
    if (!finished) {
      if (isHost) {
        const gemsBefore = game.gemCount();
        const stateBefore = game.getState();
        const levelBefore = game.getLevelIdx();

        game.applyInput('fire', readKeys());

        // Pose-only Splash. Never integrate remote keys — that desynced Spark's view.
        const poseLive =
          lastPose &&
          lastPoseLvl === game.getLevelIdx() &&
          game.getState() === 'play' &&
          !game.isSplashDead() &&
          (Date.now() - remoteAt < 800);

        if (poseLive) {
          game.importSplash(lastPose, {
            ignoreIfDead: true,
            levelIdx: lastPoseLvl,
            requirePlay: true
          });
        }
        game.tickFrame({ skipSplashMove: true });

        const levelNow = game.getLevelIdx();
        const phaseNow = game.getState();
        if (levelNow !== hostLevel || phaseNow !== hostPhase) {
          clearPose();
          hostLevel = levelNow;
          hostPhase = phaseNow;
          sendState();
          send({ k: 'needpose' });
        } else if (
          game.gemCount() > gemsBefore ||
          phaseNow !== stateBefore ||
          levelNow !== levelBefore
        ) {
          sendState();
        }

        if (poseLive) setStatus(`Live with ${theirLabel} · Splash synced`, true);
        else if (linked) setStatus(`Live with ${theirLabel} · syncing Splash…`, false);
      } else if (guestReady) {
        game.tickGuestWorld();
        const touched = game.tickGuestSplash(readKeys()) || { gems: [], pads: [] };
        game.renderFrame();
        if (touched.gems.length || touched.pads.length) {
          sendClaim(touched.gems, touched.pads);
        }
        sendPose(false);
      } else {
        game.renderFrame();
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  cleanupFns.push(() => { alive = false; });
}

export function unmount() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (sendTimer) clearInterval(sendTimer);
  sendTimer = null;
  cleanupFns.forEach(fn => { try { fn(); } catch { /* ignore */ } });
  cleanupFns = [];
  game = null;
}

export function setPaused(v) {
  try { game?.setPaused?.(!!v); } catch { /* ignore */ }
}
