// engines/pong.js — Duo Pong (FIXBUG).
// Equal seats: both run full ball physics. Own paddle instant.
// Peer paddle from soft pose; slim st for score/ball authority.
// Never host-puppet, never every-ms flood, never rewind own paddle.
//
// Coordinates are normalized 0..1. Player A = LEFT, player B = RIGHT.

export const meta = {
  id: 'pong',
  name: 'Duo Pong',
  tag: 'real-time \u00b7 first to 7',
  accent: 'p2',
  realtime: true
};

export const WIN_SCORE = 7;
export const PADDLE_H = 0.22;
export const PADDLE_W = 0.02;
export const BALL_R = 0.015;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initialPhysics(dir = 1, seed = 1, serveN = 0) {
  const rnd = mulberry32((seed ^ ((serveN + 1) * 2654435761)) >>> 0);
  return {
    ball: {
      x: 0.5,
      y: 0.5,
      vx: 0.42 * dir,
      vy: 0.25 * (rnd() > 0.5 ? 1 : -1)
    },
    pa: 0.5,
    pb: 0.5,
    sa: 0,
    sb: 0,
    seed: seed >>> 0,
    serveN
  };
}

/**
 * Pure physics step. opts.poseLock { pa?, pb? } locks authored paddle Y
 * so the peer’s delayed stick never re-drives them.
 */
export function step(st, dt, opts = {}) {
  const lock = opts.poseLock || {};
  const s = {
    ball: { ...st.ball },
    pa: lock.pa != null ? lock.pa : st.pa,
    pb: lock.pb != null ? lock.pb : st.pb,
    sa: st.sa,
    sb: st.sb,
    seed: st.seed ?? 1,
    serveN: st.serveN ?? 0
  };
  const b = s.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
  if (b.y > 1 - BALL_R) { b.y = 1 - BALL_R; b.vy = -Math.abs(b.vy); }

  if (b.x < PADDLE_W + BALL_R && b.vx < 0) {
    if (Math.abs(b.y - s.pa) < PADDLE_H / 2 + BALL_R) {
      b.x = PADDLE_W + BALL_R;
      b.vx = Math.abs(b.vx) * 1.04;
      b.vy += (b.y - s.pa) * 1.6;
    }
  }
  if (b.x > 1 - PADDLE_W - BALL_R && b.vx > 0) {
    if (Math.abs(b.y - s.pb) < PADDLE_H / 2 + BALL_R) {
      b.x = 1 - PADDLE_W - BALL_R;
      b.vx = -Math.abs(b.vx) * 1.04;
      b.vy += (b.y - s.pb) * 1.6;
    }
  }
  b.vy = Math.max(-0.9, Math.min(0.9, b.vy));

  let scored = null;
  if (b.x < -BALL_R) { s.sb++; scored = 'B'; }
  if (b.x > 1 + BALL_R) { s.sa++; scored = 'A'; }
  if (scored) {
    const dir = scored === 'A' ? -1 : 1;
    const nextServe = (s.serveN || 0) + 1;
    const fresh = initialPhysics(dir, s.seed, nextServe);
    s.ball = fresh.ball;
    s.serveN = nextServe;
  }
  return { state: s, scored };
}

/** Soft authority: scores from host; ball snaps only on hard desync. */
export function reconcilePong(local, host) {
  if (!host) return local;
  if (!local) {
    return {
      ball: { ...host.ball },
      pa: host.pa, pb: host.pb,
      sa: host.sa, sb: host.sb,
      seed: host.seed ?? 1,
      serveN: host.serveN ?? 0
    };
  }
  const s = {
    ball: { ...local.ball },
    pa: local.pa,
    pb: local.pb,
    sa: host.sa,
    sb: host.sb,
    seed: host.seed ?? local.seed ?? 1,
    serveN: Math.max(local.serveN || 0, host.serveN || 0)
  };
  const dx = local.ball.x - host.ball.x;
  const dy = local.ball.y - host.ball.y;
  if (Math.hypot(dx, dy) > 0.2
    || Math.sign(local.ball.vx) !== Math.sign(host.ball.vx)
    || local.sa !== host.sa
    || local.sb !== host.sb) {
    s.ball = { ...host.ball };
  }
  return s;
}

