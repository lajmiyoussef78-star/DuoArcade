// engines/wordrace.js — Word Race. Same secret word, two boards, six
// guesses each. First to solve wins; same attempt count = draw.
// During play you see your partner's COLORS only; after both finish,
// every guessed word is revealed on both boards.

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
  let answer = null, row = 0, done = false;
  let myDone = null;      // { rows } | 'failed'
  let theirDone = null;   // { rows } | 'failed'
  let finished = false;
  const myGuesses = [];   // [{ word, colors }]
  const theirGuesses = [];

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
      if (!cell) continue;
      cell.textContent = letters ? letters[c].toUpperCase() : '';
      cell.className = 'wr-cell ' + ({ g: 'green', y: 'yellow', '.': 'gray' }[colors?.[c]] || '');
    }
  };

  function revealAll() {
    myGuesses.forEach((g, i) => paint('.wr-board.mine', i, g.word, g.colors));
    theirGuesses.forEach((g, i) => paint('.wr-board.theirs', i, g.word, g.colors));
    q('.wr-wrap').classList.add('wr-revealed');
  }

  function endMessage() {
    if (!myDone || !theirDone) return;
    const mine = myDone === 'failed' ? 99 : myDone.rows;
    const theirs = theirDone === 'failed' ? 99 : theirDone.rows;
    const ans = answer ? ` · word was "${answer}"` : '';
    if (mine === 99 && theirs === 99) {
      q('.wr-msg').textContent = `neither got it${ans}`;
    } else if (mine === theirs) {
      q('.wr-msg').textContent = `tie — both in ${mine} ${mine === 1 ? 'try' : 'tries'}${ans}`;
    } else if (mine < theirs) {
      q('.wr-msg').textContent = `you win in ${mine}${ans}`;
    } else {
      q('.wr-msg').textContent = `${ctx.names[other]} wins in ${theirs}${ans}`;
    }
  }

  function checkEnd() {
    if (finished || myDone === null || theirDone === null) return;
    finished = true;
    revealAll();
    endMessage();
    q('.wr-input').disabled = true;
    q('.wr-go').disabled = true;
    if (me !== 'A') return;
    const mine = myDone === 'failed' ? 99 : myDone.rows;
    const theirs = theirDone === 'failed' ? 99 : theirDone.rows;
    later(() => {
      if (mine === theirs) ctx.onFinish('draw');
      else ctx.onFinish(mine < theirs ? 'A' : 'B');
    }, 900);
  }

  function submit() {
    if (done || !answer || finished) return;
    const v = q('.wr-input').value.trim().toLowerCase();
    if (!/^[a-z]{5}$/.test(v)) { q('.wr-msg').textContent = 'five letters, please'; return; }
    q('.wr-msg').textContent = '';
    q('.wr-input').value = '';
    const colors = scoreGuess(v, answer);
    paint('.wr-board.mine', row, v, colors);
    myGuesses.push({ word: v, colors });
    row++;
    // send colors + word (word stays hidden on partner's screen until both finish)
    ctx.rt.send({ k: 'row', n: row, colors, word: v });
    if (colors === 'ggggg') {
      done = true;
      myDone = { rows: row };
      ctx.rt.send({ k: 'solved', rows: row });
      q('.wr-msg').textContent = 'solved! waiting for partner…';
      checkEnd();
    } else if (row >= 6) {
      done = true;
      myDone = 'failed';
      ctx.rt.send({ k: 'failed' });
      q('.wr-msg').textContent = `out of guesses — waiting for partner…`;
      checkEnd();
    }
  }
  on(q('.wr-go'), 'click', submit);
  on(q('.wr-input'), 'keydown', e => { if (e.key === 'Enter') submit(); });

  ctx.rt.on(m => {
    if (m.k === 'word') { answer = m.w; }
    if (m.k === 'row') {
      // colors only while playing; store the word for the end reveal
      paint('.wr-board.theirs', m.n - 1, null, m.colors);
      theirGuesses[m.n - 1] = { word: m.word || '', colors: m.colors };
    }
    if (m.k === 'solved') {
      theirDone = { rows: m.rows };
      checkEnd();
    }
    if (m.k === 'failed') {
      theirDone = 'failed';
      checkEnd();
    }
    if (m.k === 'needword' && me === 'A' && answer) ctx.rt.send({ k: 'word', w: answer });
  });

  if (me === 'A') {
    answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
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
