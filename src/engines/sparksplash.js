// engines/sparksplash.js — Spark & Splash remote co-op platformer.
// Host (A / Spark): runs physics, broadcasts state ~20×/sec.
// Guest (B / Splash): streams input, renders latest state.

import { createSparkSplashGame } from './sparksplashCore.js';

export const meta = {
  id: 'sparksplash',
  name: 'Spark & Splash',
  tag: 'co-op · platformer · remote',
  accent: 'candle',
  realtime: true
};

let raf = null, sendTimer = null, cleanupFns = [];
let game = null;

const keys = { left: false, right: false, up: false, a: false, d: false, w: false };

function readKeys() {
  return {
    left: !!(keys.left || keys.a),
    right: !!(keys.right || keys.d),
    jump: !!(keys.up || keys.w)
  };
}

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'ss-wrap';
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 520;
  canvas.className = 'ss-canvas';
  const hint = document.createElement('div');
  hint.className = 'dots-score ss-hint';
  const isHost = ctx.myRole === 'A';
  const myLabel = isHost ? ctx.names.A : ctx.names.B;
  const theirLabel = isHost ? ctx.names.B : ctx.names.A;
  hint.textContent = isHost
    ? `You are Spark (${myLabel}) — A/D move, W jump. ${theirLabel} controls Splash remotely.`
    : `You are Splash (${myLabel}) — arrow keys move and jump. ${theirLabel} controls Spark remotely.`;
  wrap.appendChild(canvas);
  wrap.appendChild(hint);
  el.appendChild(wrap);

  game = createSparkSplashGame(canvas);
  let finished = false;
  let gotState = !isHost ? false : true;
  let remoteInp = { left: false, right: false, jump: false };

  const onKeyDown = e => {
    game.initAudio();
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; keys.a = true; e.preventDefault(); }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; keys.d = true; e.preventDefault(); }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { keys.up = true; keys.w = true; e.preventDefault(); }
    if ((k === 'p' || k === 'P') && isHost) { game.togglePause(); e.preventDefault(); }
    if ((k === 'r' || k === 'R') && isHost) { game.restartLevel(); e.preventDefault(); }
  };
  const onKeyUp = e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = false; keys.a = false; }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = false; keys.d = false; }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { keys.up = false; keys.w = false; }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  cleanupFns.push(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  });

  function finishCoop(fromHost) {
    if (finished) return;
    finished = true;
    if (isHost) ctx.rt.send({ k: 'done' });
    if (fromHost) ctx.onFinish('draw');
  }

  ctx.rt.on(msg => {
    if (finished) return;
    if (isHost) {
      if (msg.k === 'inp') remoteInp = { left: !!msg.left, right: !!msg.right, jump: !!msg.jump };
    } else {
      if (msg.k === 'state') { game.importState(msg.st); gotState = true; }
      if (msg.k === 'done') finishCoop(false);
    }
  });

  if (isHost) {
    game.startRemote(() => finishCoop(true), { fire: ctx.names.A, water: ctx.names.B });
    ctx.rt.send({ k: 'state', st: game.exportState() });
    sendTimer = setInterval(() => {
      if (!finished) ctx.rt.send({ k: 'state', st: game.exportState() });
    }, 50);
  } else {
    sendTimer = setInterval(() => {
      if (!finished) ctx.rt.send({ k: 'inp', ...readKeys() });
    }, 50);
  }

  function frame() {
    if (!finished) {
      if (isHost) {
        game.applyInput('fire', readKeys());
        game.applyInput('water', remoteInp);
        game.tickFrame();
      } else if (gotState) {
        game.renderFrame();
      } else {
        const g = canvas.getContext('2d');
        g.fillStyle = '#14101B';
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.fillStyle = '#FFC66E';
        g.font = '18px Inter, sans-serif';
        g.textAlign = 'center';
        g.fillText('Syncing with your partner…', canvas.width / 2, canvas.height / 2);
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}

export function unmount() {
  if (raf) cancelAnimationFrame(raf), raf = null;
  if (sendTimer) clearInterval(sendTimer), sendTimer = null;
  cleanupFns.forEach(f => f());
  cleanupFns = [];
  game = null;
  keys.left = keys.right = keys.up = keys.a = keys.d = keys.w = false;
}
