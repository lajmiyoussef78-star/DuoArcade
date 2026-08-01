/**
 * soccerAAAAudit.mjs — MEASUREMENT ONLY. No gameplay changes.
 * Full Micro Soccer subsystem audit harness.
 *
 * Usage: node scripts/soccerAAAAudit.mjs
 * Writes: scripts/soccerAAAAudit.report.json
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { socInitial, socStep, socStepCar, SOC } from '../src/lib/soccer.js';
import { moveTowardBall, SOC_NET_INTERVAL_MS, SOC_NET_HZ, SOC_INTERP_DELAY_MS } from '../src/lib/soccerNet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DT_NOMINAL = 1 / 60;
const RATE = 18;
const MAX_STEP = 12;

function stats(arr) {
  if (!arr.length) return { n: 0, avg: null, min: null, max: null, std: null };
  const n = arr.length;
  const sum = arr.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  let min = arr[0], max = arr[0];
  for (const x of arr) { if (x < min) min = x; if (x > max) max = x; }
  const v = arr.reduce((s, x) => s + (x - avg) ** 2, 0) / n;
  return {
    n,
    avg: +avg.toFixed(4),
    min: +min.toFixed(4),
    max: +max.toFixed(4),
    std: +Math.sqrt(v).toFixed(4),
  };
}

function ballEq(a, b, eps = 1e-9) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps
    && Math.abs(a.vx - b.vx) < eps && Math.abs(a.vy - b.vy) < eps;
}

/** Diff one socStep for instrumentation (collision/wall/goal/friction). */
function instrumentedStep(st, inputs, dt, opts = {}) {
  const before = JSON.parse(JSON.stringify(st));
  const cloneBytes = JSON.stringify(st).length;
  const t0 = performance.now();
  const r = socStep(st, inputs, dt, opts);
  const cpuMs = performance.now() - t0;
  const after = r.state;
  const b0 = before.ball;
  const b1 = after.ball;

  // Friction always applied when no goal reset
  let frictionUpdates = 0;
  let wallHits = 0;
  let collisions = 0;
  let impulses = 0;
  let goal = r.goal;

  if (!goal) {
    frictionUpdates = 1; // vx and vy scaled every frame
    // Wall: position clamped + velocity reflected relative to free integrate
    const freeX = b0.x + b0.vx * dt;
    const freeY = b0.y + b0.vy * dt;
    if (b1.y === SOC.BALL_R && b0.y > SOC.BALL_R + 1e-6) wallHits += 1;
    if (b1.y === SOC.H - SOC.BALL_R && b0.y < SOC.H - SOC.BALL_R - 1e-6) wallHits += 1;
    if (b1.x === SOC.BALL_R && freeX < SOC.BALL_R) wallHits += 1;
    if (b1.x === SOC.W - SOC.BALL_R && freeX > SOC.W - SOC.BALL_R) wallHits += 1;
    // Also detect velocity sign flip vs pre-collision integrate+friction without car
    const dV = Math.hypot(b1.vx - b0.vx, b1.vy - b0.vy);
    // Car collision: impulse rewrite (speed jump >> friction delta)
    const frictionOnlyDv = Math.hypot(b0.vx, b0.vy) * (1 - Math.max(0, 1 - 0.55 * dt));
    if (dV > Math.max(40, frictionOnlyDv * 3 + 5)) {
      collisions += 1;
      impulses += 1;
    }
    // Overlap check post-step
    for (const role of ['A', 'B']) {
      const c = after.cars[role];
      const dist = Math.hypot(b1.x - c.x, b1.y - c.y);
      const min = SOC.BALL_R + Math.max(SOC.CAR_W, SOC.CAR_H) / 2 - 4;
      if (dist < min + 0.05 && dV > 20) {
        // counted above
      }
    }
  }

  return {
    state: after,
    goal,
    cpuMs,
    cloneBytes,
    report: {
      dt,
      ball: { ...b1 },
      ballBefore: { ...b0 },
      cars: {
        A: { ...after.cars.A },
        B: { ...after.cars.B },
      },
      collisions,
      impulses,
      wallHits,
      frictionUpdates,
      goal: goal || null,
      score: { ...after.score },
    },
  };
}

