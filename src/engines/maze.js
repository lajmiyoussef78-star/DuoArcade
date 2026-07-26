// engines/maze.js — Maze Race. The host generates a maze once from a
// stable match seed (code + startedAt), both race corner to corner, and
// you see your partner's ghost live. First out wins.
// The maze NEVER changes mid-game (same lock pattern as Word Race).

export const meta = { id: 'maze', name: 'Maze Race', tag: 'creative \u00b7 race', accent: 'candle', realtime: true };

/** Odd size keeps a true cell grid; larger = longer, twistier race. */
export const N = 25;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed for a match — remounts keep the same maze. */
export function seedForMatch(code, startedAt) {
  const s = String(code || '') + ':maze:' + String(startedAt || 0);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const DIRS = [['n', -1, 0, 's'], ['s', 1, 0, 'n'], ['e', 0, 1, 'w'], ['w', 0, -1, 'e']];

// walls[r][c] = {n,e,s,w} booleans (true = wall present)
// Twist-biased recursive backtracker: prefers turns over long corridors.
export function generate(seed) {
  const rnd = mulberry32(seed);
  const walls = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => ({ n: true, e: true, s: true, w: true })));
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const stack = [[0, 0, null]];
  seen[0][0] = true;

  while (stack.length) {
    const [r, c, cameFrom] = stack[stack.length - 1];
    const options = DIRS
      .map(([d, dr, dc, opp]) => [d, r + dr, c + dc, opp])
      .filter(([, rr, cc]) => rr >= 0 && rr < N && cc >= 0 && cc < N && !seen[rr][cc]);
    if (!options.length) { stack.pop(); continue; }

    // Weight: turns >> straight (low river factor = twisty, many dead ends).
    const weighted = [];
    for (const opt of options) {
      const d = opt[0];
      const w = cameFrom && d === cameFrom ? 1 : 6;
      for (let i = 0; i < w; i++) weighted.push(opt);
    }
    const [d, rr, cc, opp] = weighted[Math.floor(rnd() * weighted.length)];
    walls[r][c][d] = false;
    walls[rr][cc][opp] = false;
    seen[rr][cc] = true;
    stack.push([rr, cc, d]);
  }

  return walls;
}

export function canMove(walls, r, c, dir) {
  return !walls[r][c][dir];
}

function validWalls(w) {
  return Array.isArray(w) && w.length === N && Array.isArray(w[0]) && w[0].length === N
    && w[0][0] && typeof w[0][0].n === 'boolean';
}

function cloneWalls(w) {
  try { return structuredClone(w); } catch { return JSON.parse(JSON.stringify(w)); }
}

let cleanup = [], timers = [], raf = null;
function on(el, ev, fn) { el.addEventListener(ev, fn); cleanup.push(() => el.removeEventListener(ev, fn)); }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

function sendRetry(rt, payload) {
  rt?.send(payload);
  later(() => rt?.send(payload), 120);
  later(() => rt?.send(payload), 320);
}

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const me = ctx.myRole;
  const isHost = me === 'A';
  let walls = null;
  let wallsLocked = false;
  let mePos = { r: 0, c: 0 }, them = { r: 0, c: 0 }, done = false;

  el.insertAdjacentHTML('beforeend', `
    <div class="mz-wrap">
      <canvas class="mz-canvas" width="600" height="600"></canvas>
      <div class="mz-pad">
        <button class="btn small mz-b" data-d="n">\u2191</button>
        <div><button class="btn small mz-b" data-d="w">\u2190</button>
        <button class="btn small mz-b" data-d="s">\u2193</button>
        <button class="btn small mz-b" data-d="e">\u2192</button></div>
      </div>
      <div class="dots-score mz-note">race to the bottom-right corner \u2014 QZSD, arrows, or buttons</div>
    </div>`);
  const cv = el.querySelector('.mz-canvas'), g = cv.getContext('2d');
  const cell = cv.width / N;
  const note = el.querySelector('.mz-note');

  function lockWalls(w) {
    if (wallsLocked) return false;
    if (!validWalls(w)) return false;
    walls = cloneWalls(w);
    wallsLocked = true;
    if (note && note.dataset.syncing) {
      note.textContent = 'race to the bottom-right corner \u2014 QZSD, arrows, or buttons';
      delete note.dataset.syncing;
    }
    return true;
  }

  function tryMove(dir) {
    if (done || !wallsLocked || !walls) return;
    if (!canMove(walls, mePos.r, mePos.c, dir)) return;
    if (dir === 'n') mePos.r--; if (dir === 's') mePos.r++;
    if (dir === 'w') mePos.c--; if (dir === 'e') mePos.c++;
    ctx.rt.send({ k: 'pos', r: mePos.r, c: mePos.c });
    if (mePos.r === N - 1 && mePos.c === N - 1) {
      done = true;
      sendRetry(ctx.rt, { k: 'win', by: me });
      if (isHost) ctx.onFinish('A');
    }
  }
  on(window, 'keydown', e => {
    // Arrows + QZSD (AZERTY) / WASD
    const map = {
      ArrowUp: 'n', ArrowDown: 's', ArrowLeft: 'w', ArrowRight: 'e',
      z: 'n', Z: 'n', w: 'n', W: 'n',
      s: 's', S: 's',
      q: 'w', Q: 'w', a: 'w', A: 'w',
      d: 'e', D: 'e',
    };
    if (map[e.key]) { e.preventDefault(); tryMove(map[e.key]); }
  });
  el.querySelectorAll('.mz-b').forEach(b => on(b, 'click', () => tryMove(b.dataset.d)));

  ctx.rt.on(m => {
    if (!m?.k) return;
    if (m.k === 'maze') {
      // Lock once — never swap the maze after play has started.
      lockWalls(m.walls);
      return;
    }
    if (m.k === 'pos') {
      them = { r: m.r|0, c: m.c|0 };
      return;
    }
    if (m.k === 'needmaze' && isHost && wallsLocked) {
      sendRetry(ctx.rt, { k: 'maze', walls });
      return;
    }
    if (m.k === 'win' && !done) {
      done = true;
      if (isHost) ctx.onFinish(m.by);
    }
  });

  if (isHost) {
    // Host picks once from match seed (stable across remounts) and never changes it.
    lockWalls(generate(seedForMatch(ctx.code, ctx.startedAt || 0)));
    const pushMaze = () => {
      if (wallsLocked && !done) sendRetry(ctx.rt, { k: 'maze', walls });
    };
    pushMaze();
    later(pushMaze, 600);
    later(pushMaze, 1600);
    later(pushMaze, 3000);
  } else {
    note.textContent = 'syncing the maze\u2026';
    note.dataset.syncing = '1';
    const ask = () => {
      if (!wallsLocked && !done) ctx.rt.send({ k: 'needmaze' });
    };
    ask();
    later(ask, 700);
    later(ask, 1500);
    later(ask, 2800);
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
      g.strokeStyle = '#6E628A'; g.lineWidth = 1.75; g.beginPath();
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
      g.fillText('syncing the maze\u2026', cv.width / 2, cv.height / 2);
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
