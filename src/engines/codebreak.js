// engines/codebreak.js — Code Break: each player picks a secret 4-digit code.
// Take turns guessing your partner's number. Green = right digit, right place.
// Yellow = right digit, wrong place. Red = not in the code. First crack wins.
export const meta = { id: 'codebreak', name: 'Code Break', tag: 'crack the 4-digit code', realtime: false };

const LEN = 4;
const MAX = 10; // guesses per player before a draw

// Wordle-style two-pass scoring: g green, y yellow, . red
export function scoreGuess(guess, answer) {
  const g = String(guess).split('');
  const a = String(answer).split('');
  if (g.length !== LEN || a.length !== LEN) return null;
  const res = Array(LEN).fill('.');
  const left = {};
  for (let i = 0; i < LEN; i++) {
    if (g[i] === a[i]) res[i] = 'g';
    else left[a[i]] = (left[a[i]] || 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (res[i] === '.' && left[g[i]] > 0) { res[i] = 'y'; left[g[i]]--; }
  }
  return res.join('');
}

export function initialState() {
  return {
    phase: 'setA',                    // setA → setB → play
    secrets: { A: null, B: null },
    guesses: { A: [], B: [] },      // each list: { code, score }[]
    last: null
  };
}

const other = p => (p === 'A' ? 'B' : 'A');

function validCode(code) {
  return typeof code === 'string' && /^\d{4}$/.test(code);
}

export function applyMove(gs, m, player) {
  if (!m || typeof m !== 'object') return null;

  if (m.t === 'set') {
    if (!validCode(m.code)) return null;
    if (gs.phase === 'setA' && player === 'A' && !gs.secrets.A) {
      return {
        gs: { ...gs, phase: 'setB', secrets: { ...gs.secrets, A: m.code }, last: null },
        again: false
      };
    }
    if (gs.phase === 'setB' && player === 'B' && !gs.secrets.B) {
      return {
        gs: { ...gs, phase: 'play', secrets: { ...gs.secrets, B: m.code }, last: null },
        again: false
      };
    }
    return null;
  }

  if (m.t === 'guess') {
    if (gs.phase !== 'play') return null;
    if (!validCode(m.code)) return null;
    const target = gs.secrets[other(player)];
    if (!target) return null;
    if (gs.guesses[player].length >= MAX) return null;

    const score = scoreGuess(m.code, target);
    const guesses = {
      ...gs.guesses,
      [player]: [...gs.guesses[player], { code: m.code, score }]
    };
    const last = { by: player, code: m.code, score };
    const won = score === 'g'.repeat(LEN);
    return { gs: { ...gs, guesses, last }, again: false };
  }

  return null;
}

export function winner(gs) {
  if (gs.phase !== 'play') return null;
  for (const p of ['A', 'B']) {
    const last = gs.guesses[p].at(-1);
    if (last && last.score === 'g'.repeat(LEN)) return p;
  }
  if (gs.guesses.A.length >= MAX && gs.guesses.B.length >= MAX) return 'draw';
  return null;
}

/* ---------- rendering ---------- */

const COLOR = { g: 'green', y: 'yellow', '.': 'gray' };

function boardCompact(history) {
  const el = document.createElement('div');
  el.className = 'cb-board';
  const rows = Math.max(1, history.length);
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.className = 'cb-row';
    const entry = history[r];
    for (let c = 0; c < LEN; c++) {
      const cell = document.createElement('div');
      cell.className = 'cb-cell' + (entry ? ' ' + (COLOR[entry.score[c]] || 'gray') : ' empty');
      if (entry) cell.textContent = entry.code[c];
      row.appendChild(cell);
    }
    el.appendChild(row);
  }
  if (!history.length) {
    const row = document.createElement('div');
    row.className = 'cb-row hint';
    row.textContent = 'no guesses yet';
    el.appendChild(row);
  }
  return el;
}

