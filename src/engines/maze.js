// engines/maze.js — Maze Race. The host generates a maze (recursive
// backtracker), both race from corner to corner, and you see your
// partner's ghost moving live. First out wins.
// Pure generator exported for tests.

export const meta = { id: 'maze', name: 'Maze Race', tag: 'creative \u00b7 race', accent: 'candle', realtime: true };

export const N = 13;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// walls[r][c] = {n,e,s,w} booleans (true = wall present)
export function generate(seed) {
  const rnd = mulberry32(seed);
  const walls = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => ({ n: true, e: true, s: true, w: true })));
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;
  const DIRS = [['n', -1, 0, 's'], ['s', 1, 0, 'n'], ['e', 0, 1, 'w'], ['w', 0, -1, 'e']];
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = DIRS
      .map(([d, dr, dc, opp]) => [d, r + dr, c + dc, opp])
      .filter(([, rr, cc]) => rr >= 0 && rr < N && cc >= 0 && cc < N && !seen[rr][cc]);
    if (!options.length) { stack.pop(); continue; }
    const [d, rr, cc, opp] = options[Math.floor(rnd() * options.length)];
    walls[r][c][d] = false;
    walls[rr][cc][opp] = false;
    seen[rr][cc] = true;
    stack.push([rr, cc]);
  }
  return walls;
}

export function canMove(walls, r, c, dir) {
  return !walls[r][c][dir];
}

let cleanup = [], timers = [], raf = null;
function on(el, ev, fn) { el.addEventListener(ev, fn); cleanup.push(() => el.removeEventListener(ev, fn)); }

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const me = ctx.myRole;
  let walls = null, mePos = { r: 0, c: 0 }, them = { r: 0, c: 0 }, done = false;

  el.insertAdjacentHTML('beforeend', `
    <div class="mz-wrap">
      <canvas class="mz-canvas" width="520" height="520"></canvas>
      <div class="mz-pad">
        <button class="btn small mz-b" data-d="n">\u2191</button>
        <div><button class="btn small mz-b" data-d="w">\u2190</button>
        <button class="btn small mz-b" data-d="s">\u2193</button>
        <button class="btn small mz-b" data-d="e">\u2192</button></div>
      </div>
      <div class="dots-score mz-note">race to the bottom-right corner \u2014 arrows or buttons</div>
    </div>`);
  const cv = el.querySelector('.mz-canvas'), g = cv.getContext('2d');
  const cell = cv.width / N;

  function tryMove(dir) {
    if (done || !walls) return;
    if (!canMove(walls, mePos.r, mePos.c, dir)) return;
    if (dir === 'n') mePos.r--; if (dir === 's') mePos.r++;
    if (dir === 'w') mePos.c--; if (dir === 'e') mePos.c++;
    ctx.rt.send({ k: 'pos', r: mePos.r, c: mePos.c });
    if (mePos.r === N - 1 && mePos.c === N - 1) {
      done = true;
      ctx.rt.send({ k: 'win', by: me });
      if (me === 'A') ctx.onFinish('A');
    }
  }
  on(window, 'keydown', e => {
    const map = { ArrowUp: 'n', ArrowDown: 's', ArrowLeft: 'w', ArrowRight: 'e' };
    if (map[e.key]) { e.preventDefault(); tryMove(map[e.key]); }
  });
  el.querySelectorAll('.mz-b').forEach(b => on(b, 'click', () => tryMove(b.dataset.d)));

  ctx.rt.on(m => {
    if (m.k === 'maze') { walls = m.walls; }
    if (m.k === 'pos') { them = { r: m.r, c: m.c }; }
    if (m.k === 'needmaze' && me === 'A' && walls) ctx.rt.send({ k: 'maze', walls });
    if (m.k === 'win' && !done) {
      done = true;
      if (me === 'A') ctx.onFinish(m.by);
    }
  });

  if (me === 'A') {
    walls = generate((Date.now() & 0xffff) ^ 0xA11CE);
    ctx.rt.send({ k: 'maze', walls });
    timers.push(setTimeout(() => ctx.rt.send({ k: 'maze', walls }), 1500));
  } else {
    timers.push(setTimeout(() => { if (!walls) ctx.rt.send({ k: 'needmaze' }); }, 1200));
  }

  const css = getComputedStyle(document.documentElement);
  const P1 = () => css.getPropertyValue('--p1').trim() || '#7FA8FF';
  const P2 = () => css.getPropertyValue('--p2').trim() || '#FF7FA8';
  const CAN = () => css.getPropertyValue('--candle').trim() || '#FFC66E';

  function draw() {
    g.fillStyle = '#14101B'; g.fillRect(0, 0, cv.width, cv.height);
    if (walls) {
      // exit
      g.fillStyle = 'rgba(255,198,110,.25)';
      g.fillRect((N - 1) * cell, (N - 1) * cell, cell, cell);
      g.strokeStyle = '#5A4E75'; g.lineWidth = 2; g.beginPath();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const x = c * cell, y = r * cell, w = walls[r][c];
        if (w.n) { g.moveTo(x, y); g.lineTo(x + cell, y); }
        if (w.w) { g.moveTo(x, y); g.lineTo(x, y + cell); }
        if (r === N - 1 && w.s) { g.moveTo(x, y + cell); g.lineTo(x + cell, y + cell); }
        if (c === N - 1 && w.e) { g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); }
      }
      g.stroke();
      // partner ghost
      g.globalAlpha = 0.45;
      g.fillStyle = me === 'A' ? P2() : P1();
      g.beginPath(); g.arc((them.c + .5) * cell, (them.r + .5) * cell, cell * .28, 0, 7); g.fill();
      g.globalAlpha = 1;
      // me
      g.fillStyle = me === 'A' ? P1() : P2();
      g.beginPath(); g.arc((mePos.c + .5) * cell, (mePos.r + .5) * cell, cell * .3, 0, 7); g.fill();
    } else {
      g.fillStyle = CAN(); g.font = '20px Arial'; g.textAlign = 'center';
      g.fillText('generating maze\u2026', cv.width / 2, cv.height / 2);
    }
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
}

export function unmount() {
  if (raf) cancelAnimationFrame(raf), raf = null;
  timers.forEach(t => clearTimeout(t));
  timers = [];
  cleanup.forEach(f => f());
  cleanup = [];
}
