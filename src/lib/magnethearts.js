// src/lib/magnethearts.js — Magnet Hearts pure engine (+ optional SQL tally).
//
// Hearts rain onto the arena (pink = 1, gold = 2) along with bombs (-2).
// Magnet pods pull items into orbit; THROW flings them. Bank in your zone.
// 90 seconds, highest bank wins (draws allowed).

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export async function loadMagnetHearts(code) {
  try {
    const supabase = await getClient();
    const { data, error } = await supabase
      .from('magnethearts_results').select('wins_a, wins_b, draws').eq('duo_code', code).maybeSingle();
    if (error || !data) return { a: 0, b: 0, d: 0 };
    return { a: data.wins_a, b: data.wins_b, d: data.draws };
  } catch {
    return { a: 0, b: 0, d: 0 };
  }
}

export async function recordMagnetHearts(code, winner) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('record_magnethearts', {
    p_duo_code: code,
    p_winner: winner
  });
  if (error) throw new Error(error.message);
  return data;
}

/* ================= PURE ENGINE ================= */

export const MH = {
  W: 900, H: 560,
  MATCH_SECONDS: 90,
  POD_R: 20,
  ACC: 620, FRICTION: 3.2, MAXV: 300,
  MAG_R: 105,
  MAG_PULL: 480,
  PICK_R: 30,
  CARRY_MAX: 3,
  ORBIT_R: 34,
  THROW_V: 470,
  ITEM_FRICTION: 1.9,
  ZONE_R: 74,
  SPAWN_EVERY: 1.05,
  FIELD_CAP: 9,
  PTS: { heart: 1, gold: 2, bomb: -2 }
};

