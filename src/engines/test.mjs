import * as TTT from './ttt.js';
import * as C4 from './connect4.js';
import * as DOTS from './dots.js';

let pass = 0, fail = 0;
const t = (name, cond) => cond ? pass++ : (fail++, console.log('FAIL:', name));

/* ---------- Tic-Tac-Toe ---------- */
{
  let gs = TTT.initialState();
  t('ttt: empty no winner', TTT.winner(gs) === null);
  let r = TTT.applyMove(gs, 0, 'A');
  t('ttt: legal move', r && r.gs.cells[0] === 'A' && r.again === false);
  t('ttt: original not mutated', gs.cells[0] === null);
  t('ttt: occupied illegal', TTT.applyMove(r.gs, 0, 'B') === null);
  t('ttt: out of range illegal', TTT.applyMove(gs, 9, 'A') === null && TTT.applyMove(gs, -1, 'A') === null);

  // row win
  gs = TTT.initialState();
  for (const [i, p] of [[0,'A'],[3,'B'],[1,'A'],[4,'B'],[2,'A']]) gs = TTT.applyMove(gs, i, p).gs;
  t('ttt: row win A', TTT.winner(gs) === 'A');

  // diagonal win
  gs = TTT.initialState();
  for (const [i, p] of [[0,'B'],[1,'A'],[4,'B'],[2,'A'],[8,'B']]) gs = TTT.applyMove(gs, i, p).gs;
  t('ttt: diag win B', TTT.winner(gs) === 'B');

  // draw: A A B / B B A / A A B
  gs = TTT.initialState();
  const seq = [[0,'A'],[1,'A'],[2,'B'],[3,'B'],[4,'B'],[5,'A'],[6,'A'],[7,'A'],[8,'B']];
  for (const [i, p] of seq) gs = TTT.applyMove(gs, i, p).gs;
  t('ttt: draw', TTT.winner(gs) === 'draw');
}

/* ---------- Connect Four ---------- */
{
  let gs = C4.initialState();
  t('c4: empty no winner', C4.winner(gs) === null);
  for (let i = 0; i < 4; i++) gs = C4.applyMove(gs, 0, 'A').gs;
  t('c4: vertical win', C4.winner(gs) === 'A');

  gs = C4.initialState();
  for (let c = 0; c < 4; c++) gs = C4.applyMove(gs, c, 'B').gs;
  t('c4: horizontal win', C4.winner(gs) === 'B');

  gs = C4.initialState();
  gs = C4.applyMove(gs, 0, 'A').gs;
  gs = C4.applyMove(gs, 1, 'B').gs; gs = C4.applyMove(gs, 1, 'A').gs;
  gs = C4.applyMove(gs, 2, 'B').gs; gs = C4.applyMove(gs, 2, 'B').gs; gs = C4.applyMove(gs, 2, 'A').gs;
  gs = C4.applyMove(gs, 3, 'B').gs; gs = C4.applyMove(gs, 3, 'B').gs; gs = C4.applyMove(gs, 3, 'B').gs; gs = C4.applyMove(gs, 3, 'A').gs;
  t('c4: diagonal win', C4.winner(gs) === 'A');

  gs = C4.initialState();
  for (let i = 0; i < 6; i++) gs = C4.applyMove(gs, 3, i % 2 ? 'A' : 'B').gs;
  t('c4: full column illegal', C4.applyMove(gs, 3, 'A') === null);
  t('c4: bad col illegal', C4.applyMove(gs, 7, 'A') === null);
}

