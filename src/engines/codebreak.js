// engines/codebreak.js — Code Break: each player picks a secret 4-digit code.
// Take turns guessing your partner's number. You only get totals back —
// how many digits are correct (right place) and how many are right but
// misplaced. No per-digit hints. First exact crack wins.
export const meta = { id: 'codebreak', name: 'Code Break', tag: 'crack the 4-digit code', realtime: false };

const LEN = 4;
const MAX = 10; // guesses per player before a draw

// Mastermind-style scoring: exact = right digit, right place;
// misplaced = right digit, wrong place (positions never revealed).
export function scoreGuess(guess, answer) {
  const g = String(guess).split('');
  const a = String(answer).split('');
  if (g.length !== LEN || a.length !== LEN) return null;

  let exact = 0;
  const gLeft = [], aLeft = [];
  for (let i = 0; i < LEN; i++) {
    if (g[i] === a[i]) exact++;
    else { gLeft.push(g[i]); aLeft.push(a[i]); }
  }
  let misplaced = 0;
  const pool = aLeft.slice();
  for (const d of gLeft) {
    const j = pool.indexOf(d);
    if (j >= 0) { misplaced++; pool.splice(j, 1); }
  }
  return { exact, misplaced };
}

export function formatHint(score) {
  if (!score) return '';
  const bits = [];
  if (score.exact) bits.push(`${score.exact} correct`);
  if (score.misplaced) bits.push(`${score.misplaced} correct but misplaced`);
  return bits.length ? bits.join(' · ') : 'none correct';
}

export function isWin(score) {
  return score && score.exact === LEN;
}

export function initialState() {
  return {
    phase: 'setA',
    secrets: { A: null, B: null },
    guesses: { A: [], B: [] },
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
    return { gs: { ...gs, guesses, last }, again: false };
  }

  return null;
}

export function winner(gs) {
  if (gs.phase !== 'play') return null;
  for (const p of ['A', 'B']) {
    const last = gs.guesses[p].at(-1);
    if (last && isWin(last.score)) return p;
  }
  if (gs.guesses.A.length >= MAX && gs.guesses.B.length >= MAX) return 'draw';
  return null;
}

/* ---------- rendering ---------- */

function boardCompact(history) {
  const el = document.createElement('div');
  el.className = 'cb-board';
  if (!history.length) {
    const row = document.createElement('div');
    row.className = 'cb-row hint';
    row.textContent = 'no guesses yet';
    el.appendChild(row);
    return el;
  }
  for (const entry of history) {
    const row = document.createElement('div');
    row.className = 'cb-row';
    const code = document.createElement('div');
    code.className = 'cb-code';
    for (let c = 0; c < LEN; c++) {
      const cell = document.createElement('div');
      cell.className = 'cb-cell';
      cell.textContent = entry.code[c];
      code.appendChild(cell);
    }
    const hint = document.createElement('div');
    hint.className = 'cb-hint';
    hint.textContent = formatHint(entry.score);
    row.appendChild(code);
    row.appendChild(hint);
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
  legend.textContent =
    'you only get totals — never which digit is which. crack all 4 in the right order to win.';
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
    const who = gs.last.by === myRole ? 'You' : 'Partner';
    note.textContent = isWin(gs.last.score)
      ? `${who} cracked the code!`
      : `${who}: ${gs.last.code} → ${formatHint(gs.last.score)}`;
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