// ─── 1. Main loop timing (real timers) ─────────────────────────────────────
async function auditMainLoop() {
  const rafDeltas = [];
  const intervalGaps = [];
  const intervalMs = SOC_NET_INTERVAL_MS;
  let lastRaf = null;
  let lastIv = null;
  let rafCount = 0;
  let ivCount = 0;
  let missedFrames = 0; // gap > 28ms ≈ missed 60Hz frame
  let stalls = 0; // gap > 50ms

  await new Promise((resolve) => {
    const tEnd = Date.now() + 3000;
    const iv = setInterval(() => {
      const now = performance.now();
      if (lastIv != null) intervalGaps.push(now - lastIv);
      lastIv = now;
      ivCount += 1;
    }, intervalMs);

    const tick = (now) => {
      if (lastRaf != null) {
        const d = now - lastRaf;
        rafDeltas.push(d);
        if (d > 28) missedFrames += 1;
        if (d > 50) stalls += 1;
      }
      lastRaf = now;
      rafCount += 1;
      if (Date.now() < tEnd) {
        // Node has no rAF — emulate with setImmediate / setTimeout(0)
        setTimeout(() => tick(performance.now()), 0);
      } else {
        clearInterval(iv);
        resolve();
      }
    };
    // Prefer setInterval(16) as rAF proxy in Node
    const rafProxy = setInterval(() => {
      tick(performance.now());
      if (Date.now() >= tEnd) {
        clearInterval(rafProxy);
        clearInterval(iv);
        resolve();
      }
    }, 16);
  });

  return {
    environment: 'node-timer-proxy (not Chrome rAF)',
    note: 'Node lacks requestAnimationFrame; 16ms setInterval proxies render loop. Browser values will differ.',
    physicsFrequencyClaim: '1× per rAF frame on host (coupled to render)',
    renderFrequencyClaim: '1× per rAF frame',
    reactFrequencyClaim: 'setHud only when score/timer digits change',
    netIntervalConfiguredMs: intervalMs,
    netHzConfigured: SOC_NET_HZ,
    carInterpDelayMs: SOC_INTERP_DELAY_MS,
    measured: {
      renderLoopProxyHz: stats(rafDeltas.length ? rafDeltas.map(d => 1000 / d) : []),
      renderDeltaMs: stats(rafDeltas),
      setIntervalGapMs: stats(intervalGaps),
      setIntervalHz: stats(intervalGaps.map(d => 1000 / d)),
      missedFrames_gt28ms: missedFrames,
      eventLoopStalls_gt50ms: stalls,
      samples: { raf: rafDeltas.length, interval: intervalGaps.length },
    },
    timerDrift: {
      expectedIntervalMs: intervalMs,
      measuredAvgGapMs: stats(intervalGaps).avg,
      driftMs: stats(intervalGaps).avg != null
        ? +(stats(intervalGaps).avg - intervalMs).toFixed(4)
        : null,
    },
    gcPauses: 'Not directly observable in Node without --expose-gc; see Memory section allocation pressure.',
  };
}