let draft = '';

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'cb-wrap';

  const legend = document.createElement('div');
  legend.className = 'cb-legend';
  legend.innerHTML =
    '<span class="green">green</span> right place · ' +
    '<span class="yellow">yellow</span> wrong place · ' +
    '<span class="gray">red</span> not in code';
  wrap.appendChild(legend);

  if (gs.phase === 'setA' || gs.phase === 'setB') {
    const setting = gs.phase === 'setA' ? 'A' : 'B';
    const head = document.createElement('div');
    head.className = 'dots-score';
    head.style.marginTop = '0';
    if (turn === myRole && myRole === setting && !gs.secrets[setting]) {
      head.textContent = 'pick your secret 4-digit code — your partner won\u2019t see it';
    } else if (myRole === setting) {
      head.textContent = 'lock in your secret code\u2026';
    } else {
      head.textContent = 'your partner is choosing their secret code\u2026';
    }
    wrap.appendChild(head);

    if (turn === myRole && myRole === setting && !gs.secrets[setting]) {
      const form = document.createElement('div');
      form.className = 'cb-form';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cb-input';
      input.inputMode = 'numeric';
      input.maxLength = LEN;
      input.placeholder = '####';
      input.autocomplete = 'off';
      input.value = draft;
      input.addEventListener('input', () => {
        draft = input.value.replace(/\D/g, '').slice(0, LEN);
        input.value = draft;
      });
      const btn = document.createElement('button');
      btn.className = 'btn warm';
      btn.textContent = 'Lock code';
      btn.addEventListener('click', () => {
        if (draft.length !== LEN) return;
        onMove({ t: 'set', code: draft });
        draft = '';
      });
      form.appendChild(input);
      form.appendChild(btn);
      wrap.appendChild(form);
    }
    host.appendChild(wrap);
    return;
  }

  // play phase
  const mine = gs.guesses[myRole];
  const theirs = gs.guesses[other(myRole)];
  const canGuess = !w && turn === myRole && mine.length < MAX;

  const cols = document.createElement('div');
  cols.className = 'cb-cols';
  const left = document.createElement('div');
  left.className = 'cb-side';
  left.appendChild(Object.assign(document.createElement('div'), {
    className: 'cb-label', textContent: 'your guesses'
  }));
  left.appendChild(boardCompact(mine));

  const right = document.createElement('div');
  right.className = 'cb-side';
  right.appendChild(Object.assign(document.createElement('div'), {
    className: 'cb-label', textContent: 'partner\u2019s guesses'
  }));
  right.appendChild(boardCompact(theirs));
  cols.appendChild(left);
  cols.appendChild(right);
  wrap.appendChild(cols);

  if (gs.last) {
    const note = document.createElement('div');
    note.className = 'dots-score';
    const who = gs.last.by === myRole ? 'you' : 'partner';
    note.textContent =
      gs.last.score === 'g'.repeat(LEN)
        ? `${who} cracked the code!`
        : `last guess by ${who}: ${gs.last.code}`;
    wrap.appendChild(note);
  }

  if (canGuess) {
    const form = document.createElement('div');
    form.className = 'cb-form';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cb-input';
    input.inputMode = 'numeric';
    input.maxLength = LEN;
    input.placeholder = 'guess ####';
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, LEN);
    });
    const btn = document.createElement('button');
    btn.className = 'btn warm';
    btn.textContent = 'Guess';
    btn.addEventListener('click', () => {
      const code = input.value;
      if (code.length !== LEN) return;
      onMove({ t: 'guess', code });
      input.value = '';
    });
    form.appendChild(input);
    form.appendChild(btn);
    wrap.appendChild(form);
  } else if (!w) {
    const wait = document.createElement('div');
    wait.className = 'dots-score';
    wait.textContent = turn === myRole
      ? `out of guesses (${MAX})`
      : 'partner\u2019s turn\u2026';
    wrap.appendChild(wait);
  }

  if (w && w !== 'draw') {
    const reveal = document.createElement('div');
    reveal.className = 'cb-reveal';
    const opp = other(myRole);
    reveal.textContent = w === myRole
      ? `you won — their code was ${gs.secrets[opp]}`
      : `they got it — your code was ${gs.secrets[myRole]}`;
    wrap.appendChild(reveal);
  }

  host.appendChild(wrap);
}