/* ---------- Dots & Boxes ---------- */
{
  let gs = DOTS.initialState();
  t('dots: empty no winner', DOTS.winner(gs) === null);

  // Close box (0,0): edges h0,0 h1,0 v0,0 v0,1 — last edge claims it + again
  let r;
  r = DOTS.applyMove(gs, { t:'h', r:0, c:0 }, 'A'); gs = r.gs; t('dots: edge 1 no again', r.again === false);
  r = DOTS.applyMove(gs, { t:'h', r:1, c:0 }, 'B'); gs = r.gs;
  r = DOTS.applyMove(gs, { t:'v', r:0, c:0 }, 'A'); gs = r.gs;
  t('dots: duplicate edge illegal', DOTS.applyMove(gs, { t:'v', r:0, c:0 }, 'B') === null);
  r = DOTS.applyMove(gs, { t:'v', r:0, c:1 }, 'B');
  t('dots: closing box claims it', r.gs.boxes[0][0] === 'B');
  t('dots: closing box grants again', r.again === true);
  gs = r.gs;
  t('dots: score counts', DOTS.score(gs).b === 1 && DOTS.score(gs).a === 0);

  // A double-cross: one edge completing two boxes counts both
  gs = DOTS.initialState();
  // boxes (0,0) and (0,1) share edge v0,1 — fill all their other edges first
  for (const m of [
    { t:'h', r:0, c:0 }, { t:'h', r:1, c:0 }, { t:'v', r:0, c:0 },   // box 0,0 minus v0,1
    { t:'h', r:0, c:1 }, { t:'h', r:1, c:1 }, { t:'v', r:0, c:2 }    // box 0,1 minus v0,1
  ]) gs = DOTS.applyMove(gs, m, 'A').gs;
  r = DOTS.applyMove(gs, { t:'v', r:0, c:1 }, 'B');
  t('dots: double box claim', r.gs.boxes[0][0] === 'B' && r.gs.boxes[0][1] === 'B');

  // invalid coords
  gs = DOTS.initialState();
  t('dots: bad h coords illegal', DOTS.applyMove(gs, { t:'h', r:5, c:0 }, 'A') === null);
  t('dots: bad v coords illegal', DOTS.applyMove(gs, { t:'v', r:0, c:5 }, 'A') === null);
  t('dots: bad type illegal', DOTS.applyMove(gs, { t:'x', r:0, c:0 }, 'A') === null);

  // full-board winner: play greedily to the end with alternating players,
  // honoring the again rule, and check winner matches the final score.
  gs = DOTS.initialState();
  let player = 'A', guard = 0;
  while (DOTS.winner(gs) === null && guard++ < 500) {
    let played = false;
    outer:
    for (let rr = 0; rr <= 4; rr++) for (let cc = 0; cc < 4; cc++) {
      const res = DOTS.applyMove(gs, { t:'h', r:rr, c:cc }, player);
      if (res) { gs = res.gs; if (!res.again) player = player === 'A' ? 'B' : 'A'; played = true; break outer; }
    }
    if (!played) {
      outer2:
      for (let rr = 0; rr < 4; rr++) for (let cc = 0; cc <= 4; cc++) {
        const res = DOTS.applyMove(gs, { t:'v', r:rr, c:cc }, player);
        if (res) { gs = res.gs; if (!res.again) player = player === 'A' ? 'B' : 'A'; played = true; break outer2; }
      }
    }
    if (!played) break;
  }
  const sc = DOTS.score(gs);
  const w = DOTS.winner(gs);
  t('dots: game terminates', w !== null);
  t('dots: all 16 boxes owned', sc.a + sc.b === 16);
  t('dots: winner matches score',
    (sc.a > sc.b && w === 'A') || (sc.b > sc.a && w === 'B') || (sc.a === sc.b && w === 'draw'));
}


/* ---------- Reversi ---------- */
import * as REV from './reversi.js';
{
  let gs = REV.initialState();
  t('rev: no winner at start', REV.winner(gs) === null);
  t('rev: A has 4 opening moves', REV.legalMoves(gs, 'A').length === 4);
  const r = REV.applyMove(gs, { r: 2, c: 3 }, 'A');   // classic opening
  t('rev: opening move legal', r !== null);
  t('rev: flips the sandwiched disc', r.gs.b[3][3] === 'A');
  t('rev: illegal empty-flip move', REV.applyMove(gs, { r: 0, c: 0 }, 'A') === null);
  const sc = REV.count(r.gs);
  t('rev: counts after flip', sc.a === 4 && sc.b === 1);
}

/* ---------- Pong physics ---------- */
import * as PONG from './pong.js';
{
  let st = PONG.initialPhysics(1);
  st.ball = { x: 0.5, y: 0.02, vx: 0.3, vy: -0.5 };
  let r = PONG.step(st, 0.016);
  t('pong: bounces off top wall', r.state.ball.vy > 0);

  st = PONG.initialPhysics(1);
  st.ball = { x: 0.97, y: 0.5, vx: 0.6, vy: 0 };
  st.pb = 0.5;
  r = PONG.step(st, 0.05);
  t('pong: right paddle returns ball', r.state.ball.vx < 0);

  st = PONG.initialPhysics(1);
  st.ball = { x: 0.99, y: 0.9, vx: 0.8, vy: 0 };
  st.pb = 0.1;                                   // paddle far away
  r = PONG.step(st, 0.1);
  t('pong: missed ball scores for A', r.scored === 'A' && r.state.sa === 1);
  t('pong: ball resets after point', Math.abs(r.state.ball.x - 0.5) < 0.01);

  st = PONG.initialPhysics(1);
  st.ball = { x: 0.01, y: 0.9, vx: -0.8, vy: 0 };
  st.pa = 0.1;
  r = PONG.step(st, 0.1);
  t('pong: missed ball scores for B', r.scored === 'B' && r.state.sb === 1);
}


