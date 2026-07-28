/**
 * soccerKickForensics.mjs — PROOF ONLY. No networking changes. No sync fixes.
 *
 * Replays the live Micro Soccer authority model:
 *   Host: socStep @ 60fps
 *   Send: every SOC_NET_INTERVAL_MS (20 Hz) → 3 physics frames / packet
 *   Guest: latestAuthoritativeBall + moveTowardBall (current Soccer.jsx path)
 *   RTT: 0 (best case)
 *
 * Usage: node scripts/soccerKickForensics.mjs
 */
import { socInitial, socStep, SOC } from '../src/lib/soccer.js';
import { moveTowardBall, SOC_NET_INTERVAL_MS } from '../src/lib/soccerNet.js';

const DT = 1 / 60;
const FRAMES_PER_PACKET = Math.round(SOC_NET_INTERVAL_MS / (1000 / 60));
const RATE = 18;
const MAX = 12;
const EPS_POS = 0.5;
const EPS_VEL = 0.5;

function ballStr(b) {
  return {
    x: +b.x.toFixed(3),
    y: +b.y.toFixed(3),
    vx: +b.vx.toFixed(3),
    vy: +b.vy.toFixed(3),
  };
}

function runKick({ carX = 370, ballX = 420, carV = 260, sendOffset = 0 } = {}) {
  let host = socInitial();
  host.cars.A = { x: carX, y: 250, a: 0, v: carV };
  host.cars.B = { x: 700, y: 250, a: Math.PI, v: 0 };
  host.ball = { x: ballX, y: 250, vx: 0, vy: 0 };

  let latest = { ...host.ball };
  let render = { ...host.ball };
  let since = sendOffset;
  let seq = 0;
  let kickHostFrame = null;
  let firstIrr = null;
  let firstPktAfterKick = null;
  const timeline = [];
  const impulseFrames = [];
  const keys = { up: true };

  for (let f = 0; f < 60; f++) {
    const before = { ...host.ball };
    host = socStep(host, { A: keys, B: {} }, DT, {}).state;
    since += 1;

    const dV = Math.hypot(host.ball.vx - before.vx, host.ball.vy - before.vy);
    const c = host.cars.A;
    const dist = Math.hypot(host.ball.x - c.x, host.ball.y - c.y);
    const min = SOC.BALL_R + Math.max(SOC.CAR_W, SOC.CAR_H) / 2 - 4;
    const impulse = dV > 40;

    if (impulse) {
      impulseFrames.push({
        f,
        before: ballStr(before),
        after: ballStr(host.ball),
        dV: +dV.toFixed(2),
        inContact: dist <= min + 0.05,
      });
    }
    if (kickHostFrame == null && dV > 80) kickHostFrame = f;

    let packetSent = false;
    let packet = null;
    if (since >= FRAMES_PER_PACKET) {
      seq += 1;
      packet = { seq, hostFrame: f, ball: { ...host.ball } };
      since = 0;
      packetSent = true;
      latest = { ...packet.ball };
      if (kickHostFrame != null && firstPktAfterKick == null && f >= kickHostFrame) {
        firstPktAfterKick = packet;
      }
    }

    render = moveTowardBall(render, latest, DT, RATE, MAX);
    const dPos = Math.hypot(render.x - host.ball.x, render.y - host.ball.y);
    const dVel = Math.hypot(render.vx - host.ball.vx, render.vy - host.ball.vy);
    const diverged = dPos > EPS_POS || dVel > EPS_VEL;

    if (kickHostFrame != null && f >= kickHostFrame && diverged && !firstIrr) {
      firstIrr = {
        guestFrame: f,
        hostFrame: f,
        dPos: +dPos.toFixed(3),
        dVel: +dVel.toFixed(3),
        packetSentThisFrame: packetSent,
        host: ballStr(host.ball),
        guestRender: ballStr(render),
        latestAuth: ballStr(latest),
        cause:
          'Host socStep applied car→ball impulse; guest has no ball collision and latestAuth is still pre-kick (or packet is later host state).',
      };
    }

    if (kickHostFrame != null && f >= kickHostFrame - 1 && f <= kickHostFrame + 12) {
      timeline.push({
        f,
        host: ballStr(host.ball),
        impulse,
        packetSent,
        packetOriginHostFrame: packet?.hostFrame ?? null,
        packetSeq: packet?.seq ?? null,
        guestReceived: packetSent,
        guestLatest: ballStr(latest),
        guestRendered: ballStr(render),
        errVsHostPos: +dPos.toFixed(3),
        errVsHostVel: +dVel.toFixed(3),
      });
    }

    if (kickHostFrame != null && f > kickHostFrame + 20) break;
  }

  const distinctVels = [];
  const seen = new Set();
  for (const row of timeline) {
    if (row.f < kickHostFrame) continue;
    if (firstPktAfterKick && row.f > firstPktAfterKick.hostFrame) break;
    const key = `${row.host.vx},${row.host.vy}`;
    if (!seen.has(key)) {
      seen.add(key);
      distinctVels.push({ f: row.f, ...row.host });
    }
  }

  return {
    kickHostFrame,
    firstIrreversible: firstIrr,
    firstPacketAfterKick: firstPktAfterKick && {
      seq: firstPktAfterKick.seq,
      originHostFrame: firstPktAfterKick.hostFrame,
      guestFrameDisplayedAt_0RTT: firstPktAfterKick.hostFrame,
      ball: ballStr(firstPktAfterKick.ball),
      physicsFramesAfterKick: firstPktAfterKick.hostFrame - kickHostFrame,
      kickFrameStateNeverSent: firstPktAfterKick.hostFrame !== kickHostFrame,
    },
    distinctHostVelocitiesKickThroughPacket: distinctVels,
    impulseFramesInRun: impulseFrames,
    avgPhysicsFramesPerPacket: FRAMES_PER_PACKET,
    timeline,
  };
}

const result = runKick();
console.log(JSON.stringify({
  model: {
    hostHz: 60,
    snapshotHz: 1000 / SOC_NET_INTERVAL_MS,
    physicsFramesPerPacket: FRAMES_PER_PACKET,
    rttMs: 0,
    guestBallPath: 'latestAuth + moveTowardBall (no guest collision)',
  },
  ...result,
}, null, 2));
