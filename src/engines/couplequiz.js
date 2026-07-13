// engines/couplequiz.js — Couple Quiz: "how well do you know me?"
// Six rounds. Each round one partner secretly answers a question about
// THEMSELVES, then the other guesses what they picked. A correct guess
// scores a point. Most points after six rounds wins.
export const meta = { id: 'couplequiz', name: 'Couple Quiz', tag: 'how well do you know me?', realtime: false };

export const ROUNDS = 6;

const BANK = [
  { q: 'My perfect evening is…', o: ['Cozy movie night in', 'Fancy dinner out', 'Games until 2am', 'A long walk together'] },
  { q: 'If I could teleport right now, I\u2019d go…', o: ['To a beach', 'To the mountains', 'To a big city', 'Back to bed'] },
  { q: 'My comfort food is…', o: ['Pizza', 'Something sweet', 'Home-cooked classics', 'Instant noodles'] },
  { q: 'When I\u2019m stressed I mostly want…', o: ['A hug and quiet', 'To talk it all out', 'Distraction and jokes', 'To be alone a bit'] },
  { q: 'My hidden talent is closest to…', o: ['Cooking something great', 'Remembering tiny details', 'Making people laugh', 'Fixing broken things'] },
  { q: 'On a lazy Sunday you\u2019ll find me…', o: ['Sleeping in forever', 'Binge-watching a series', 'Out getting brunch', 'Deep in a hobby'] },
  { q: 'The superpower I\u2019d pick is…', o: ['Reading minds', 'Time travel', 'Flying', 'Never needing sleep'] },
  { q: 'My love language is mostly…', o: ['Words and compliments', 'Quality time', 'Little gifts', 'Acts of service'] },
  { q: 'The pet I secretly want is…', o: ['A dog', 'A cat', 'Something exotic', 'No pets, plants!'] },
  { q: 'In a scary movie I\u2019m the one who…', o: ['Covers their eyes', 'Predicts every twist', 'Laughs at the jump scares', 'Falls asleep'] },
  { q: 'My dream vacation length is…', o: ['A weekend getaway', 'One perfect week', 'A whole month', 'Six months, quit everything'] },
  { q: 'If we won the lottery, I\u2019d first…', o: ['Buy a house', 'Travel the world', 'Save most of it', 'Spoil everyone I love'] },
  { q: 'My most-used phrase is basically…', o: ['\u201CI\u2019m hungry\u201D', '\u201CFive more minutes\u201D', '\u201CDid you see this?\u201D', '\u201CLet\u2019s just stay in\u201D'] },
  { q: 'The chore I hate most is…', o: ['Dishes', 'Laundry', 'Cleaning the bathroom', 'Taking out the trash'] },
  { q: 'My ideal breakfast is…', o: ['Big and savory', 'Sweet — pancakes!', 'Just coffee, thanks', 'Whatever you\u2019re making'] },
  { q: 'At a party I\u2019m usually…', o: ['Center of the room', 'With one small group', 'Snacks table guardian', 'Planning our exit'] },
  { q: 'The compliment I love most is about…', o: ['My looks', 'My humor', 'My mind', 'My cooking'] },
  { q: 'My guilty pleasure is…', o: ['Trashy reality TV', 'Late-night snacks', 'Online shopping carts', 'Stalking cute animal videos'] },
  { q: 'If I had a free hour right now, I\u2019d…', o: ['Nap immediately', 'Call someone I love', 'Play a game', 'Go outside'] },
  { q: 'My karaoke song energy is…', o: ['Power ballad, all in', 'A safe crowd-pleaser', 'Rap verse, no misses', 'I hold the phone light'] }
];

export function initialState() {
  const qs = [...BANK]
    .map(x => ({ x, s: Math.random() }))
    .sort((a, b) => a.s - b.s)
    .slice(0, ROUNDS)
    .map(({ x }) => x);
  return {
    qs, round: 0, phase: 'answer',       // 'answer' -> subject picks, 'guess' -> partner guesses
    answer: null,                        // subject's secret pick for the current round
    scores: { A: 0, B: 0 }, last: null
  };
}

export function applyMove(gs, m, player) {
  if (!m || typeof m !== 'object') return null;
  if (gs.round >= ROUNDS) return null;
  const q = gs.qs[gs.round];
  const i = m.i;
  if (!Number.isInteger(i) || i < 0 || i >= q.o.length) return null;

  if (m.t === 'answer') {
    if (gs.phase !== 'answer') return null;
    // the answering player becomes this round's subject; partner guesses next
    return { gs: { ...gs, phase: 'guess', answer: i, subject: player }, again: false };
  }

  if (m.t === 'guess') {
    if (gs.phase !== 'guess' || player === gs.subject) return null;
    const correct = i === gs.answer;
    const scores = { ...gs.scores, [player]: gs.scores[player] + (correct ? 1 : 0) };
    const last = { q: q.q, truth: q.o[gs.answer], guess: q.o[i], correct, guesser: player };
    // guesser becomes the next round's subject, so the turn stays with them
    return {
      gs: { ...gs, round: gs.round + 1, phase: 'answer', answer: null, subject: null, scores, last },
      again: true
    };
  }

  return null;
}

export function winner(gs) {
  if (gs.round < ROUNDS) return null;
  const { A, B } = gs.scores;
  return A > B ? 'A' : B > A ? 'B' : 'draw';
}

/* ---------- rendering ---------- */

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'quiz-wrap';
  const canAct = !w && turn === myRole;

  const score = document.createElement('div');
  score.className = 'quiz-score';
  score.innerHTML =
    `<span class="qA">${gs.scores.A}</span><em>round ${Math.min(gs.round + 1, ROUNDS)} / ${ROUNDS}</em><span class="qB">${gs.scores.B}</span>`;
  wrap.appendChild(score);

  if (gs.last) {
    const last = document.createElement('div');
    last.className = 'quiz-last ' + (gs.last.correct ? 'yes' : 'no');
    last.textContent = gs.last.correct
      ? `\u2714 Guessed it \u2014 \u201C${gs.last.truth}\u201D`
      : `\u2716 Guessed \u201C${gs.last.guess}\u201D, but it was \u201C${gs.last.truth}\u201D`;
    wrap.appendChild(last);
  }

  if (!w) {
    const q = gs.qs[gs.round];
    const head = document.createElement('div');
    head.className = 'quiz-head';
    const question = document.createElement('h3');
    question.textContent = q.q;

    if (gs.phase === 'answer') {
      head.textContent = canAct
        ? 'Answer about YOURSELF — your partner will try to guess it'
        : 'Your partner is answering secretly\u2026';
    } else {
      head.textContent = canAct
        ? 'Your partner answered. What did THEY pick?'
        : 'Now your partner is guessing your answer\u2026';
    }
    wrap.appendChild(head);
    wrap.appendChild(question);

    const opts = document.createElement('div');
    opts.className = 'quiz-opts';
    q.o.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt';
      // the subject sees their own secret pick highlighted while partner guesses
      if (gs.phase === 'guess' && myRole === gs.subject && i === gs.answer) btn.classList.add('mine');
      btn.textContent = opt;
      btn.disabled = !canAct;
      btn.addEventListener('click', () =>
        onMove(gs.phase === 'answer' ? { t: 'answer', i } : { t: 'guess', i }));
      opts.appendChild(btn);
    });
    wrap.appendChild(opts);
  }

  const note = document.createElement('div');
  note.className = 'dots-score';
  note.textContent = 'a correct guess = 1 point \u00b7 most points after 6 rounds wins';
  wrap.appendChild(note);
  host.appendChild(wrap);
}
