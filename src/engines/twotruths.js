// engines/twotruths.js — Two Truths & a Lie.
// Each partner writes three statements about themselves (two true, one lie).
// The other partner tries to spot the lie. Catch it = 1 point. Both take a
// turn writing and a turn guessing; most points wins (a tie means you know
// each other equally well).
export const meta = { id: 'twotruths', name: 'Two Truths & a Lie', tag: 'spot the fib', realtime: false };

// step 0: first player writes   step 1: partner picks the lie
// step 2: partner writes        step 3: first player picks   step 4: done
export function initialState() {
  return {
    step: 0,
    entries: { A: null, B: null },   // { statements:[3], lie:0..2 }
    picks: { A: null, B: null },     // player's guess at the OTHER's lie
    scores: { A: 0, B: 0 },
    last: null
  };
}

const otherOf = p => (p === 'A' ? 'B' : 'A');

export function applyMove(gs, m, player) {
  if (!m || typeof m !== 'object') return null;

  if (m.t === 'write') {
    if (gs.step !== 0 && gs.step !== 2) return null;
    if (gs.entries[player]) return null;
    const s = m.statements;
    if (!Array.isArray(s) || s.length !== 3) return null;
    const clean = s.map(x => String(x || '').trim().slice(0, 120));
    if (clean.some(x => !x)) return null;
    if (!Number.isInteger(m.lie) || m.lie < 0 || m.lie > 2) return null;
    const entries = { ...gs.entries, [player]: { statements: clean, lie: m.lie } };
    return { gs: { ...gs, step: gs.step + 1, entries, last: null }, again: false };
  }

  if (m.t === 'pick') {
    if (gs.step !== 1 && gs.step !== 3) return null;
    const entry = gs.entries[otherOf(player)];
    if (!entry || gs.picks[player] !== null) return null;
    if (!Number.isInteger(m.i) || m.i < 0 || m.i > 2) return null;
    const correct = m.i === entry.lie;
    const scores = { ...gs.scores, [player]: gs.scores[player] + (correct ? 1 : 0) };
    const picks = { ...gs.picks, [player]: m.i };
    const last = { correct, lie: entry.statements[entry.lie], guesser: player };
    // after picking, the same player writes their own three (step 1 -> 2)
    return { gs: { ...gs, step: gs.step + 1, picks, scores, last }, again: gs.step === 1 };
  }

  return null;
}

export function winner(gs) {
  if (gs.step < 4) return null;
  const { A, B } = gs.scores;
  return A > B ? 'A' : B > A ? 'B' : 'draw';
}

/* ---------- rendering ---------- */

// keep the half-typed form alive across presence-driven re-renders
let draft = { key: null, s: ['', '', ''], lie: -1 };

function writeForm(wrap, gs, myRole, onMove) {
  const key = myRole + ':' + gs.step;
  if (draft.key !== key) draft = { key, s: ['', '', ''], lie: -1 };

  const head = document.createElement('div');
  head.className = 'quiz-head';
  head.textContent = 'Write 3 statements about yourself — two true, one lie';
  wrap.appendChild(head);

  const form = document.createElement('div');
  form.className = 'ttl-form';
  const inputs = [];
  for (let i = 0; i < 3; i++) {
    const row = document.createElement('div');
    row.className = 'ttl-row' + (draft.lie === i ? ' lie' : '');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ttl-input';
    input.maxLength = 120;
    input.placeholder = `Statement ${i + 1}\u2026`;
    input.value = draft.s[i];
    input.addEventListener('input', () => { draft.s[i] = input.value; });
    const mark = document.createElement('button');
    mark.className = 'ttl-mark';
    mark.type = 'button';
    mark.textContent = draft.lie === i ? 'the lie' : 'lie?';
    mark.title = 'mark this one as the lie';
    mark.addEventListener('click', () => {
      draft.lie = i;
      form.querySelectorAll('.ttl-row').forEach((r, j) => r.classList.toggle('lie', j === i));
      form.querySelectorAll('.ttl-mark').forEach((b, j) => { b.textContent = j === i ? 'the lie' : 'lie?'; });
    });
    row.appendChild(input); row.appendChild(mark);
    form.appendChild(row);
    inputs.push(input);
  }
  wrap.appendChild(form);

  const err = document.createElement('div');
  err.className = 'ttl-err';
  wrap.appendChild(err);

  const send = document.createElement('button');
  send.className = 'btn warm';
  send.textContent = 'Lock it in';
  send.addEventListener('click', () => {
    const s = inputs.map(x => x.value.trim());
    if (s.some(x => !x)) { err.textContent = 'fill in all three statements'; return; }
    if (draft.lie < 0) { err.textContent = 'mark which one is the lie'; return; }
    onMove({ t: 'write', statements: s, lie: draft.lie });
  });
  wrap.appendChild(send);
}

function pickView(wrap, entry, canAct, mine, onMove) {
  const head = document.createElement('div');
  head.className = 'quiz-head';
  head.textContent = canAct
    ? 'Which one is the LIE?'
    : mine ? 'Your partner is studying your statements\u2026' : 'Waiting\u2026';
  wrap.appendChild(head);

  const list = document.createElement('div');
  list.className = 'quiz-opts';
  entry.statements.forEach((txt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-opt';
    btn.textContent = txt;
    btn.disabled = !canAct;
    btn.addEventListener('click', () => onMove({ t: 'pick', i }));
    list.appendChild(btn);
  });
  wrap.appendChild(list);
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'quiz-wrap';
  const canAct = !w && turn === myRole;

  const score = document.createElement('div');
  score.className = 'quiz-score';
  score.innerHTML =
    `<span class="qA">${gs.scores.A}</span><em>lies caught</em><span class="qB">${gs.scores.B}</span>`;
  wrap.appendChild(score);

  if (gs.last) {
    const last = document.createElement('div');
    last.className = 'quiz-last ' + (gs.last.correct ? 'yes' : 'no');
    last.textContent = gs.last.correct
      ? `\u2714 Lie caught: \u201C${gs.last.lie}\u201D`
      : `\u2716 Fooled! The lie was \u201C${gs.last.lie}\u201D`;
    wrap.appendChild(last);
  }

  if (!w) {
    if (gs.step === 0 || gs.step === 2) {
      if (canAct) writeForm(wrap, gs, myRole, onMove);
      else {
        const head = document.createElement('div');
        head.className = 'quiz-head';
        head.textContent = 'Your partner is writing two truths and a lie\u2026';
        wrap.appendChild(head);
      }
    } else {
      // step 1 or 3 — the acting player picks from THEIR PARTNER's entry
      const writer = canAct ? otherOf(myRole) : myRole;
      const entry = gs.entries[writer];
      if (entry) pickView(wrap, entry, canAct, !canAct, onMove);
    }
  }

  const note = document.createElement('div');
  note.className = 'dots-score';
  note.textContent = 'catch the lie = 1 point \u00b7 you each write once and guess once';
  wrap.appendChild(note);
  host.appendChild(wrap);
}