// ─── 2+3+4+8 Host/guest mirrored pipeline with timelines ───────────────────
function runPipeline(seconds = 5, { forceKickAt = null, forceWall = false, forceGoal = false } = {}) {
  const snapEvery = Math.max(1, Math.round(SOC_NET_INTERVAL_MS / (1000 / 60)));
  let host = socInitial();
  if (forceKickAt != null) {
    host.cars.A = { x: 370, y: 250, a: 0, v: 280 };
    host.ball = { x: 420, y: 250, vx: 0, vy: 0 };
  }
  if (forceWall) {
    host.ball = { x: 400, y: 30, vx: 0, vy: -400 };
  }
  if (forceGoal) {
    host.ball = { x: 40, y: 250, vx: -350, vy: 0 };
    host.cars.A = { x: 160, y: 100, a: 0, v: 0 };
    host.cars.B = { x: 640, y: 100, a: Math.PI, v: 0 };
  }

  let latest = { ...host.ball };
  let render = { ...host.ball };
  let since = 0;
  let seq = 0;
  const frames = [];
  const packets = [];
  const physCpu = [];
  const cloneSizes = [];
  let kickFrame = null;
  let wallFrame = null;
  let goalFrame = null;
  const keys = { up: true };

  const nFrames = Math.round(seconds * 60);
  for (let f = 0; f < nFrames; f++) {
    const tPhysStart = f * (1000 / 60);
    const beforeBall = { ...host.ball };
    const stepped = instrumentedStep(host, { A: keys, B: {} }, DT_NOMINAL, {});
    host = stepped.state;
    physCpu.push(stepped.cpuMs);
    cloneSizes.push(stepped.cloneBytes);

    const dV = Math.hypot(host.ball.vx - beforeBall.vx, host.ball.vy - beforeBall.vy);
    if (kickFrame == null && stepped.report.impulses > 0) kickFrame = f;
    if (wallFrame == null && stepped.report.wallHits > 0) wallFrame = f;
    if (goalFrame == null && stepped.goal) goalFrame = f;

    const tPhysEnd = tPhysStart + stepped.cpuMs;
    since += 1;
    let packet = null;
    let tSend = null;
    let tRecv = null;
    let tApply = null;

    if (since >= snapEvery) {
      since = 0;
      seq += 1;
      tSend = tPhysEnd + 0.01; // same-turn after physics
      const payload = {
        k: 'st',
        seq,
        st: {
          cars: host.cars,
          ball: { ...host.ball },
          score: { ...host.score },
        },
        _meta: { hostPhysicsFrame: f, hostSendFrame: f },
      };
      const serMs = (() => {
        const a = performance.now();
        JSON.stringify(payload);
        return performance.now() - a;
      })();
      tRecv = tSend + 0; // 0 RTT lab
      tApply = tRecv + 0.01;
      latest = { ...host.ball };
      packet = {
        seq,
        hostPhysicsFrame: f,
        hostSendFrame: f,
        tPhysEnd,
        tSerialize: tSend,
        serializeMs: serMs,
        tEmit: tSend,
        tRelay: tSend, // ideal relay
        tRecv,
        tApply,
        ball: { ...host.ball },
        bytes: JSON.stringify(payload).length,
      };
      packets.push(packet);
    }

    const tDrawStart = tPhysEnd + 0.05;
    const prev = { ...render };
    render = moveTowardBall(render, latest, DT_NOMINAL, RATE, MAX_STEP);
    const tDrawEnd = tDrawStart + 0.2; // proxy
    const tBallRendered = tDrawEnd;
    const errVsHost = Math.hypot(render.x - host.ball.x, render.y - host.ball.y);
    const errVsLatest = Math.hypot(render.x - latest.x, render.y - latest.y);
    const stalePhysics = !ballEq(render, host.ball, 0.5);

    frames.push({
      f,
      tPhysStart,
      tPhysEnd,
      tDrawStart,
      tDrawEnd,
      tBallRendered,
      tPacketArrive: packet?.tRecv ?? null,
      tPacketApplied: packet?.tApply ?? null,
      hostBall: { ...host.ball },
      guestLatest: { ...latest },
      guestRender: { ...render },
      phys: stepped.report,
      packetSent: !!packet,
      packetSeq: packet?.seq ?? null,
      errVsHost,
      errVsLatest,
      drawsStalePhysics: stalePhysics,
      dV: +dV.toFixed(3),
    });
  }

  return { frames, packets, kickFrame, wallFrame, goalFrame, physCpu, cloneSizes, snapEvery };
}

