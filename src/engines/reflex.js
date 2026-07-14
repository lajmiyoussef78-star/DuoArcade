// engines/reflex.js — Reaction Duel. Wait for the flash, tap first.
// Latency-fair for long distance: each side measures its OWN reaction time
// locally (from when ITS screen flashed to its tap), then the two times are
// compared — network lag never decides a round. Host (A) schedules rounds
// and keeps score. First to 3 round wins takes the match.

export const meta = { id: 'reflex', name: 'Reaction Duel', tag: 'creative \u00b7 reflexes', accent: 'p2', realtime: true };

export const WIN_ROUNDS = 3;

let cleanup = [], timers = [];
let frozen = false;
function on(el, ev, fn) { el.addEventListener(ev, fn); cleanup.push(() => el.removeEventListener(ev, fn)); }
function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }

export function setPaused(v) { frozen = !!v; }

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const me = ctx.myRole, other = me === 'A' ? 'B' : 'A';
  const S = { round: 0, wins: { A: 0, B: 0 }, phase: 'idle', goAt: 0, myMs: null, theirMs: null, done: false };

  el.insertAdjacentHTML('beforeend', `
    <div class="rx-wrap">
      <div class="rx-score"><span class="pA">${ctx.names.A} 0</span> \u2013 <span class="pB">0 ${ctx.names.B}</span></div>
      <button class="rx-zone">waiting\u2026</button>
      <div class="rx-msg">first to ${WIN_ROUNDS} \u2014 tap only when it lights up</div>
    </div>`);
  const zone = el.querySelector('.rx-zone');
  const msg = el.querySelector('.rx-msg');
  const scoreEl = el.querySelector('.rx-score');
  const setScore = () => scoreEl.innerHTML =
    `<span class="pA">${ctx.names.A} ${S.wins.A}</span> \u2013 <span class="pB">${S.wins.B} ${ctx.names.B}</span>`;

  function armRound(n, delayMs) {
    S.round = n; S.phase = 'armed'; S.myMs = null; S.theirMs = null;
    zone.className = 'rx-zone armed';
    zone.textContent = 'wait for it\u2026';
    msg.textContent = `round ${n}`;
    later(() => {
      if (S.phase !== 'armed') return;
      S.phase = 'go';
      S.goAt = performance.now();
      zone.className = 'rx-zone go';
      zone.textContent = 'TAP!';
    }, delayMs);
  }

  on(zone, 'pointerdown', () => {
    if (frozen || S.done) return;
    if (S.phase === 'armed') {
      // jumped the gun: instant round loss
      S.phase = 'result'; S.myMs = 9999;
      zone.className = 'rx-zone early'; zone.textContent = 'too early!';
      ctx.rt.send({ k: 'ms', n: S.round, ms: 9999 });
      maybeResolve();
    } else if (S.phase === 'go') {
      S.phase = 'result';
      S.myMs = Math.round(performance.now() - S.goAt);
      zone.className = 'rx-zone done'; zone.textContent = S.myMs + ' ms';
      ctx.rt.send({ k: 'ms', n: S.round, ms: S.myMs });
      maybeResolve();
    }
  });

  function maybeResolve() {
    if (me !== 'A' || S.myMs === null || S.theirMs === null) return;
    const w = S.myMs === S.theirMs ? (Math.random() < .5 ? 'A' : 'B')
      : (S.myMs < S.theirMs ? 'A' : 'B');
    S.wins[w]++;
    ctx.rt.send({ k: 'round', n: S.round, w, wins: S.wins, aMs: S.myMs, bMs: S.theirMs });
    showRound(w, S.myMs, S.theirMs);
  }

  function showRound(w, aMs, bMs) {
    setScore();
    msg.textContent = `${ctx.names.A}: ${aMs >= 9999 ? 'too early' : aMs + 'ms'} \u00b7 ${ctx.names.B}: ${bMs >= 9999 ? 'too early' : bMs + 'ms'} \u2014 ${ctx.names[w]} takes it`;
    if (S.wins.A >= WIN_ROUNDS || S.wins.B >= WIN_ROUNDS) {
      S.done = true;
      zone.className = 'rx-zone'; zone.textContent = 'match over';
      if (me === 'A') later(() => ctx.onFinish(S.wins.A >= WIN_ROUNDS ? 'A' : 'B'), 1000);
      return;
    }
    if (me === 'A') {
      const delay = 1500 + Math.random() * 2500;
      later(() => {
        ctx.rt.send({ k: 'arm', n: S.round + 1, delay });
        armRound(S.round + 1, delay);
      }, 2200);
    }
  }

  ctx.rt.on(m => {
    if (m.k === 'arm') armRound(m.n, m.delay);
    if (m.k === 'ms' && m.n === S.round) { S.theirMs = m.ms; maybeResolve(); }
    if (m.k === 'round') { S.wins = m.wins; S.phase = 'idle'; showRound(m.w, m.aMs, m.bMs); }
  });

  // host kicks off round 1
  if (me === 'A') {
    const delay = 1500 + Math.random() * 2500;
    later(() => { ctx.rt.send({ k: 'arm', n: 1, delay }); armRound(1, delay); }, 900);
  }
  setScore();
}

export function unmount() {
  frozen = false;
  timers.forEach(t => clearTimeout(t));
  timers = [];
  cleanup.forEach(f => f());
  cleanup = [];
}