/* ---------- Gomoku ---------- */
import * as GMK from './gomoku.js';
{
  let gs = GMK.initialState();
  t('gmk: empty no winner', GMK.winner(gs) === null);
  for (let i = 0; i < 5; i++) gs = GMK.applyMove(gs, { r: 5, c: 3 + i }, 'A').gs;
  t('gmk: five in a row wins', GMK.winner(gs) === 'A');
  gs = GMK.initialState();
  for (let i = 0; i < 5; i++) gs = GMK.applyMove(gs, { r: 2 + i, c: 2 + i }, 'B').gs;
  t('gmk: diagonal five wins', GMK.winner(gs) === 'B');
  gs = GMK.initialState();
  gs = GMK.applyMove(gs, { r: 0, c: 0 }, 'A').gs;
  t('gmk: occupied illegal', GMK.applyMove(gs, { r: 0, c: 0 }, 'B') === null);
  t('gmk: out of range illegal', GMK.applyMove(gs, { r: 11, c: 0 }, 'A') === null);
}

/* ---------- Memory ---------- */
import * as MEM from './memory.js';
{
  let gs = MEM.initialState();
  t('mem: 20 cards', gs.cards.length === 20);
  t('mem: no winner at start', MEM.winner(gs) === null);
  // find a matching pair deterministically
  const first = gs.cards[0].e;
  const j = gs.cards.findIndex((c, idx) => idx > 0 && c.e === first);
  let r = MEM.applyMove(gs, 0, 'A');
  t('mem: first flip keeps turn', r.again === true && r.gs.flipped.length === 1);
  r = MEM.applyMove(r.gs, j, 'A');
  t('mem: match claims pair', r.gs.cards[0].owner === 'A' && r.gs.cards[j].owner === 'A');
  t('mem: match keeps turn', r.again === true);
  // a miss passes the turn
  gs = r.gs;
  const openIdx = gs.cards.map((c, i) => c.owner ? -1 : i).filter(i => i >= 0);
  const x = openIdx[0];
  const y = openIdx.find(i => gs.cards[i].e !== gs.cards[x].e);
  let m1 = MEM.applyMove(gs, x, 'A');
  let m2 = MEM.applyMove(m1.gs, y, 'A');
  t('mem: miss passes turn', m2.again === false && m2.gs.lastMiss.length === 2);
  t('mem: flipped card is not re-flippable', MEM.applyMove(m1.gs, x, 'A') === null);
}


/* ---------- Word Race scoring ---------- */
import { scoreGuess } from './wordrace.js';
{
  t('wr: exact match all green', scoreGuess('apple', 'apple') === 'ggggg');
  t('wr: no letters shared all gray', scoreGuess('rundo', 'apple').split('').every(c => c === '.') === false || scoreGuess('brung', 'apple') === '.....');
  t('wr: yellow for wrong position', scoreGuess('pleap', 'apple').includes('y'));
  // duplicate handling: answer 'apple' has one 'l'; guess 'lulls' -> only one l scores
  const r = scoreGuess('lulls', 'apple');
  const lScores = [r[0], r[2], r[3]].filter(c => c !== '.').length;
  t('wr: duplicate letters scored once', lScores === 1);
  t('wr: green consumes before yellow', scoreGuess('allee', 'apple')[1] === '.' || scoreGuess('allee', 'apple').split('').filter(c=>c!=='.').length <= 4);
}