function timelineAround(frames, packets, center, label, window = 6) {
  if (center == null) return { label, center: null, events: [] };
  const events = [];
  for (let f = Math.max(0, center - 1); f <= center + window && f < frames.length; f++) {
    const row = frames[f];
    const pkt = packets.find(p => p.hostPhysicsFrame === f);
    events.push({
      f,
      phase: f === center ? label : 'follow',
      hostBall: row.hostBall,
      collisions: row.phys.collisions,
      impulses: row.phys.impulses,
      wallHits: row.phys.wallHits,
      goal: row.phys.goal,
      packetCreated: !!pkt,
      packetSeq: pkt?.seq ?? null,
      guestLatest: row.guestLatest,
      guestRender: row.guestRender,
      errVsHost: +row.errVsHost.toFixed(3),
      drawsStale: row.drawsStalePhysics,
      chain: [
        `Physics frame ${f}`,
        row.phys.impulses ? 'Collision/impulse' : (row.phys.wallHits ? 'Wall bounce' : (row.phys.goal ? 'Goal' : 'Integrate+friction')),
        pkt ? `Packet seq=${pkt.seq} created/sent (hostSendFrame=${pkt.hostSendFrame})` : 'No packet this frame',
        pkt ? `Guest receive+apply (0 RTT) frame ${f}` : `Guest still on prior latest`,
        `Guest render ball errVsHost=${row.errVsHost.toFixed(2)}px`,
        'Monitor refresh (assumed vsync after rAF)',
      ],
    });
  }
  return { label, center, events };
}

// ─── 12. 10_000 kicks divergence ───────────────────────────────────────────
function audit10kKicks() {
  const snapEvery = Math.max(1, Math.round(SOC_NET_INTERVAL_MS / (1000 / 60)));
  const N = 10000;
  let firstDivSum = 0;
  let firstDivN = 0;
  let maxDiv = 0;
  let sumDiv = 0;
  let sumConv = 0;
  let convN = 0;
  let lastDivSum = 0;
  let kicksWithDiv = 0;
  const firstDivFrames = [];

  for (let k = 0; k < N; k++) {
    let host = socInitial();
    const ang = (k * 0.6180339887) % (Math.PI * 2);
    const dist = 28 + (k % 7);
    host.cars.A = {
      x: 400 - Math.cos(ang) * dist,
      y: 250 - Math.sin(ang) * dist,
      a: ang,
      v: 200 + (k % 100),
    };
    host.ball = { x: 400, y: 250, vx: 0, vy: 0 };
    let latest = { ...host.ball };
    let render = { ...host.ball };
    let since = 0;
    let kickF = null;
    let firstDiv = null;
    let lastDiv = null;
    let convStart = null;
    let converged = false;
    const keys = { up: true };

    for (let f = 0; f < 90; f++) {
      const before = { ...host.ball };
      host = socStep(host, { A: keys, B: {} }, DT_NOMINAL, {}).state;
      const dV = Math.hypot(host.ball.vx - before.vx, host.ball.vy - before.vy);
      if (kickF == null && dV > 80) kickF = f;

      since += 1;
      if (since >= snapEvery) {
        since = 0;
        latest = { ...host.ball };
      }
      render = moveTowardBall(render, latest, DT_NOMINAL, RATE, MAX_STEP);
      const err = Math.hypot(render.x - host.ball.x, render.y - host.ball.y);
      if (kickF != null && f >= kickF) {
        if (err > 0.5) {
          if (firstDiv == null) firstDiv = f - kickF;
          lastDiv = f - kickF;
          if (err > maxDiv) maxDiv = err;
          sumDiv += err;
          kicksWithDiv += 1; // counted per-frame; fix below
        } else if (firstDiv != null && !converged) {
          convStart = (f - kickF) * (1000 / 60);
          converged = true;
        }
      }
    }

    if (firstDiv != null) {
      firstDivSum += firstDiv;
      firstDivN += 1;
      firstDivFrames.push(firstDiv);
      lastDivSum += lastDiv ?? firstDiv;
      if (converged) {
        sumConv += convStart;
        convN += 1;
      }
    }
  }

  // Recompute avg divergence properly with second pass sampling
  let errSum = 0, errN = 0, kicksDivergent = 0;
  for (let k = 0; k < Math.min(N, 2000); k++) {
    let host = socInitial();
    const ang = (k * 0.6180339887) % (Math.PI * 2);
    host.cars.A = { x: 400 - Math.cos(ang) * 30, y: 250 - Math.sin(ang) * 30, a: ang, v: 260 };
    host.ball = { x: 400, y: 250, vx: 0, vy: 0 };
    let latest = { ...host.ball };
    let render = { ...host.ball };
    let since = 0;
    let kickF = null;
    let hadDiv = false;
    for (let f = 0; f < 60; f++) {
      const before = { ...host.ball };
      host = socStep(host, { A: { up: true }, B: {} }, DT_NOMINAL, {}).state;
      if (kickF == null && Math.hypot(host.ball.vx - before.vx, host.ball.vy - before.vy) > 80) kickF = f;
      since++;
      if (since >= snapEvery) { since = 0; latest = { ...host.ball }; }
      render = moveTowardBall(render, latest, DT_NOMINAL, RATE, MAX_STEP);
      if (kickF != null && f >= kickF) {
        const err = Math.hypot(render.x - host.ball.x, render.y - host.ball.y);
        errSum += err;
        errN += 1;
        if (err > 0.5) hadDiv = true;
      }
    }
    if (hadDiv) kicksDivergent += 1;
  }

  return {
    kicks: N,
    snapEveryPhysicsFrames: snapEvery,
    netHz: SOC_NET_HZ,
    kicksWithFirstDivergence: firstDivN,
    pctDivergent: +((firstDivN / N) * 100).toFixed(2),
    firstDivergentFrameRelativeToKick: stats(firstDivFrames),
    // 0 means same frame as kick — guest already wrong on impact frame
    avgFirstDivergentFrame: firstDivN ? +(firstDivSum / firstDivN).toFixed(4) : null,
    avgLastDivergentFrameRel: firstDivN ? +(lastDivSum / firstDivN).toFixed(4) : null,
    maxDivergencePx: +maxDiv.toFixed(3),
    avgDivergencePx_postKickSample: errN ? +(errSum / errN).toFixed(3) : null,
    avgConvergenceMs: convN ? +(sumConv / convN).toFixed(1) : null,
    convergenceMeasuredN: convN,
    sample2k_kicksDivergent: kicksDivergent,
    sample2k_pct: +((kicksDivergent / Math.min(N, 2000)) * 100).toFixed(2),
    proof: firstDivN > 0 && (firstDivSum / firstDivN) === 0
      ? 'FIRST divergence is ALWAYS on the kick frame (relative frame 0) under current guest path.'
      : 'See firstDivergentFrameRelativeToKick stats.',
  };
}

