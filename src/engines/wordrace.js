// engines/wordrace.js — Word Race. Same secret word, two boards, six
// guesses each. First to solve wins; same attempt count = draw.
// During play you see your partner's COLORS only; after both finish,
// every guessed word is revealed on both boards.
//
// Host A picks the word once and locks it. Guest waits for that word
// before guessing. The answer NEVER changes mid-game (that was the
// yellow-then-grey bug).

export const meta = { id: 'wordrace', name: 'Word Race', tag: 'creative \u00b7 5 letters', accent: 'p1', realtime: true };

const ANSWERS = ['apple','beach','candy','dance','eagle','flame','ghost','heart','image','juice',
 'koala','lemon','music','night','ocean','piano','queen','river','smile','tiger','uncle','video',
 'water','young','zebra','bread','cloud','dream','earth','fruit','grape','house','light','money',
 'plant','quiet','round','stone','train','world','brave','charm','sweet','magic','pearl','storm'];

/** Stable pick for a match seed (host uses this so remounts keep the same word). */
export function answerForMatch(code, startedAt) {
  const s = String(code || '') + ':' + String(startedAt || 0);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ANSWERS[(h >>> 0) % ANSWERS.length];
}

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

function sendRetry(rt, payload) {
  rt?.send(payload);
  later(() => rt?.send(payload), 120);
  later(() => rt?.send(payload), 320);
}