/* ---------- Maze generation ---------- */
import { generate, canMove, N as MN, mulberry32 } from './maze.js';
{
  const walls = generate(12345);
  t('maze: correct size', walls.length === MN && walls[0].length === MN);
  // every cell reachable from (0,0) — flood fill
  const seen = Array.from({ length: MN }, () => Array(MN).fill(false));
  const stack = [[0, 0]]; seen[0][0] = true; let count = 1;
  const D = [['n',-1,0],['s',1,0],['e',0,1],['w',0,-1]];
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [d, dr, dc] of D) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= MN || cc < 0 || cc >= MN || seen[rr][cc]) continue;
      if (canMove(walls, r, c, d)) { seen[rr][cc] = true; count++; stack.push([rr, cc]); }
    }
  }
  t('maze: fully connected', count === MN * MN);
  t('maze: deterministic from seed', JSON.stringify(generate(777)) === JSON.stringify(generate(777)));
  t('maze: different seeds differ', JSON.stringify(generate(1)) !== JSON.stringify(generate(2)));
  const rnd = mulberry32(42);
  const v = rnd();
  t('maze: rng in range', v >= 0 && v < 1);
}

/* ---------- Nim (Sticks) ---------- */
import * as NIM from './nim.js';
{
  let gs = NIM.initialState();
  t('nim: 1-3-5-7 start', gs.rows.join(',') === '1,3,5,7');
  t('nim: no winner at start', NIM.winner(gs) === null);
  let r = NIM.applyMove(gs, { row: 3, take: 3 }, 'A');
  t('nim: take from a row', r && r.gs.rows[3] === 4 && r.again === false);
  t('nim: original not mutated', gs.rows[3] === 7);
  t('nim: cannot take zero', NIM.applyMove(gs, { row: 1, take: 0 }, 'A') === null);
  t('nim: cannot overdraw a row', NIM.applyMove(gs, { row: 0, take: 2 }, 'A') === null);
  t('nim: bad row illegal', NIM.applyMove(gs, { row: 9, take: 1 }, 'A') === null);

  // play down to the last stick: whoever takes it loses (misère)
  gs = NIM.initialState();
  gs = NIM.applyMove(gs, { row: 3, take: 7 }, 'A').gs;
  gs = NIM.applyMove(gs, { row: 2, take: 5 }, 'B').gs;
  gs = NIM.applyMove(gs, { row: 1, take: 3 }, 'A').gs;
  t('nim: not over with sticks left', NIM.winner(gs) === null);
  gs = NIM.applyMove(gs, { row: 0, take: 1 }, 'B').gs;
  t('nim: last-stick taker loses', NIM.winner(gs) === 'A');
}

/* ---------- Duo Dash (race) ---------- */
import * as RACE from './race.js';
{
  let gs = RACE.initialState();
  t('race: both at base', gs.pos.A.join() === '0,0' && gs.pos.B.join() === '0,0');
  t('race: move before roll illegal', RACE.applyMove(gs, { t: 'move', token: 0 }, 'A') === null);
  let r = RACE.applyMove(gs, { t: 'roll' }, 'A');
  t('race: roll keeps turn', r && r.again === true && r.gs.die >= 1 && r.gs.die <= 6);
  t('race: double roll illegal', RACE.applyMove(r.gs, { t: 'roll' }, 'A') === null);
  const die = r.gs.die;
  r = RACE.applyMove(r.gs, { t: 'move', token: 0 }, 'A');
  t('race: token advances by die', r.gs.pos.A[0] === die);
  t('race: six rolls again', r.again === (die === 6));

  // bump: A lands exactly on B's token
  gs = RACE.initialState();
  gs = { ...gs, pos: { A: [3, 0], B: [8, 0] }, phase: 'move', die: 5 };
  r = RACE.applyMove(gs, { t: 'move', token: 0 }, 'A');
  t('race: bump sends token to base', r.gs.pos.B[0] === 0 && r.gs.event === 'bump');

  // home + winner
  gs = RACE.initialState();
  gs = { ...gs, pos: { A: [RACE.HOME, 22], B: [4, 4] }, phase: 'move', die: 6 };
  r = RACE.applyMove(gs, { t: 'move', token: 1 }, 'A');
  t('race: overshoot lands home', r.gs.pos.A[1] === RACE.HOME);
  t('race: both home wins', RACE.winner(r.gs) === 'A');
  t('race: no extra turn after winning', r.again === false);
  t('race: cannot move a token already home', RACE.applyMove(gs, { t: 'move', token: 0 }, 'A') === null);
}

