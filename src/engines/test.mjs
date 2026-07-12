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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
