import assert from 'node:assert/strict';
import {
  applyLaserWallGuestState,
  applyLaserWallTrailDelta,
  inkBoundPreserveStrokes,
  laserWallWinnerRole,
  packLaserWallGuestIntent,
  packLaserWallState,
  packLaserWallTrailDelta,
  sanitizeLaserWallState,
} from '../src/laserwall/laserWallNet.js';

function world() {
  return {
    state: 'play',
    timer: 42.25,
    covered: 14,
    offTime: 1.5,
    artist: 0,
    round: 1,
    tpl: { name: 'Star' },
    _matchAt: 1234,
    art: { x: 250, y: 950, face: 1 },
    run: {
      x: 900,
      y: 450,
      vx: 20,
      vy: -10,
      onWall: true,
      onGround: false,
      stickCd: 0.1,
      squash: 0,
    },
    mouse: { x: 800, y: 300, down: true },
    beam: { hx: 276, hy: 862, x: 800, y: 300, blocked: false, g: 1 },
    accs: [72, 45],
    _roundEnd: null,
    _finalRes: null,
    now: 4.2,
  };
}

{
  const state = packLaserWallState(world(), { map: 2, time: 60 });
  assert.equal(state.state, 'play');
  assert.deepEqual(state.art, { x: 250, face: 1 });
  assert.equal(state.run.x, 900);
  assert.equal(state.run.vx, 20);
  assert.equal(state.mouse.down, true);
  assert.equal(state.beam.g, 1);
  assert.deepEqual(state.accs, [72, 45]);
  assert.equal(state.matchAt, 1234);
  assert.ok(sanitizeLaserWallState(state));
  assert.ok(Buffer.byteLength(JSON.stringify(state)) < 2048, 'snapshot stays compact');
}

{
  const E = world();
  E.art.x = 777;
  E.run.x = 666;
  const intent = packLaserWallGuestIntent(E);
  assert.deepEqual(Object.keys(intent).sort(), ['mouse', 't']);
  assert.equal('art' in intent, false, 'guest cannot claim artist authority');
  assert.equal('run' in intent, false, 'guest cannot claim runner authority');
  assert.equal('beam' in intent, false, 'guest cannot claim laser authority');
}

{
  // Round 1: B predicts runner; A's artist and world state apply immediately.
  const E = world();
  E.art.x = 800;
  E.run.x = 850;
  const authoritative = packLaserWallState(world(), { map: 0, time: 60 });
  const result = applyLaserWallGuestState(E, authoritative, 1 / 60);
  assert.equal(result.accepted, true);
  assert.equal(E.art.x, authoritative.art.x);
  assert.ok(E.run.x > 850 && E.run.x < authoritative.run.x);
  assert.equal(E.timer, authoritative.timer);
  assert.deepEqual(E.beam, authoritative.beam);
}

{
  // Round 2: B predicts artist; A's runner applies immediately.
  const authorityWorld = world();
  authorityWorld.artist = 1;
  authorityWorld.round = 2;
  authorityWorld.art.x = 500;
  authorityWorld.run.x = 1200;
  const authoritative = packLaserWallState(authorityWorld, { map: 1, time: 45 });
  const E = world();
  E.artist = 1;
  E.art.x = 470;
  E.run.x = 700;
  E.mouse = { x: 999, y: 111, down: true };
  const result = applyLaserWallGuestState(E, authoritative, 1 / 60);
  assert.equal(result.accepted, true);
  assert.ok(E.art.x > 470 && E.art.x < 500);
  assert.equal(E.run.x, 1200);
  assert.deepEqual(
    E.mouse,
    { x: 999, y: 111, down: true },
    'guest shooter keeps immediate local aim presentation',
  );
}

{
  assert.equal(laserWallWinnerRole({ winner: 0 }), 'A');
  assert.equal(laserWallWinnerRole({ winner: 1 }), 'B');
  assert.equal(laserWallWinnerRole({ winner: -1 }), 'draw');
  assert.equal(laserWallWinnerRole({ winner: 4 }), null);
  assert.equal(sanitizeLaserWallState({ state: 'play' }), null);
}

{
  // Bound drops oldest completed strokes only — no mid-stroke holes.
  const ink = [];
  for (let i = 0; i < 100; i++) ink.push(i, i, 1);
  ink.push(-1, -1, -1);
  for (let i = 0; i < 40; i++) ink.push(200 + i, 200 + i, 1);
  const bounded = inkBoundPreserveStrokes(ink, 90);
  assert.ok(bounded.length <= 90);
  assert.equal(bounded.some((v, i) => i % 3 === 0 && v < 0), false);
  assert.ok(bounded[0] >= 200);
}

{
  // Append-only deltas never rewrite earlier points; reset replaces.
  const drawn = [];
  for (let i = 0; i < 30; i++) drawn.push(i, i, 1);

  const first = packLaserWallTrailDelta(drawn, 0, {
    compact: (v) => v,
    maxDelta: 12,
    maxReset: 2400,
  });
  assert.equal(first.reset, 1);
  assert.equal(first.from, 0);
  let guest = applyLaserWallTrailDelta([], first).ink;
  assert.deepEqual(guest, drawn);

  drawn.push(100, 100, 1, 101, 101, 1);
  const delta = packLaserWallTrailDelta(drawn, first.nextSent, {
    compact: (v) => v,
    maxDelta: 900,
  });
  assert.equal(delta.reset, 0);
  assert.equal(delta.from, 90);
  guest = applyLaserWallTrailDelta(guest, delta).ink;
  assert.equal(guest.length, drawn.length);
  assert.deepEqual(guest.slice(0, 90), drawn.slice(0, 90));
  assert.ok(guest.length > 90, 'laser history stays intact while new ink appends');
}

console.log('laser wall net tests: PASS');
