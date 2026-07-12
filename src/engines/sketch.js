// engines/sketch.js — Sketch & Guess. 6 rounds, alternating drawer.
// You score by GUESSING correctly (3 guessing rounds each; most wins).
// The drawer's client is authoritative for its own round; side A keeps score
// and reports the final result.

export const meta = { id: 'sketch', name: 'Sketch & Guess', tag: 'creative \u00b7 6 rounds', accent: 'p2', realtime: true };

const WORDS = ['pizza','cat','rainbow','bicycle','ghost','cactus','robot','moon','castle','snail',
  'guitar','volcano','penguin','rocket','octopus','crown','ladder','tornado','mermaid','pancake',
  'spider','lighthouse','dragon','snowman','banana','umbrella','wizard','shark','campfire','butterfly',
  'submarine','dinosaur','cloud','scissors','trophy','anchor','balloon','fountain','telescope','pyramid'];

const ROUNDS = 6, ROUND_MS = 60000;

let cleanup = [];
function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); cleanup.push(() => el.removeEventListener(ev, fn, opt)); }
let timers = [];
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function every(fn, ms) { const t = setInterval(fn, ms); timers.push(t); return t; }

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const me = ctx.myRole, other = me === 'A' ? 'B' : 'A';
  const S = { round: 0, score: { A: 0, B: 0 }, word: null, endsAt: 0, phase: 'wait' };

  el.insertAdjacentHTML('beforeend', `
    <div class="sk-top">
      <div class="sk-score"><span class="pA">${ctx.names.A} 0</span> \u2013 <span class="pB">0 ${ctx.names.B}</span></div>
      <div class="sk-round"></div><div class="sk-timer"></div>
    </div>
    <div class="sk-word"></div>
    <canvas class="sk-canvas" width="700" height="440"></canvas>
    <div class="sk-tools">
      <button class="btn small ghost sk-clear">Clear</button>
      <div class="sk-guessbar"><input type="text" class="sk-guess" placeholder="your guess\u2026" maxlength="24">
      <button class="btn small warm sk-send">Guess</button></div>
    </div>
    <div class="sk-feed"></div>`);
  const q = sel => el.querySelector(sel);
  const cv = q('.sk-canvas'), g = cv.getContext('2d');
  g.lineWidth = 4; g.lineCap = 'round'; g.strokeStyle = '#F2EDF7';
  g.fillStyle = '#14101B'; g.fillRect(0, 0, cv.width, cv.height);

  const drawerOf = r => (r % 2 === 1 ? 'A' : 'B');
  const feed = msg => { const d = document.createElement('div'); d.textContent = msg; q('.sk-feed').prepend(d); };
  const setScore = () => q('.sk-score').innerHTML =
    `<span class="pA">${ctx.names.A} ${S.score.A}</span> \u2013 <span class="pB">${S.score.B} ${ctx.names.B}</span>`;
  const clearCv = () => { g.fillStyle = '#14101B'; g.fillRect(0, 0, cv.width, cv.height); };

  /* drawing (drawer only) */
  let drawing = false, buf = [];
  const pos = e => {
    const r = cv.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - r.left) / r.width * cv.width, y: (p.clientY - r.top) / r.height * cv.height };
  };
  const seg = pts => {
    g.beginPath();
    pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
    g.stroke();
  };
  on(cv, 'pointerdown', e => { if (drawerOf(S.round) !== me || S.phase !== 'draw') return; drawing = true; buf = [pos(e)]; });
  on(cv, 'pointermove', e => { if (!drawing) return; buf.push(pos(e)); if (buf.length > 1) seg(buf.slice(-2)); });
  const stop = () => {
    if (!drawing) return;
    drawing = false;
    if (buf.length > 1) ctx.rt.send({ k: 'seg', pts: buf });
    buf = [];
  };
  on(cv, 'pointerup', stop); on(cv, 'pointerleave', stop);
  every(() => { if (drawing && buf.length > 1) { ctx.rt.send({ k: 'seg', pts: buf }); buf = [buf[buf.length - 1]]; } }, 250);
  on(q('.sk-clear'), 'click', () => { if (drawerOf(S.round) === me) { clearCv(); ctx.rt.send({ k: 'clear' }); } });

  /* guessing */
  const sendGuess = () => {
    const v = q('.sk-guess').value.trim();
    if (!v || drawerOf(S.round) === me || S.phase !== 'draw') return;
    q('.sk-guess').value = '';
    ctx.rt.send({ k: 'guess', v });
    feed(`you: ${v}`);
  };
  on(q('.sk-send'), 'click', sendGuess);
  on(q('.sk-guess'), 'keydown', e => { if (e.key === 'Enter') sendGuess(); });

  /* rounds — the round's DRAWER is its authority */
  function startRoundAsDrawer() {
    S.word = WORDS[Math.floor(Math.random() * WORDS.length)];
    S.endsAt = Date.now() + ROUND_MS;
    S.phase = 'draw';
    clearCv();
    ctx.rt.send({ k: 'round', n: S.round, endsAt: S.endsAt });
    render();
  }
  function endRound(correct, ms) {
    if (S.phase !== 'draw') return;
    S.phase = 'wait';
    const guesser = drawerOf(S.round) === 'A' ? 'B' : 'A';
    if (correct) S.score[guesser]++;
    ctx.rt.send({ k: 'roundEnd', n: S.round, correct, word: S.word, score: S.score });
    afterRound(correct, S.word);
  }
  function afterRound(correct, word) {
    setScore();
    feed(correct ? `\u2713 guessed it \u2014 "${word}"` : `\u23f0 time \u2014 it was "${word}"`);
    if (S.round >= ROUNDS) {
      if (me === 'A') {
        const w = S.score.A > S.score.B ? 'A' : S.score.B > S.score.A ? 'B' : 'draw';
        later(() => ctx.onFinish(w === 'draw' ? (Math.random() < 0.5 ? 'A' : 'B') : w), 1200);
        // (records have no draw slot for realtime; coin-flip a tie-breaker and say so)
        if (S.score.A === S.score.B) feed('tied \u2014 coin flip decides the record!');
      }
      q('.sk-word').textContent = 'match over';
      return;
    }
    later(() => { S.round++; if (drawerOf(S.round) === me) startRoundAsDrawer(); render(); }, 2500);
  }

  ctx.rt.on(m => {
    if (m.k === 'seg') seg(m.pts);
    if (m.k === 'clear') clearCv();
    if (m.k === 'round') { S.round = m.n; S.endsAt = m.endsAt; S.phase = 'draw'; clearCv(); render(); }
    if (m.k === 'guess') {
      feed(`${ctx.names[other]}: ${m.v}`);
      if (drawerOf(S.round) === me && S.phase === 'draw'
          && m.v.trim().toLowerCase() === S.word) endRound(true);
    }
    if (m.k === 'roundEnd') { S.score = m.score; S.phase = 'wait'; afterRound(m.correct, m.word); }
  });

  every(() => {
    if (S.phase === 'draw') {
      const left = Math.max(0, Math.ceil((S.endsAt - Date.now()) / 1000));
      q('.sk-timer').textContent = left + 's';
      if (left === 0 && drawerOf(S.round) === me) endRound(false);
    } else q('.sk-timer').textContent = '';
  }, 300);

  function render() {
    const iDraw = drawerOf(S.round) === me;
    q('.sk-round').textContent = S.round ? `round ${S.round}/${ROUNDS}` : '';
    q('.sk-word').textContent = S.phase !== 'draw' ? ''
      : iDraw ? `draw: ${S.word ?? '\u2026'}` : `${ctx.names[other]} is drawing \u2014 guess!`;
    q('.sk-guessbar').style.display = iDraw ? 'none' : 'flex';
    q('.sk-clear').style.display = iDraw ? 'inline-block' : 'none';
  }

  // kick off: round 1's drawer is A
  S.round = 1;
  if (drawerOf(1) === me) later(startRoundAsDrawer, 600); else render();
  setScore();
}

export function unmount() {
  timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  timers = [];
  cleanup.forEach(f => f());
  cleanup = [];
}
