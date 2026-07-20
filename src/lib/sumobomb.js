// src/lib/sumobomb.js — Sumo Bomb pure engine (+ optional SQL tally).
//
// Eight sumos on a ring — four yours, four your partner's, alternating.
// The center cannon fires the bomb at a random sumo. The holder's aim
// sweeps; tap to throw along the arrow. Hidden fuse (5–20s). Best of 5.

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export async function loadSumoBomb(code) {
  try {
    const supabase = await getClient();
    const { data, error } = await supabase
      .from('sumobomb_results').select('wins_a, wins_b').eq('duo_code', code).maybeSingle();
    if (error || !data) return { a: 0, b: 0 };
    return { a: data.wins_a, b: data.wins_b };
  } catch {
    return { a: 0, b: 0 };
  }
}

export async function recordSumoBomb(code, winner) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('record_sumobomb', { p_duo_code: code, p_winner: winner });
  if (error) throw new Error(error.message);
  return data;
}

/* ================= PURE ENGINE ================= */

export const SB = {
  W: 900, H: 560,
  CX: 450, CY: 280,
  RING_R: 192,
  N_SUMOS: 8,
  SUMO_R: 30,
  HIT_R: 38,
  AIM_VEL: 2.5,
  FLY_V: 720,
  MISS_DUR: 0.75,
  SPIN_T: 1.6,
  BOOM_T: 1.5,
  FUSE_MIN: 5, FUSE_MAX: 20,
  WIN_SCORE: 3
};

export function sumoPos(i) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / SB.N_SUMOS;
  return { x: SB.CX + Math.cos(a) * SB.RING_R, y: SB.CY + Math.sin(a) * SB.RING_R, a };
}

export function ownerOf(i) { return i % 2 === 0 ? 'A' : 'B'; }

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roundSetup(seed, round) {
  const rnd = mulberry32((seed ^ (round * 2654435761)) >>> 0);
  return {
    fuse: SB.FUSE_MIN + rnd() * (SB.FUSE_MAX - SB.FUSE_MIN),
    target0: Math.floor(rnd() * SB.N_SUMOS),
    aim0: rnd() * Math.PI * 2
  };
}

export function targetOf(fromIdx, angle) {
  const from = sumoPos(fromIdx);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = null, bestProj = Infinity;
  for (let j = 0; j < SB.N_SUMOS; j++) {
    if (j === fromIdx) continue;
    const p = sumoPos(j);
    const vx = p.x - from.x, vy = p.y - from.y;
    const proj = vx * dx + vy * dy;
    if (proj <= 8) continue;
    const perp = Math.sqrt(Math.max(0, vx * vx + vy * vy - proj * proj));
    if (perp <= SB.HIT_R && proj < bestProj) { best = j; bestProj = proj; }
  }
  return best;
}

export function sbInitial(seed) {
  const st = {
    seed,
    round: 0,
    score: { A: 0, B: 0 },
    phase: 'spin',
    phaseT: 0,
    bombAt: null,
    transit: null,
    aim: 0,
    fuse: 0,
    fuseT: 0,
    boomIdx: null,
    pendingBoom: false,
    winner: null
  };
  applyRoundSetup(st);
  return st;
}

function applyRoundSetup(st) {
  const su = roundSetup(st.seed, st.round);
  st.fuse = su.fuse;
  st.fuseT = 0;
  st.aim = su.aim0;
  st.bombAt = null;
  st.transit = null;
  st.boomIdx = null;
  st.pendingBoom = false;
  st.phase = 'spin';
  st.phaseT = 0;
  st.target0 = su.target0;
}

function beginTransit(st, x0, y0, toIdx, miss, angle) {
  if (miss) {
    st.transit = {
      x0, y0,
      x1: x0 + Math.cos(angle) * 250,
      y1: y0 + Math.sin(angle) * 250,
      t: 0, dur: SB.MISS_DUR, toIdx, miss: true
    };
  } else {
    const p = sumoPos(toIdx);
    const d = Math.hypot(p.x - x0, p.y - y0);
    st.transit = {
      x0, y0, x1: p.x, y1: p.y, t: 0,
      dur: Math.max(0.16, Math.min(0.6, d / SB.FLY_V)),
      toIdx, miss: false
    };
  }
}

export function sbStep(st, throws, dt) {
  const s = JSON.parse(JSON.stringify(st));
  if (s.phase === 'over') return s;
  s.phaseT += dt;

  if (s.phase === 'live') s.fuseT += dt;

  switch (s.phase) {
    case 'spin': {
      if (s.phaseT >= SB.SPIN_T) {
        beginTransit(s, SB.CX, SB.CY, s.target0, false, 0);
        s.phase = 'launch';
        s.phaseT = 0;
      }
      break;
    }
    case 'launch': {
      s.transit.t += dt;
      if (s.transit.t >= s.transit.dur) {
        s.bombAt = s.transit.toIdx;
        s.transit = null;
        s.phase = 'live';
        s.phaseT = 0;
      }
      break;
    }
    case 'live': {
      if (s.transit) {
        s.transit.t += dt;
        if (s.transit.t >= s.transit.dur) {
          const arrived = s.transit.toIdx;
          const wasMiss = s.transit.miss;
          s.transit = null;
          s.bombAt = arrived;
          if (s.pendingBoom || s.fuseT >= s.fuse) return explode(s, arrived);
          if (!wasMiss) {
            s.aim = mulberry32((s.seed ^ (arrived * 7919) ^ Math.floor(s.fuseT * 1000)) >>> 0)() * Math.PI * 2;
          }
        }
      } else {
        s.aim = (s.aim + SB.AIM_VEL * dt) % (Math.PI * 2);
        if (s.fuseT >= s.fuse) return explode(s, s.bombAt);
        for (const th of throws || []) {
          if (s.bombAt == null) break;
          if (ownerOf(s.bombAt) !== th.by) continue;
          const from = sumoPos(s.bombAt);
          const tgt = targetOf(s.bombAt, th.angle);
          beginTransit(s, from.x, from.y, tgt == null ? s.bombAt : tgt, tgt == null, th.angle);
          if (s.fuseT >= s.fuse) s.pendingBoom = true;
          s.bombAt = null;
          break;
        }
      }
      if (s.transit && s.fuseT >= s.fuse) s.pendingBoom = true;
      break;
    }
    case 'boom': {
      if (s.phaseT >= SB.BOOM_T) {
        if (s.score.A >= SB.WIN_SCORE || s.score.B >= SB.WIN_SCORE) {
          s.phase = 'over';
          s.winner = s.score.A >= SB.WIN_SCORE ? 'A' : 'B';
        } else {
          s.round += 1;
          applyRoundSetup(s);
        }
      }
      break;
    }
    default: break;
  }
  return s;
}

function explode(s, idx) {
  s.boomIdx = idx;
  s.bombAt = null;
  s.transit = null;
  const loser = ownerOf(idx);
  const winner = loser === 'A' ? 'B' : 'A';
  s.score[winner] += 1;
  s.phase = 'boom';
  s.phaseT = 0;
  return s;
}
