// engines/wordrace.js — Word Race. Same secret word, two boards, six
// guesses each. First to solve wins; you see your partner's COLORS only.
// Host (A) picks the word. Pure scoring function exported for tests.

export const meta = { id: 'wordrace', name: 'Word Race', tag: 'creative \u00b7 5 letters', accent: 'p1', realtime: true };

const ANSWERS = ['apple','beach','candy','dance','eagle','flame','ghost','heart','image','juice',
 'koala','lemon','music','night','ocean','piano','queen','river','smile','tiger','uncle','video',
 'water','young','zebra','bread','cloud','dream','earth','fruit','grape','house','light','money',
 'plant','quiet','round','stone','train','world','brave','charm','sweet','magic','pearl','storm'];

// classic two-pass Wordle scoring: 'g' green, 'y' yellow, '.' gray
export function scoreGuess(guess, answer) {
  const g = guess.toLowerCase().split(''), a = answer.toLowerCase().split('');
  const res = Array(5).fill('.');
  const remaining = {};
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) res[i] = 'g';
    else remaining[a[i]] = (remaining[a[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === '.' && remaining[g[i]] > 0) { res[i] = 'y'; remaining[g[i]]--; }
  }
  return res.join('');
}

let cleanup = [], timers = [];
function on(el, ev, fn) { el.addEventListener(ev, fn); cleanup.push(() => el.removeEventListener(ev, fn)); }
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const me = ctx.myRole, other = me === 'A' ? 'B' : 'A';
  let answer = null, row = 0, done = false, theirRows = 0, theirDone = null;

  el.insertAdjacentHTML('beforeend', `
    <div class="wr-wrap">
      <div class="wr-side">
        <div class="wr-label">you</div>
        <div class="wr-board mine"></div>
        <input type="text" class="wr-input" maxlength="5" placeholder="5 letters" autocomplete="off">
        <button class="btn small warm wr-go">Guess</button>
        <div class="wr-msg"></div>
      </div>
      <div class="wr-side">
        <div class="wr-label">${ctx.names[other]}</div>
        <div class="wr-board theirs"></div>
      </div>
    </div>`);
  const q = s => el.querySelector(s);

  function buildBoard(sel) {
    const b = q(sel);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
      const d = document.createElement('div');
      d.className = 'wr-cell';
      d.dataset.rc = r + '-' + c;
      b.appendChild(d);
    }
  }
  buildBoard('.wr-board.mine'); buildBoard('.wr-board.theirs');

  const paint = (sel, r, letters, colors) => {
    for (let c = 0; c < 5; c++) {
      const cell = q(sel).querySelector(`[data-rc="${r}-${c}"]`);
      cell.textContent = letters ? letters[c].toUpperCase() : '';
      cell.className = 'wr-cell ' + ({ g: 'green', y: 'yellow', '.': 'gray' }[colors[c]] || '');
    }
  };

  function submit() {
    if (done || !answer) return;
    const v = q('.wr-input').value.trim().toLowerCase();
    if (!/^[a-z]{5}$/.test(v)) { q('.wr-msg').textContent = 'five letters, please'; return; }
    q('.wr-msg').textContent = '';
    q('.wr-input').value = '';
    const colors = scoreGuess(v, answer);
    paint('.wr-board.mine', row, v, colors);
    row++;
    ctx.rt.send({ k: 'row', n: row, colors });
    if (colors === 'ggggg') {
      done = true;
      ctx.rt.send({ k: 'solved', rows: row });
      q('.wr-msg').textContent = 'solved!';
      if (me === 'A') settle(me, row, theirDone);
    } else if (row >= 6) {
      done = true;
      ctx.rt.send({ k: 'failed' });
      q('.wr-msg').textContent = `out of guesses \u2014 it was "${answer}"`;
      if (me === 'A') settle(null, 99, theirDone);
    }
  }
  on(q('.wr-go'), 'click', submit);
  on(q('.wr-input'), 'keydown', e => { if (e.key === 'Enter') submit(); });

  // A is scorekeeper: decide once both outcomes are known
  let myOutcome = null; // {solvedRows} | 'failed'
  function settle(solvedBy, myRows, their) {
    myOutcome = solvedBy ? { rows: myRows } : 'failed';
    decide();
  }
  function decide() {
    if (me !== 'A' || myOutcome === null || theirDone === null) return;
    const mine = myOutcome === 'failed' ? 99 : myOutcome.rows;
    const theirs = theirDone === 'failed' ? 99 : theirDone.rows;
    if (mine === 99 && theirs === 99) { later(() => ctx.onFinish(Math.random() < 0.5 ? 'A' : 'B'), 800); return; }
    later(() => ctx.onFinish(mine <= theirs ? 'A' : 'B'), 800);
  }

  ctx.rt.on(m => {
    if (m.k === 'word') { answer = m.w; }
    if (m.k === 'row') { paint('.wr-board.theirs', m.n - 1, null, m.colors); theirRows = m.n; }
    if (m.k === 'solved') { theirDone = { rows: m.rows }; q('.wr-label:last-child'); decide(); }
    if (m.k === 'failed') { theirDone = 'failed'; decide(); }
    if (m.k === 'needword' && me === 'A' && answer) ctx.rt.send({ k: 'word', w: answer });
  });

  if (me === 'A') {
    answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    // send now and again shortly after, in case B mounts late
    ctx.rt.send({ k: 'word', w: answer });
    later(() => ctx.rt.send({ k: 'word', w: answer }), 1500);
  } else {
    later(() => { if (!answer) ctx.rt.send({ k: 'needword' }); }, 1200);
  }
}

export function unmount() {
  timers.forEach(t => clearTimeout(t));
  timers = [];
  cleanup.forEach(f => f());
  cleanup = [];
}