function packAuth(st) {
  return {
    ball: { x: st.ball.x, y: st.ball.y, vx: st.ball.vx, vy: st.ball.vy },
    sa: st.sa,
    sb: st.sb,
    seed: st.seed,
    serveN: st.serveN
  };
}

/* ---------------- mount / unmount (shell realtime contract) ---------------- */

let raf = null;
let cleanupFns = [];
let paused = false;

export function setPaused(p) {
  paused = !!p;
}

export function mount(el, ctx) {
  unmount();
  paused = false;
  el.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'pong-wrap';
  const score = document.createElement('div');
  score.className = 'pong-score';
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 500;
  canvas.className = 'pong-canvas';
  const hint = document.createElement('div');
  hint.className = 'dots-score';
  hint.textContent = ctx.myRole === 'A'
    ? 'you are the LEFT paddle \u2014 move with mouse, touch, or \u2191\u2193'
    : 'you are the RIGHT paddle \u2014 move with mouse, touch, or \u2191\u2193';
  wrap.appendChild(score); wrap.appendChild(canvas); wrap.appendChild(hint);
  el.appendChild(wrap);
  const g = canvas.getContext('2d');

  const me = ctx.myRole;
  const isHost = me === 'A';
  let st = null;
  let myPaddle = 0.5;
  let peerPaddle = 0.5;
  let finished = false;
  let started = false;
  let lastPose = 0;
  let lastPush = 0;
  let stSeq = 0;
  let lastStSeq = -1;
  let seed = 1;

  const setPaddle = y => {
    myPaddle = Math.max(PADDLE_H / 2, Math.min(1 - PADDLE_H / 2, y));
  };
  const onPointer = e => {
    const rect = canvas.getBoundingClientRect();
    const y = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) / rect.height;
    setPaddle(y);
  };
  const onKey = e => {
    if (e.key === 'ArrowUp') setPaddle(myPaddle - 0.05);
    if (e.key === 'ArrowDown') setPaddle(myPaddle + 0.05);
  };
  canvas.addEventListener('pointermove', onPointer);
  canvas.addEventListener('touchmove', onPointer, { passive: true });
  window.addEventListener('keydown', onKey);
  cleanupFns.push(() => {
    canvas.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('touchmove', onPointer);
    window.removeEventListener('keydown', onKey);
  });

  function begin(s) {
    if (started) return;
    started = true;
    seed = (s >>> 0) || 1;
    st = initialPhysics(1, seed, 0);
    st.pa = myPaddle;
    st.pb = peerPaddle;
  }

  function finish(w, iAmAuthority) {
    if (finished) return;
    finished = true;
    if (isHost) {
      const msg = { k: 'over', w };
      ctx.rt.send(msg);
      setTimeout(() => ctx.rt.send(msg), 120);
      setTimeout(() => ctx.rt.send(msg), 280);
    }
    if (iAmAuthority) ctx.onFinish(w);
  }

  function pushSt(force = false) {
    if (!isHost || !st || finished) return;
    stSeq += 1;
    const msg = { k: 'st', seq: stSeq, st: packAuth(st) };
    ctx.rt.send(msg);
    if (force) {
      setTimeout(() => ctx.rt.send(msg), 100);
      setTimeout(() => ctx.rt.send(msg), 240);
    }
  }

  function sendPose() {
    ctx.rt.send({ k: 'pose', by: me, y: myPaddle });
  }

  ctx.rt.on(msg => {
    if (finished || !msg?.k) return;
    if (msg.k === 'needstart') {
      if (isHost && started) {
        ctx.rt.send({ k: 'start', seed });
        pushSt(true);
      }
      return;
    }
    if (msg.k === 'start') {
      begin(msg.seed ?? ((Date.now() >>> 0) ^ 0x50A6));
      return;
    }
    if (msg.k === 'pose') {
      if (!msg.by || msg.by === me) return;
      if (typeof msg.y === 'number') {
        peerPaddle = Math.max(PADDLE_H / 2, Math.min(1 - PADDLE_H / 2, msg.y));
      }
      return;
    }
    if (msg.k === 'st' || msg.k === 'state') {
      if (isHost) return;
      if (typeof msg.seq === 'number') {
        if (msg.seq <= lastStSeq) return;
        lastStSeq = msg.seq;
      }
      const remote = msg.st;
      if (!remote?.ball) return;
      if (!st) {
        st = {
          ball: { ...remote.ball },
          pa: me === 'A' ? myPaddle : peerPaddle,
          pb: me === 'B' ? myPaddle : peerPaddle,
          sa: remote.sa || 0,
          sb: remote.sb || 0,
          seed: remote.seed ?? seed,
          serveN: remote.serveN ?? 0
        };
        started = true;
        return;
      }
      // Keep own paddle; soft-merge ball/score.
      const merged = reconcilePong(st, remote);
      st = {
        ...merged,
        pa: me === 'A' ? myPaddle : peerPaddle,
        pb: me === 'B' ? myPaddle : peerPaddle
      };
      return;
    }
    if (msg.k === 'over' || msg.k === 'done') {
      finish(msg.w || msg.winner, false);
    }
  });

  (async () => {
    try { await ctx.rt?.whenReady?.(); } catch { /* */ }
    if (finished) return;
    if (isHost) {
      const s = (Date.now() >>> 0) ^ 0x50A6;
      begin(s);
      const push = () => {
        ctx.rt.send({ k: 'start', seed: s });
        pushSt(true);
      };
      push();
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      cleanupFns.push(() => { clearTimeout(t1); clearTimeout(t2); });
    } else {
      const ask = () => {
        if (!started) ctx.rt.send({ k: 'needstart' });
      };
      ask();
      const iv = setInterval(ask, 500);
      cleanupFns.push(() => clearInterval(iv));
    }
  })();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (!finished && st && !paused) {
      // Equal seat path: own paddle local, peer from pose, full step.
      if (me === 'A') {
        st.pa = myPaddle;
        st.pb = peerPaddle;
      } else {
        st.pa = peerPaddle;
        st.pb = myPaddle;
      }

      const prevSa = st.sa, prevSb = st.sb;
      const r = step(st, dt, {
        poseLock: { pa: st.pa, pb: st.pb }
      });
      st = r.state;

      if (isHost) {
        const scored = r.scored || st.sa !== prevSa || st.sb !== prevSb;
        const force = !!(scored || st.sa >= WIN_SCORE || st.sb >= WIN_SCORE);
        if (force || now - lastPush > 100) {
          pushSt(force);
          lastPush = now;
        }
        if (st.sa >= WIN_SCORE) finish('A', true);
        else if (st.sb >= WIN_SCORE) finish('B', true);
      }

      if (now - lastPose > 50) {
        lastPose = now;
        sendPose();
      }
    } else if (!finished && st) {
      // Paused: still echo own paddle for peer view.
      if (me === 'A') st.pa = myPaddle;
      else st.pb = myPaddle;
    }

    draw();
    if (!finished) raf = requestAnimationFrame(frame);
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    const css = getComputedStyle(document.documentElement);
    const P1 = css.getPropertyValue('--p1').trim() || '#7FA8FF';
    const P2 = css.getPropertyValue('--p2').trim() || '#FF7FA8';
    const CAN = css.getPropertyValue('--candle').trim() || '#FFC66E';
    g.fillStyle = '#14101B'; g.fillRect(0, 0, W, H);
    if (!st) {
      score.textContent = 'Charging paddles\u2026';
      return;
    }
    g.strokeStyle = '#3D3450'; g.setLineDash([8, 10]);
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]);
    g.fillStyle = P1;
    g.fillRect(0, (st.pa - PADDLE_H / 2) * H, PADDLE_W * W, PADDLE_H * H);
    g.fillStyle = P2;
    g.fillRect(W - PADDLE_W * W, (st.pb - PADDLE_H / 2) * H, PADDLE_W * W, PADDLE_H * H);
    g.fillStyle = CAN;
    g.beginPath(); g.arc(st.ball.x * W, st.ball.y * H, BALL_R * W, 0, Math.PI * 2); g.fill();
    score.innerHTML = `<span class="pA">${ctx.names.A} ${st.sa}</span> \u2013 <span class="pB">${st.sb} ${ctx.names.B}</span>`;
  }

  raf = requestAnimationFrame(frame);
}

export function unmount() {
  if (raf) cancelAnimationFrame(raf), raf = null;
  cleanupFns.forEach(f => f());
  cleanupFns = [];
  paused = false;
}