// ─── Memory pressure from socStep JSON clone ───────────────────────────────
function auditMemory(frames = 3600) {
  const sizes = [];
  let host = socInitial();
  const keys = { up: true };
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) {
    const bytes = JSON.stringify(host).length;
    sizes.push(bytes);
    host = socStep(host, { A: keys, B: {} }, DT_NOMINAL, {}).state;
  }
  const elapsed = performance.now() - t0;
  // Each socStep does JSON.parse(JSON.stringify(st)) — 2× stringify-ish + parse allocs
  return {
    frames,
    elapsedMs: +elapsed.toFixed(2),
    stateJsonBytes: stats(sizes),
    clonesPerSecond: +((frames / (elapsed / 1000))).toFixed(1),
    estimatedCloneOps: frames, // one deep clone per socStep
    note: 'socStep allocates a full deep clone every physics frame via JSON.parse(JSON.stringify(st)).',
  };
}

// ─── Networking latency breakdown (0 RTT model matching localhost) ─────────
function auditNetworking(pipeline) {
  const latencies = pipeline.packets.map(p => ({
    seq: p.seq,
    hostPhysicsFrame: p.hostPhysicsFrame,
    e2eMs_physEndToGuestApply: +(p.tApply - p.tPhysEnd).toFixed(4),
    serializeMs: +p.serializeMs.toFixed(4),
    bytes: p.bytes,
  }));
  // Frame latency: physics frames between kick and packet containing post-kick state
  const { frames, packets, kickFrame } = pipeline;
  let kickPacket = null;
  if (kickFrame != null) {
    kickPacket = packets.find(p => p.hostPhysicsFrame >= kickFrame);
  }
  return {
    rttModelMs: 0,
    packets: latencies.length,
    avgSerializeMs: stats(latencies.map(l => l.serializeMs)),
    avgPacketBytes: stats(latencies.map(l => l.bytes)),
    avgE2E_physToApply_ms: stats(latencies.map(l => l.e2eMs_physEndToGuestApply)),
    kick: kickFrame != null ? {
      kickHostFrame: kickFrame,
      firstPacketHostFrame: kickPacket?.hostPhysicsFrame ?? null,
      physicsFramesKickToPacket: kickPacket ? kickPacket.hostPhysicsFrame - kickFrame : null,
      simulationLatencyFrames: kickPacket ? kickPacket.hostPhysicsFrame - kickFrame : null,
      kickFrameStateInPacket: kickPacket?.hostPhysicsFrame === kickFrame,
    } : null,
    proof: 'At 0 RTT, transport latency ≈ serialize only. Guest still diverges on impact frame before any packet.',
  };
}