export const ZONES = {
  A: { x: 92, y: MH.H / 2 },
  B: { x: MH.W - 92, y: MH.H / 2 }
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function spawnFor(seed, n) {
  const rnd = mulberry32((seed ^ (n * 2654435761)) >>> 0);
  const roll = rnd();
  const type = roll < 0.58 ? 'heart' : roll < 0.8 ? 'gold' : 'bomb';
  const x = 220 + rnd() * (MH.W - 440);
  const y = 70 + rnd() * (MH.H - 140);
  return { type, x, y };
}

export function mhInitial(seed) {
  return {
    seed,
    t: 0,
    left: MH.MATCH_SECONDS,
    spawned: 0,
    nextId: 1,
    items: [],
    pods: {
      A: { x: ZONES.A.x, y: ZONES.A.y, vx: 0, vy: 0, fx: 1, fy: 0 },
      B: { x: ZONES.B.x, y: ZONES.B.y, vx: 0, vy: 0, fx: -1, fy: 0 }
    },
    score: { A: 0, B: 0 },
    over: false,
    winner: null,
    events: []
  };
}

export function mhStep(st, inputs, dt) {
  const s = JSON.parse(JSON.stringify(st));
  s.events = [];
  if (s.over) return s;
  s.t += dt;
  s.left = Math.max(0, MH.MATCH_SECONDS - s.t);

  while (s.spawned * MH.SPAWN_EVERY <= s.t) {
    const free = s.items.filter(i => !i.held).length;
    if (free < MH.FIELD_CAP) {
      const sp = spawnFor(s.seed, s.spawned);
      s.items.push({ id: s.nextId++, type: sp.type, x: sp.x, y: sp.y, vx: 0, vy: 0, held: null });
    }
    s.spawned += 1;
  }

  for (const r of ['A', 'B']) {
    const p = s.pods[r];
    const inp = inputs[r] || { x: 0, y: 0 };
    const mag = Math.hypot(inp.x, inp.y);
    if (mag > 0.01) {
      const nx = inp.x / Math.max(1, mag), ny = inp.y / Math.max(1, mag);
      p.vx += nx * MH.ACC * dt;
      p.vy += ny * MH.ACC * dt;
      p.fx = nx; p.fy = ny;
    }
    p.vx -= p.vx * MH.FRICTION * dt;
    p.vy -= p.vy * MH.FRICTION * dt;
    const v = Math.hypot(p.vx, p.vy);
    if (v > MH.MAXV) { p.vx *= MH.MAXV / v; p.vy *= MH.MAXV / v; }
    p.x = Math.max(MH.POD_R, Math.min(MH.W - MH.POD_R, p.x + p.vx * dt));
    p.y = Math.max(MH.POD_R, Math.min(MH.H - MH.POD_R, p.y + p.vy * dt));
  }

  {
    const a = s.pods.A, b = s.pods.B;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy), min = MH.POD_R * 2;
    if (d > 0 && d < min) {
      const nx = dx / d, ny = dy / d, push = (min - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const avx = a.vx, avy = a.vy;
      a.vx = b.vx * 0.7; a.vy = b.vy * 0.7;
      b.vx = avx * 0.7; b.vy = avy * 0.7;
    }
  }

  for (const r of ['A', 'B']) {
    if (!(inputs[r] && inputs[r].throw)) continue;
    const p = s.pods[r];
    const held = s.items.filter(i => i.held === r);
    for (const it of held) {
      it.held = null;
      it.cd = 0.55;
      it.vx = p.fx * MH.THROW_V + p.vx * 0.4;
      it.vy = p.fy * MH.THROW_V + p.vy * 0.4;
    }
  }

  for (const it of s.items) {
    if (it.held) continue;
    if (it.cd) it.cd = Math.max(0, it.cd - dt);
    for (const r of ['A', 'B']) {
      if (it.cd) break;
      const p = s.pods[r];
      const dx = p.x - it.x, dy = p.y - it.y;
      const d = Math.hypot(dx, dy);
      if (d < MH.MAG_R && d > 1) {
        const f = MH.MAG_PULL * (1 - d / MH.MAG_R);
        it.vx += (dx / d) * f * dt;
        it.vy += (dy / d) * f * dt;
      }
      if (d < MH.PICK_R) {
        const carrying = s.items.filter(x => x.held === r).length;
        if (carrying < MH.CARRY_MAX) { it.held = r; it.vx = 0; it.vy = 0; }
      }
    }
    if (it.held) continue;
    it.vx -= it.vx * MH.ITEM_FRICTION * dt;
    it.vy -= it.vy * MH.ITEM_FRICTION * dt;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    if (it.x < 12) { it.x = 12; it.vx = Math.abs(it.vx) * 0.5; }
    if (it.x > MH.W - 12) { it.x = MH.W - 12; it.vx = -Math.abs(it.vx) * 0.5; }
    if (it.y < 12) { it.y = 12; it.vy = Math.abs(it.vy) * 0.5; }
    if (it.y > MH.H - 12) { it.y = MH.H - 12; it.vy = -Math.abs(it.vy) * 0.5; }
  }

  for (const r of ['A', 'B']) {
    const p = s.pods[r];
    const held = s.items.filter(i => i.held === r);
    held.forEach((it, k) => {
      const ang = s.t * 2.6 + (k * Math.PI * 2) / Math.max(1, held.length);
      it.x = p.x + Math.cos(ang) * MH.ORBIT_R;
      it.y = p.y + Math.sin(ang) * MH.ORBIT_R;
      it.vx = 0; it.vy = 0;
    });
  }

  const remaining = [];
  for (const it of s.items) {
    let banked = false;
    if (!it.held) {
      for (const r of ['A', 'B']) {
        const z = ZONES[r];
        if (Math.hypot(it.x - z.x, it.y - z.y) <= MH.ZONE_R) {
          const pts = MH.PTS[it.type];
          s.score[r] += pts;
          s.events.push({ kind: it.type === 'bomb' ? 'boom' : 'bank', side: r, pts, x: it.x, y: it.y });
          banked = true;
          break;
        }
      }
    }
    if (!banked) remaining.push(it);
  }
  s.items = remaining;

  if (s.left <= 0) {
    s.over = true;
    s.winner = s.score.A > s.score.B ? 'A' : s.score.B > s.score.A ? 'B' : 'D';
  }
  return s;
}
