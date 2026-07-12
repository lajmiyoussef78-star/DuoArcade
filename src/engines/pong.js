// engines/pong.js — Duo Pong: the first real-time 2D game.
//
// Architecture (host-authoritative):
//   * Host (side A) runs the physics loop and broadcasts state ~20x/sec.
//   * Guest (side B) streams paddle input and renders the latest state,
//     interpolating the ball between packets.
//   * First to 7 wins; the host reports the result to the shell, which
//     writes it into the duo record like any other game.
//
// Coordinates are normalized 0..1. Player A defends the LEFT wall,
// player B the RIGHT wall.

export const meta = { id: 'pong', name: 'Duo Pong', tag: 'real-time \u00b7 first to 7', accent: 'p2', realtime: true };

export const WIN_SCORE = 7;
export const PADDLE_H = 0.22;
export const PADDLE_W = 0.02;
export const BALL_R = 0.015;

export function initialPhysics(dir = 1) {
  return {
    ball: { x: 0.5, y: 0.5, vx: 0.42 * dir, vy: 0.25 * (Math.random() > 0.5 ? 1 : -1) },
    pa: 0.5, pb: 0.5,
    sa: 0, sb: 0
  };
}

// Pure physics step (unit-testable). Returns 'A' | 'B' | null when a point
// is scored (the scorer), mutating a COPY of the state it is given.
export function step(st, dt) {
  const s = { ball: { ...st.ball }, pa: st.pa, pb: st.pb, sa: st.sa, sb: st.sb };
  const b = s.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // top/bottom walls
  if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
  if (b.y > 1 - BALL_R) { b.y = 1 - BALL_R; b.vy = -Math.abs(b.vy); }

  // left paddle (A)
  if (b.x < PADDLE_W + BALL_R && b.vx < 0) {
    if (Math.abs(b.y - s.pa) < PADDLE_H / 2 + BALL_R) {
      b.x = PADDLE_W + BALL_R;
      b.vx = Math.abs(b.vx) * 1.04;                 // slight speed-up per hit
      b.vy += (b.y - s.pa) * 1.6;                   // angle from contact point
    }
  }
  // right paddle (B)
  if (b.x > 1 - PADDLE_W - BALL_R && b.vx > 0) {
    if (Math.abs(b.y - s.pb) < PADDLE_H / 2 + BALL_R) {
      b.x = 1 - PADDLE_W - BALL_R;
      b.vx = -Math.abs(b.vx) * 1.04;
      b.vy += (b.y - s.pb) * 1.6;
    }
  }
  // clamp vertical speed so it stays playable
  b.vy = Math.max(-0.9, Math.min(0.9, b.vy));

  let scored = null;
  if (b.x < -BALL_R) { s.sb++; scored = 'B'; }
  if (b.x > 1 + BALL_R) { s.sa++; scored = 'A'; }
  if (scored) {
    const dir = scored === 'A' ? -1 : 1;            // serve toward the scorer's opponent
    const keep = { sa: s.sa, sb: s.sb, pa: s.pa, pb: s.pb };
    const fresh = initialPhysics(dir);
    s.ball = fresh.ball; s.pa = keep.pa; s.pb = keep.pb; s.sa = keep.sa; s.sb = keep.sb;
  }
  return { state: s, scored };
}

/* ---------------- mount / unmount (shell realtime contract) ---------------- */

let raf = null, sendTimer = null, cleanupFns = [];

export function mount(el, ctx) {
  unmount();
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

  const isHost = ctx.myRole === 'A';
  let st = initialPhysics(1);
  let myPaddle = 0.5;
  let finished = false;

  /* input */
  const setPaddle = y => { myPaddle = Math.max(PADDLE_H / 2, Math.min(1 - PADDLE_H / 2, y)); };
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

  /* network */
  ctx.rt.on(msg => {
    if (finished) return;
    if (isHost) {
      if (msg.k === 'paddleB') st.pb = msg.y;
    } else {
      if (msg.k === 'state') st = msg.st;
      if (msg.k === 'done') finish(msg.w, false);
    }
  });

  if (isHost) {
    sendTimer = setInterval(() => {
      if (!finished) ctx.rt.send({ k: 'state', st });
    }, 50);                                        // 20 packets/sec
  } else {
    sendTimer = setInterval(() => {
      if (!finished) ctx.rt.send({ k: 'paddleB', y: myPaddle });
    }, 50);
  }

  function finish(w, iAmAuthority) {
    if (finished) return;
    finished = true;
    if (isHost) ctx.rt.send({ k: 'done', w });
    if (iAmAuthority) ctx.onFinish(w);             // only the host writes the record
  }

  /* loop */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (isHost) {
      st.pa = myPaddle;
      const r = step(st, dt);
      st = r.state;
      if (st.sa >= WIN_SCORE) finish('A', true);
      else if (st.sb >= WIN_SCORE) finish('B', true);
    } else {
      st.pb = myPaddle;                            // local echo for responsiveness
      st.ball.x += st.ball.vx * dt;                // interpolate between packets
      st.ball.y += st.ball.vy * dt;
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
  if (sendTimer) clearInterval(sendTimer), sendTimer = null;
  cleanupFns.forEach(f => f());
  cleanupFns = [];
}