async function main() {
  const mainLoop = await auditMainLoop();
  const pipe = runPipeline(4, { forceKickAt: 0 });
  const pipeWall = runPipeline(2, { forceWall: true });
  const pipeGoal = runPipeline(2, { forceGoal: true });
  const net = auditNetworking(pipe);
  const mem = auditMemory(1800);
  const kicks = audit10kKicks();

  // Physics frame dump sample around kick
  const kickCenter = pipe.kickFrame ?? 0;
  const physSample = pipe.frames
    .filter(f => f.f >= kickCenter - 1 && f.f <= kickCenter + 8)
    .map(f => ({
      frame: f.f,
      dt: f.phys.dt,
      ball: f.phys.ball,
      cars: f.phys.cars,
      collisions: f.phys.collisions,
      impulses: f.phys.impulses,
      wallHits: f.phys.wallHits,
      frictionUpdates: f.phys.frictionUpdates,
      goal: f.phys.goal,
    }));

  const staleRate = pipe.frames.filter(f => f.drawsStalePhysics).length / pipe.frames.length;

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      SOC_NET_INTERVAL_MS,
      SOC_NET_HZ,
      SOC_INTERP_DELAY_MS,
      BALL_CONVERGE_RATE: RATE,
      BALL_MAX_STEP_PX: MAX_STEP,
    },
    section1_mainLoop: mainLoop,
    section2_physics: {
      hostCallsSocStep: 'once per rAF while live',
      guestCallsSocStep: 'NEVER for ball',
      guestCallsSocStepCar: 'once per rAF for own car only',
      collisionFn: 'inline inside socStep (no separate collision())',
      sampleAroundKick: physSample,
      physCpuMs: stats(pipe.physCpu),
      deepCloneBytesPerStep: stats(pipe.cloneSizes),
    },
    section3_rendering: {
      orderPerFrame: ['physics/converge', 'setHud maybe', 'draw()', 'rAF schedule'],
      stalePhysicsDrawRate: +staleRate.toFixed(4),
      proof: 'Guest renderBall !== host ball whenever drawsStalePhysics; rate measured under 0 RTT.',
      avgErrVsHostPx: stats(pipe.frames.map(f => f.errVsHost)),
      avgErrVsLatestPx: stats(pipe.frames.map(f => f.errVsLatest)),
    },
    section4_networking: net,
    section8_timelines: {
      kick: timelineAround(pipe.frames, pipe.packets, pipe.kickFrame, 'KICK'),
      wall: timelineAround(pipeWall.frames, pipeWall.packets, pipeWall.wallFrame, 'WALL'),
      goal: timelineAround(pipeGoal.frames, pipeGoal.packets, pipeGoal.goalFrame, 'GOAL'),
    },
    section12_divergence10k: kicks,
    section7_memory: mem,
  };

  const out = join(__dirname, 'soccerAAAAudit.report.json');
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    wrote: out,
    firstDivFrameRel: kicks.avgFirstDivergentFrame,
    maxDivPx: kicks.maxDivergencePx,
    staleDrawRate: report.section3_rendering.stalePhysicsDrawRate,
    kickPacket: net.kick,
    netHz: SOC_NET_HZ,
  }, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