/* ---------- Couple Quiz ---------- */
import * as CQ from './couplequiz.js';
{
  let gs = CQ.initialState();
  t('cq: six questions dealt', gs.qs.length === CQ.ROUNDS);
  t('cq: no winner at start', CQ.winner(gs) === null);
  t('cq: guess before answer illegal', CQ.applyMove(gs, { t: 'guess', i: 0 }, 'B') === null);
  let r = CQ.applyMove(gs, { t: 'answer', i: 2 }, 'A');
  t('cq: answer passes to guesser', r && r.gs.phase === 'guess' && r.gs.subject === 'A' && r.again === false);
  t('cq: subject cannot guess own answer', CQ.applyMove(r.gs, { t: 'guess', i: 2 }, 'A') === null);
  let g = CQ.applyMove(r.gs, { t: 'guess', i: 2 }, 'B');
  t('cq: correct guess scores', g.gs.scores.B === 1 && g.gs.last.correct === true);
  t('cq: guesser becomes next subject', g.again === true && g.gs.phase === 'answer');
  g = CQ.applyMove(r.gs, { t: 'guess', i: 3 }, 'B');
  t('cq: wrong guess no point', g.gs.scores.B === 0 && g.gs.last.correct === false);
  t('cq: bad option illegal', CQ.applyMove(gs, { t: 'answer', i: 9 }, 'A') === null);

  // run all six rounds: B always guesses right, A always wrong
  gs = CQ.initialState();
  let player = 'A';
  for (let round = 0; round < CQ.ROUNDS; round++) {
    let res = CQ.applyMove(gs, { t: 'answer', i: 1 }, player);
    gs = res.gs; player = player === 'A' ? 'B' : 'A';
    const guess = player === 'B' ? 1 : 0;   // B guesses right, A guesses wrong
    res = CQ.applyMove(gs, { t: 'guess', i: guess }, player);
    gs = res.gs;
  }
  t('cq: winner after six rounds', CQ.winner(gs) === 'B');
  t('cq: no moves after the end', CQ.applyMove(gs, { t: 'answer', i: 0 }, 'A') === null);
}

/* ---------- Two Truths & a Lie ---------- */
import * as TTL from './twotruths.js';
{
  const entry = { t: 'write', statements: ['I ran a marathon', 'I hate mangoes', 'I met a celebrity'], lie: 1 };
  let gs = TTL.initialState();
  t('ttl: no winner at start', TTL.winner(gs) === null);
  t('ttl: pick before write illegal', TTL.applyMove(gs, { t: 'pick', i: 0 }, 'B') === null);
  t('ttl: incomplete statements illegal', TTL.applyMove(gs, { t: 'write', statements: ['a', '', 'c'], lie: 0 }, 'A') === null);
  t('ttl: bad lie index illegal', TTL.applyMove(gs, { t: 'write', statements: ['a', 'b', 'c'], lie: 5 }, 'A') === null);

  let r = TTL.applyMove(gs, entry, 'A');
  t('ttl: write passes the turn', r && r.gs.step === 1 && r.again === false);
  t('ttl: cannot write twice', TTL.applyMove(r.gs, entry, 'A') === null);
  let p = TTL.applyMove(r.gs, { t: 'pick', i: 1 }, 'B');
  t('ttl: catching the lie scores', p.gs.scores.B === 1 && p.gs.last.correct === true);
  t('ttl: picker writes next', p.again === true && p.gs.step === 2);
  p = TTL.applyMove(r.gs, { t: 'pick', i: 0 }, 'B');
  t('ttl: fooled scores nothing', p.gs.scores.B === 0 && p.gs.last.correct === false);

  // full game: B catches A's lie, A gets fooled -> B wins
  gs = TTL.initialState();
  gs = TTL.applyMove(gs, entry, 'A').gs;
  gs = TTL.applyMove(gs, { t: 'pick', i: 1 }, 'B').gs;
  gs = TTL.applyMove(gs, { t: 'write', statements: ['x', 'y', 'z'], lie: 2 }, 'B').gs;
  t('ttl: not over before last pick', TTL.winner(gs) === null);
  gs = TTL.applyMove(gs, { t: 'pick', i: 0 }, 'A').gs;
  t('ttl: B wins the duel', TTL.winner(gs) === 'B');
  t('ttl: no moves after the end', TTL.applyMove(gs, { t: 'pick', i: 1 }, 'A') === null);

  // draw when both catch it
  gs = TTL.initialState();
  gs = TTL.applyMove(gs, entry, 'A').gs;
  gs = TTL.applyMove(gs, { t: 'pick', i: 1 }, 'B').gs;
  gs = TTL.applyMove(gs, { t: 'write', statements: ['x', 'y', 'z'], lie: 2 }, 'B').gs;
  gs = TTL.applyMove(gs, { t: 'pick', i: 2 }, 'A').gs;
  t('ttl: both right is a draw', TTL.winner(gs) === 'draw');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
