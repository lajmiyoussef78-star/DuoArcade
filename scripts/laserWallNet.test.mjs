import assert from 'node:assert/strict';
import {
  applyLaserWallGuestState,
  laserWallWinnerRole,
  packLaserWallGuestIntent,
  packLaserWallState,
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

console.log('laser wall net tests: PASS');
