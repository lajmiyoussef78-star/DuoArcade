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
  W: 1440, H: 900,
  MATCH_SECONDS: 90,
  POD_R: 60,
  ITEM_R: 30,
  ACC: 620, FRICTION: 3.2, MAXV: 300,
  MAG_R: 170,
  MAG_PULL: 480,
  PICK_R: 110,
  CARRY_MAX: 1,
  // Held item sits in the magnet mouth (matches drawMagneteer attach).
  MAG_HOLD: 90,
  MAG_HOLD_SIDE: 12,
  THROW_V: 470,
  ITEM_FRICTION: 1.9,
  BUMP: 0.65,
  POD_RECOIL: 0.18,
  ZONE_R: 90,
  SPAWN_EVERY: 1.05,
  FIELD_CAP: 5,
  SPAWN_MIN_DIST: 200,
  HEART_SIZE: 78,
  PTS: { heart: 1, gold: 2, bomb: -2 }
};

export const ZONES = {
  A: { x: 130, y: MH.H / 2 },
  B: { x: MH.W - 130, y: MH.H / 2 }
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

export function spawnFor(seed, n, avoid = []) {
  const rnd = mulberry32((seed ^ (n * 2654435761)) >>> 0);
  const roll = rnd();
  // Mostly hearts (pink + gold), few bombs
  const type = roll < 0.72 ? 'heart' : roll < 0.90 ? 'gold' : 'bomb';

  let x = MH.W / 2, y = MH.H / 2;
  for (let tries = 0; tries < 28; tries++) {
    const tx = 300 + rnd() * (MH.W - 600);
    const ty = 120 + rnd() * (MH.H - 240);
    const farItems = avoid.every(p => Math.hypot(p.x - tx, p.y - ty) >= MH.SPAWN_MIN_DIST);
    const farZones =
      Math.hypot(tx - ZONES.A.x, ty - ZONES.A.y) > MH.ZONE_R + 100 &&
      Math.hypot(tx - ZONES.B.x, ty - ZONES.B.y) > MH.ZONE_R + 100;
    if (farItems && farZones) { x = tx; y = ty; break; }
    if (tries === 27) { x = tx; y = ty; }
  }
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
    const free = s.items.filter(i => !i.held);
    if (free.length < MH.FIELD_CAP) {
      const sp = spawnFor(s.seed, s.spawned, free.map(i => ({ x: i.x, y: i.y })));
      s.items.push({
        id: s.nextId++, type: sp.type, x: sp.x, y: sp.y,
        vx: 0, vy: 0, held: null, born: s.t
      });
      s.events.push({ kind: 'spawn', type: sp.type, x: sp.x, y: sp.y });
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

    // Soft body bumps: pods shove free items (and get a light shove back).
    const touch = MH.POD_R + MH.ITEM_R;
    for (const r of ['A', 'B']) {
      const p = s.pods[r];
      const dx = it.x - p.x, dy = it.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= 0.001 || d >= touch) continue;
      const nx = dx / d, ny = dy / d;
      const overlap = touch - d;
      it.x += nx * overlap * 0.88;
      it.y += ny * overlap * 0.88;
      p.x -= nx * overlap * 0.12;
      p.y -= ny * overlap * 0.12;
      const rel = (p.vx - it.vx) * nx + (p.vy - it.vy) * ny;
      if (rel > 0) {
        it.vx += nx * rel * MH.BUMP;
        it.vy += ny * rel * MH.BUMP;
        p.vx -= nx * rel * MH.POD_RECOIL;
        p.vy -= ny * rel * MH.POD_RECOIL;
      }
    }

    it.vx -= it.vx * MH.ITEM_FRICTION * dt;
    it.vy -= it.vy * MH.ITEM_FRICTION * dt;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    const edge = MH.ITEM_R;
    if (it.x < edge) { it.x = edge; it.vx = Math.abs(it.vx) * 0.5; }
    if (it.x > MH.W - edge) { it.x = MH.W - edge; it.vx = -Math.abs(it.vx) * 0.5; }
    if (it.y < edge) { it.y = edge; it.vy = Math.abs(it.vy) * 0.5; }
    if (it.y > MH.H - edge) { it.y = MH.H - edge; it.vy = -Math.abs(it.vy) * 0.5; }
  }

  // Item–item bumps so hearts/bombs knock each other slightly.
  {
    const free = s.items.filter(i => !i.held);
    const min = MH.ITEM_R * 2;
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i], b = free[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d <= 0.001 || d >= min) continue;
        const nx = dx / d, ny = dy / d;
        const push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) {
          a.vx -= nx * rel * 0.45; a.vy -= ny * rel * 0.45;
          b.vx += nx * rel * 0.45; b.vy += ny * rel * 0.45;
        }
      }
    }
  }

  for (const r of ['A', 'B']) {
    const p = s.pods[r];
    p.x = Math.max(MH.POD_R, Math.min(MH.W - MH.POD_R, p.x));
    p.y = Math.max(MH.POD_R, Math.min(MH.H - MH.POD_R, p.y));
  }

  for (const r of ['A', 'B']) {
    const p = s.pods[r];
    const held = s.items.filter(i => i.held === r);
    const ang = Math.atan2(p.fy, p.fx);
    const c = Math.cos(ang), sn = Math.sin(ang);
    for (const it of held) {
      // Seat the single catch in the magnet mouth (opening faces outward).
      it.x = p.x + c * MH.MAG_HOLD - sn * MH.MAG_HOLD_SIDE;
      it.y = p.y + sn * MH.MAG_HOLD + c * MH.MAG_HOLD_SIDE;
      it.vx = 0; it.vy = 0;
    }
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