export function mount(el, ctx) {
  unmount();
  el.innerHTML = '';
  const me = ctx.myRole, other = me === 'A' ? 'B' : 'A';
  const isHost = me === 'A';

  let answer = null;
  let answerLocked = false;
  let row = 0, done = false;
  let myDone = null;
  let theirDone = null;
  let finished = false;
  let reported = false;
  let proceeded = false;
  const myGuesses = [];
  const theirGuesses = [];

  const partnerName = ctx.names[other] || 'partner';
  const lineWord = n => (['1st', '2nd', '3rd', '4th', '5th', '6th'][n - 1] || `${n}th`);

  el.insertAdjacentHTML('beforeend', `
    <div class="wr-root">
      <div class="wr-wrap">
        <div class="wr-side">
          <div class="wr-label">you</div>
          <div class="wr-board mine"></div>
          <input type="text" class="wr-input" maxlength="5" placeholder="5 letters" autocomplete="off">
          <button class="btn small warm wr-go">Guess</button>
          <div class="wr-msg"></div>
        </div>
        <div class="wr-side">
          <div class="wr-label">${partnerName}</div>
          <div class="wr-board theirs"></div>
        </div>
      </div>
      <div class="wr-wait" hidden></div>
    </div>`);
  const q = s => el.querySelector(s);

  function setInputEnabled(on) {
    q('.wr-input').disabled = !on;
    q('.wr-go').disabled = !on;
  }

  function lockAnswer(w) {
    if (answerLocked) return false;
    if (typeof w !== 'string' || !/^[a-z]{5}$/.test(w)) return false;
    answer = w;
    answerLocked = true;
    setInputEnabled(true);
    if (q('.wr-msg').textContent === 'syncing the word…') q('.wr-msg').textContent = '';
    return true;
  }

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
    theirGuesses.forEach((g, i) => {
      if (g) paint('.wr-board.theirs', i, g.word, g.colors);
    });
    q('.wr-root')?.classList.add('wr-revealed');
    q('.wr-wrap')?.classList.add('wr-revealed');
  }

  function showWait(html) {
    const wait = q('.wr-wait');
    if (!wait) return;
    wait.hidden = false;
    wait.innerHTML = html;
  }

  function matchWinner() {
    const mine = myDone === 'failed' ? 99 : myDone.rows;
    const theirs = theirDone === 'failed' ? 99 : theirDone.rows;
    if (mine === theirs) return 'draw';
    return mine < theirs ? 'A' : 'B';
  }

  function reportFinish() {
    if (!isHost || reported || myDone == null || theirDone == null) return;
    reported = true;
    ctx.onFinish?.(matchWinner());
  }

  function endRound() {
    if (!finished || proceeded) return;
    proceeded = true;
    if (isHost) reportFinish();
    else sendRetry(ctx.rt, { k: 'endround' });
    ctx.onProceed?.();
    const btn = q('.wr-end');
    if (btn) btn.disabled = true;
  }

  function endMessage() {
    if (!myDone || !theirDone) return;
    const mine = myDone === 'failed' ? 99 : myDone.rows;
    const theirs = theirDone === 'failed' ? 99 : theirDone.rows;
    const ans = answer
      ? `<div class="wr-wait-word">The word was “${answer}”</div>`
      : '';
    let title = '';
    if (mine === 99 && theirs === 99) title = 'Neither got it';
    else if (mine === theirs) title = `Tie — both on the ${lineWord(mine)} line`;
    else if (mine < theirs) title = `You win on the ${lineWord(mine)} line`;
    else title = `${partnerName} wins on the ${lineWord(theirs)} line`;
    showWait(
      `<div class="wr-wait-title">${title}</div>`
      + ans
      + `<button type="button" class="btn warm wr-end">End round</button>`
    );
    const btn = q('.wr-end');
    if (btn) on(btn, 'click', endRound);
  }

  function hideGuessUi() {
    setInputEnabled(false);
    const input = q('.wr-input');
    const go = q('.wr-go');
    const msg = q('.wr-msg');
    if (input) input.style.display = 'none';
    if (go) go.style.display = 'none';
    if (msg) { msg.textContent = ''; msg.style.display = 'none'; }
  }

  function showSolvedWait(rows) {
    hideGuessUi();
    showWait(
      `<div class="wr-wait-title">Word guessed on the ${lineWord(rows)} line!</div>`
      + `<div class="wr-wait-sub">Waiting for ${partnerName}.</div>`
    );
  }

  function showFailedWait() {
    hideGuessUi();
    showWait(
      `<div class="wr-wait-title">Out of guesses</div>`
      + `<div class="wr-wait-sub">Waiting for ${partnerName}.</div>`
    );
  }

  function freezeBoard() {
    hideGuessUi();
    // Freeze boards only — keep the End round button clickable underneath.
    q('.wr-wrap')?.classList.add('wr-frozen', 'wr-revealed');
    q('.wr-root')?.classList.add('wr-revealed');
  }

  function checkEnd() {
    if (finished || myDone === null || theirDone === null) return;
    finished = true;
    revealAll();
    freezeBoard();
    endMessage();
  }

  function submit() {
    if (done || !answerLocked || !answer || finished) return;
    const v = q('.wr-input').value.trim().toLowerCase();
    if (!/^[a-z]{5}$/.test(v)) { q('.wr-msg').textContent = 'five letters, please'; return; }
    q('.wr-msg').textContent = '';
    q('.wr-input').value = '';
    const colors = scoreGuess(v, answer);
    paint('.wr-board.mine', row, v, colors);
    myGuesses.push({ word: v, colors });
    row++;
    sendRetry(ctx.rt, { k: 'row', n: row, colors, word: v });
    if (colors === 'ggggg') {
      done = true;
      myDone = { rows: row };
      sendRetry(ctx.rt, { k: 'solved', rows: row });
      showSolvedWait(row);
      checkEnd();
    } else if (row >= 6) {
      done = true;
      myDone = 'failed';
      sendRetry(ctx.rt, { k: 'failed' });
      showFailedWait();
      checkEnd();
    }
  }
  on(q('.wr-go'), 'click', submit);
  on(q('.wr-input'), 'keydown', e => { if (e.key === 'Enter') submit(); });

  ctx.rt.on(m => {
    if (!m?.k) return;
    if (m.k === 'word') {
      // Lock once — never swap the answer after play has a word.
      lockAnswer(m.w);
      return;
    }
    if (m.k === 'row') {
      if (finished) return; // freeze: don't mutate boards after match end
      const idx = (m.n || 1) - 1;
      if (idx < 0 || idx > 5) return;
      paint('.wr-board.theirs', idx, null, m.colors);
      theirGuesses[idx] = { word: m.word || '', colors: m.colors };
      return;
    }
    if (m.k === 'solved') {
      if (theirDone == null) theirDone = { rows: m.rows };
      checkEnd();
      return;
    }
    if (m.k === 'failed') {
      if (theirDone == null) theirDone = 'failed';
      checkEnd();
      return;
    }
    if (m.k === 'needword' && isHost && answerLocked && !finished) {
      sendRetry(ctx.rt, { k: 'word', w: answer });
    }
    if (m.k === 'endround' && isHost) {
      // Partner pressed End round — record the match, they proceed locally.
      reportFinish();
    }
  });

  if (isHost) {
    // Host picks once from match seed (stable across remounts) and never changes it.
    lockAnswer(answerForMatch(ctx.code, ctx.startedAt || 0));
    const pushWord = () => {
      if (answerLocked && !finished) sendRetry(ctx.rt, { k: 'word', w: answer });
    };
    pushWord();
    later(pushWord, 600);
    later(pushWord, 1600);
    later(pushWord, 3000);
  } else {
    // Guest must not guess until host word is locked (avoids two different answers).
    setInputEnabled(false);
    q('.wr-msg').textContent = 'syncing the word…';
    const ask = () => {
      if (!answerLocked && !finished) ctx.rt.send({ k: 'needword' });
    };
    ask();
    later(ask, 700);
    later(ask, 1500);
    later(ask, 2800);
  }
}

export function unmount() {
  timers.forEach(t => clearTimeout(t));
  timers = [];
  cleanup.forEach(f => f());
  cleanup = [];
}
