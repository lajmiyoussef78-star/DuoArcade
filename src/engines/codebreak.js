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
    const empty = document.createElement('div');
    empty.className = 'cb-row empty';
    empty.textContent = 'no guesses yet';
    el.appendChild(empty);
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

function makeForm({ placeholder, buttonLabel, draftValue, onDraft, onSubmit }) {
  const form = document.createElement('div');
  form.className = 'cb-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cb-input';
  input.inputMode = 'numeric';
  input.maxLength = LEN;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  if (draftValue != null) input.value = draftValue;
  input.addEventListener('input', () => {
    const v = input.value.replace(/\D/g, '').slice(0, LEN);
    input.value = v;
    onDraft?.(v);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') btn.click();
  });
  const btn = document.createElement('button');
  btn.className = 'btn warm';
  btn.textContent = buttonLabel;
  btn.addEventListener('click', () => {
    const code = input.value;
    if (code.length !== LEN) return;
    onSubmit(code);
    input.value = '';
  });
  form.appendChild(input);
  form.appendChild(btn);
  return form;
}

let draft = '';

export function render(host, gs, { myRole, turn, winner: w, onMove, names, onProceed }) {
  host.innerHTML = '';
  const partnerRole = other(myRole);
  const partnerName = names?.[partnerRole] || 'partner';

  const root = document.createElement('div');
  root.className = 'cb-root';

  if (gs.phase === 'setA' || gs.phase === 'setB') {
    const setting = gs.phase === 'setA' ? 'A' : 'B';
    const head = document.createElement('div');
    head.className = 'cb-legend';
    if (turn === myRole && myRole === setting && !gs.secrets[setting]) {
      head.textContent = 'pick your secret 4-digit code — your partner won’t see it';
    } else if (myRole === setting) {
      head.textContent = 'lock in your secret code…';
    } else {
      head.textContent = `${partnerName} is choosing their secret code…`;
    }
    root.appendChild(head);

    if (turn === myRole && myRole === setting && !gs.secrets[setting]) {
      root.appendChild(makeForm({
        placeholder: '####',
        buttonLabel: 'Lock code',
        draftValue: draft,
        onDraft: v => { draft = v; },
        onSubmit: code => {
          onMove({ t: 'set', code });
          draft = '';
        }
      }));
    }
    host.appendChild(root);
    return;
  }

  const mine = gs.guesses[myRole];
  const theirs = gs.guesses[partnerRole];
  const canGuess = !w && turn === myRole && mine.length < MAX;

  const wrap = document.createElement('div');
  wrap.className = 'cb-wrap' + (w ? ' cb-ended' : '');

  // Left: you — guesses + form
  const left = document.createElement('div');
  left.className = 'cb-side mine';
  left.appendChild(Object.assign(document.createElement('div'), {
    className: 'cb-label', textContent: 'you'
  }));
  left.appendChild(boardCompact(mine));
  if (canGuess) {
    left.appendChild(makeForm({
      placeholder: '####',
      buttonLabel: 'Guess',
      onSubmit: code => onMove({ t: 'guess', code })
    }));
  } else if (!w && turn === myRole) {
    left.appendChild(Object.assign(document.createElement('div'), {
      className: 'cb-side-msg', textContent: `out of guesses (${MAX})`
    }));
  }

  // Right: partner guesses only (never their secret until end)
  const right = document.createElement('div');
  right.className = 'cb-side theirs';
  right.appendChild(Object.assign(document.createElement('div'), {
    className: 'cb-label', textContent: partnerName
  }));
  right.appendChild(boardCompact(theirs));

  wrap.appendChild(left);
  wrap.appendChild(right);
  root.appendChild(wrap);

  const foot = document.createElement('div');
  foot.className = 'cb-foot';

  if (w) {
    let title = 'Draw';
    if (w === myRole) title = 'You cracked it!';
    else if (w !== 'draw') title = `${partnerName} cracked it!`;

    const wait = document.createElement('div');
    wait.className = 'cb-wait';
    wait.innerHTML =
      `<div class="cb-wait-title">${title}</div>`
      + `<div class="cb-wait-codes">`
      + `<div class="cb-wait-code">Your code was: <b>${gs.secrets[myRole] || '????'}</b></div>`
      + `<div class="cb-wait-code">${partnerName}’s code was: <b>${gs.secrets[partnerRole] || '????'}</b></div>`
      + `</div>`
      + `<button type="button" class="btn warm cb-end">End round</button>`;
    foot.appendChild(wait);
    const btn = wait.querySelector('.cb-end');
    if (btn) {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        onProceed?.();
      });
    }
  } else {
    foot.appendChild(Object.assign(document.createElement('div'), {
      className: 'cb-legend',
      textContent: 'you only get totals — never which digit is which. crack all 4 in the right order to win.'
    }));
  }

  root.appendChild(foot);
  host.appendChild(root);
}
