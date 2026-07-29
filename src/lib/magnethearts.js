// src/lib/magnethearts.js — Magnet Hearts pure engine (+ optional SQL tally).
//
// Hearts rain onto the arena (pink = 1, gold = 2) along with bombs (-2).
// Magnet pods pull items into orbit; THROW flings them. Bank in your zone.
// 90 seconds, highest bank wins (draws allowed).

import { getSupabase } from './supabaseClient.js';

async function getClient() {
  return getSupabase();
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
  // Contact at the magnet mouth only — not a wide field.
  PICK_R: 98,
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
  // Matches the bomb's visual footprint (ITEM_R 30 → ~60px round body).
  HEART_SIZE: 112,
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

/**
 * @param {object} [opts]
 * @param {object} [opts.poseLock] — { A?: pod, B?: pod } owner-authored poses.
 *   Locked pods are NOT driven by input (independent move + sync).
 */
export function mhStep(st, inputs, dt, opts = {}) {
  const poseLock = opts.poseLock || {};
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
    if (poseLock[r]) {
      const src = poseLock[r];
      p.x = src.x; p.y = src.y;
      p.vx = src.vx || 0; p.vy = src.vy || 0;
      if (src.fx != null) p.fx = src.fx;
      if (src.fy != null) p.fy = src.fy;
      p.x = Math.max(MH.POD_R, Math.min(MH.W - MH.POD_R, p.x));
      p.y = Math.max(MH.POD_R, Math.min(MH.H - MH.POD_R, p.y));
      continue;
    }
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
      // Never shove a pose-locked pod — that player owns their position.
      if (!poseLock.A) { a.x -= nx * push; a.y -= ny * push; }
      if (!poseLock.B) { b.x += nx * push; b.y += ny * push; }
      if (!poseLock.A && !poseLock.B) {
        const avx = a.vx, avy = a.vy;
        a.vx = b.vx * 0.7; a.vy = b.vy * 0.7;
        b.vx = avx * 0.7; b.vy = avy * 0.7;
      }
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
      s.events.push({
        kind: 'throw', side: r, type: it.type,
        x: it.x, y: it.y, vx: it.vx, vy: it.vy
      });
    }
  }

  // One catch per magnet. While carrying, no further pickup at all.
  const carrying = { A: false, B: false };
  for (const it of s.items) {
    if (it.held === 'A') carrying.A = true;
    if (it.held === 'B') carrying.B = true;
  }

  for (const it of s.items) {
    if (it.held) continue;
    if (it.cd) it.cd = Math.max(0, it.cd - dt);
    if (!it.cd) {
      for (const r of ['A', 'B']) {
        if (carrying[r]) continue;
        const p = s.pods[r];
        const d = Math.hypot(p.x - it.x, p.y - it.y);
        if (d < MH.PICK_R) {
          it.held = r;
          it.vx = 0; it.vy = 0;
          carrying[r] = true;
          break;
        }
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
      if (!poseLock[r]) {
        p.x -= nx * overlap * 0.12;
        p.y -= ny * overlap * 0.12;
      }
      const rel = (p.vx - it.vx) * nx + (p.vy - it.vy) * ny;
      if (rel > 0) {
        it.vx += nx * rel * MH.BUMP;
        it.vy += ny * rel * MH.BUMP;
        if (!poseLock[r]) {
          p.vx -= nx * rel * MH.POD_RECOIL;
          p.vy -= ny * rel * MH.POD_RECOIL;
        }
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

  // Enforce one held item per seat; seat it in the magnet mouth only.
  for (const r of ['A', 'B']) {
    const p = s.pods[r];
    const held = s.items.filter(i => i.held === r);
    if (held.length > MH.CARRY_MAX) {
      for (let i = MH.CARRY_MAX; i < held.length; i++) {
        held[i].held = null;
        held[i].cd = 0.25;
      }
      held.length = MH.CARRY_MAX;
    }
    const ang = Math.atan2(p.fy, p.fx);
    const c = Math.cos(ang), sn = Math.sin(ang);
    for (const it of held) {
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
          s.events.push({
            kind: it.type === 'bomb' ? 'boom' : 'bank',
            side: r, pts, type: it.type, x: it.x, y: it.y
          });
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

export function cloneMh(st) {
  return JSON.parse(JSON.stringify(st));
}

/** Slim payload for RT — drop ephemeral event list. */
export function packMh(st) {
  const s = cloneMh(st);
  s.events = [];
  return s;
}

function clampPod(p) {
  p.x = Math.max(MH.POD_R, Math.min(MH.W - MH.POD_R, p.x));
  p.y = Math.max(MH.POD_R, Math.min(MH.H - MH.POD_R, p.y));
}

export function integratePod(p, inp, dt) {
  const mag = Math.hypot(inp.x || 0, inp.y || 0);
  if (mag > 0.01) {
    const nx = (inp.x || 0) / Math.max(1, mag);
    const ny = (inp.y || 0) / Math.max(1, mag);
    p.vx += nx * MH.ACC * dt;
    p.vy += ny * MH.ACC * dt;
    p.fx = nx; p.fy = ny;
  }
  p.vx -= p.vx * MH.FRICTION * dt;
  p.vy -= p.vy * MH.FRICTION * dt;
  const v = Math.hypot(p.vx, p.vy);
  if (v > MH.MAXV) { p.vx *= MH.MAXV / v; p.vy *= MH.MAXV / v; }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  clampPod(p);
}

export function seatHeld(s, r) {
  const p = s.pods[r];
  if (!p) return;
  const held = s.items.filter(i => i.held === r);
  // One item only — drop extras.
  for (let i = MH.CARRY_MAX; i < held.length; i++) {
    held[i].held = null;
    held[i].cd = 0.25;
  }
  const keep = held.slice(0, MH.CARRY_MAX);
  const ang = Math.atan2(p.fy, p.fx);
  const c = Math.cos(ang), sn = Math.sin(ang);
  for (const it of keep) {
    it.x = p.x + c * MH.MAG_HOLD - sn * MH.MAG_HOLD_SIDE;
    it.y = p.y + sn * MH.MAG_HOLD + c * MH.MAG_HOLD_SIDE;
    it.vx = 0; it.vy = 0;
  }
}

/**
 * Pure visual coast from a host snapshot — velocity/friction only.
 * No magnet pull, pickups, banks, or spawns (those are host-only).
 */
export function mhCoast(st, dt) {
  if (!st || st.over) return st;
  const s = cloneMh(st);
  s.events = [];
  for (const r of ['A', 'B']) {
    const p = s.pods[r];
    p.vx -= p.vx * MH.FRICTION * dt;
    p.vy -= p.vy * MH.FRICTION * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    clampPod(p);
  }
  for (const it of s.items) {
    if (it.held) continue;
    if (it.cd) it.cd = Math.max(0, it.cd - dt);
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
  seatHeld(s, 'A');
  seatHeld(s, 'B');
  s.t += dt;
  s.left = Math.max(0, MH.MATCH_SECONDS - s.t);
  return s;
}

/** Short extrapolate of host truth — never free-sim past ~RTT. */
export function mhExtrapolate(st, ageSec) {
  if (!st) return st;
  let left = Math.max(0, Math.min(ageSec, 0.22));
  let s = cloneMh(st);
  while (left > 0) {
    const step = Math.min(0.016, left);
    s = mhCoast(s, step);
    left -= step;
  }
  return s;
}

/**
 * Roudi: never rewind own pod. Snap only on hard desync; soft-settle when idle.
 */
export function reconcilePod(localPod, hostPod, { idle = false } = {}) {
  if (!localPod) return hostPod ? { ...hostPod } : null;
  if (!hostPod) return { ...localPod };
  const dist = Math.hypot(localPod.x - hostPod.x, localPod.y - hostPod.y);
  if (dist > 220) {
    return { ...hostPod, fx: localPod.fx, fy: localPod.fy };
  }
  if (idle) {
    const k = 0.18;
    return {
      ...localPod,
      x: localPod.x * (1 - k) + hostPod.x * k,
      y: localPod.y * (1 - k) + hostPod.y * k,
      vx: localPod.vx * (1 - k) + hostPod.vx * k,
      vy: localPod.vy * (1 - k) + hostPod.vy * k
    };
  }
  return { ...localPod };
}

/** Roudi: instant local throw feel — host still owns real release via `try`. */
export function mhLocalThrow(st, me) {
  if (!st?.pods?.[me]) return { st, ids: [] };
  const s = cloneMh(st);
  const p = s.pods[me];
  const ids = [];
  for (const it of s.items) {
    if (it.held !== me) continue;
    it.held = null;
    it.cd = 0.55;
    it.vx = p.fx * MH.THROW_V + p.vx * 0.4;
    it.vy = p.fy * MH.THROW_V + p.vy * 0.4;
    ids.push(it.id);
  }
  return { st: s, ids };
}

/** Instant local grab feel — host confirms via `grab` / `st`. */
export function mhOptimisticGrab(st, me) {
  if (!st?.pods?.[me]) return { st, id: null };
  const s = cloneMh(st);
  if (s.items.some(i => i.held === me)) return { st: s, id: null };
  const p = s.pods[me];
  let best = null, bestD = Infinity;
  for (const it of s.items) {
    if (it.held || it.cd) continue;
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d < MH.PICK_R && d < bestD) { best = it; bestD = d; }
  }
  if (!best) return { st: s, id: null };
  best.held = me;
  best.vx = 0; best.vy = 0;
  seatHeld(s, me);
  return { st: s, id: best.id };
}

/** Host confirm grab from peer (pose-near + free item). */
export function mhApplyGrab(st, by, itemId, pose) {
  const s = cloneMh(st);
  if (pose && s.pods?.[by]) {
    s.pods[by] = {
      ...s.pods[by],
      x: pose.x, y: pose.y,
      vx: pose.vx || 0, vy: pose.vy || 0,
      fx: pose.fx ?? s.pods[by].fx,
      fy: pose.fy ?? s.pods[by].fy
    };
    clampPod(s.pods[by]);
  }
  if (s.items.some(i => i.held === by)) return { st: s, ok: false };
  const it = s.items.find(i => i.id === itemId);
  if (!it || it.held) return { st: s, ok: false };
  const p = s.pods[by];
  if (!p || Math.hypot(it.x - p.x, it.y - p.y) > MH.PICK_R * 1.4) {
    return { st: s, ok: false };
  }
  it.held = by;
  it.vx = 0; it.vy = 0;
  seatHeld(s, by);
  return { st: s, ok: true };
}

/**
 * Symmetric view for A and B (Roudi A=B):
 * host items/score + own local pod + peer pose (not st.pods for opponent).
 */
export function mhComposeView(hostSnap, me, localPod, peerPose, pendingThrow, pendingGrab) {
  if (!hostSnap) return null;
  const view = cloneMh(hostSnap);
  const opp = me === 'A' ? 'B' : 'A';
  if (localPod) view.pods[me] = { ...localPod };
  if (peerPose) view.pods[opp] = { ...peerPose };

  // Optimistic throw wins over pending grab for the same item.
  const throwIds = new Set(pendingThrow?.ids || []);

  if (pendingGrab?.id != null && !throwIds.has(pendingGrab.id)) {
    const hostHas = (view.items || []).some(i => i.id === pendingGrab.id && i.held === me);
    if (!hostHas && pendingGrab.item) {
      view.items = (view.items || [])
        .filter(i => i.id !== pendingGrab.id)
        .concat([{ ...pendingGrab.item, held: me, vx: 0, vy: 0 }]);
    }
  }

  // Keep local flight until cleared — do NOT snap to late host trajectory mid-air.
  if (pendingThrow?.ids?.length && pendingThrow.localItems?.length) {
    view.items = (view.items || [])
      .filter(i => !throwIds.has(i.id))
      .concat(pendingThrow.localItems.map(i => ({ ...i, held: null })));
  }

  seatHeld(view, me);
  seatHeld(view, opp);
  return view;
}

/**
 * Drop optimistic throw once host has released and trajectories are close,
 * or after a hard timeout. Never clear while host still shows held (lag snap).
 */
export function mhPendingThrowDone(pending, hostSnap, me, now = performance.now()) {
  if (!pending?.ids?.length) return true;
  const age = now - (pending.at || now);
  if (age > 1100) return true;
  const hostItems = hostSnap?.items || [];
  const stillHeld = hostItems.some(
    i => i.held === me && pending.ids.includes(i.id)
  );
  if (stillHeld) return false;
  // Host released — adopt when close, or after a short grace so we don't hitch.
  if (age > 420) return true;
  if (!pending.localItems?.length) return true;
  for (const li of pending.localItems) {
    const hi = hostItems.find(i => i.id === li.id);
    if (!hi || hi.held) return false;
    if (Math.hypot(li.x - hi.x, li.y - hi.y) > 90) return false;
  }
  return true;
}

/**
 * FIXBUG soft authority merge.
 * - Score / winner / holds from authority; clock NEVER rewinds (authority snap
 *   is ~RTT old — pulling t/spawned back stutters local spawns and the timer).
 * - Never rewind my hold or my in-flight throw.
 * - Free items keep full local physics when close (no stale-velocity drag).
 * - Local spawns the old snapshot doesn't know yet are kept, not deleted.
 */
export function mhReconcileDual(local, host, me, { protectIds } = {}) {
  if (!host) return local;
  if (!local) return cloneMh(host);
  const s = cloneMh(local);
  const protect = new Set(protectIds || []);

  s.score = { A: host.score.A, B: host.score.B };
  // Monotonic clock: adopt authority time only when we're behind it.
  s.t = Math.max(local.t, host.t);
  s.left = Math.max(0, MH.MATCH_SECONDS - s.t);
  s.spawned = Math.max(local.spawned, host.spawned);
  s.nextId = Math.max(local.nextId, host.nextId);
  s.over = host.over;
  s.winner = host.winner;

  const localById = new Map((s.items || []).map(i => [i.id, i]));
  const merged = [];
  const seen = new Set();

  for (const hi of (host.items || [])) {
    const li = localById.get(hi.id);
    seen.add(hi.id);

    // In-flight throw: keep local free flight.
    if (protect.has(hi.id) && li) {
      merged.push({ ...li, held: null });
      continue;
    }

    if (!li) {
      merged.push({ ...hi });
      continue;
    }

    // Own hold: never snap back to free (independent act).
    if (li.held === me && hi.held !== me && !hi.held) {
      merged.push({ ...li, held: me, vx: 0, vy: 0 });
      continue;
    }

    // Someone else holds on authority — adopt.
    if (hi.held && hi.held !== me) {
      merged.push({ ...hi });
      continue;
    }

    // Authority confirms I hold — keep local item (seatHeld will place it).
    if (hi.held === me) {
      merged.push({ ...li, held: me, vx: 0, vy: 0 });
      continue;
    }

    // Both free: local trajectory wins unless hard desync — no velocity drag.
    const d = Math.hypot(li.x - hi.x, li.y - hi.y);
    merged.push(d > 200 ? { ...hi, held: null } : { ...li, held: null });
  }

  for (const li of (s.items || [])) {
    if (seen.has(li.id)) continue;
    // Keep: own hold, own in-flight throw, and spawns the authority hasn't
    // reached yet (its nextId is behind). If authority knows the id but no
    // longer lists it, it was banked — drop it then, never before.
    const notSpawnedThere = li.id >= (host.nextId ?? 0);
    if (protect.has(li.id) || li.held === me || notSpawnedThere) {
      merged.push(li.held === me ? { ...li } : { ...li, held: null });
    }
  }

  s.items = merged;
  return s;
}

/** @deprecated use mhComposeView */
export function mhAdoptHostWorld(hostSnap, me, localPod, pendingThrow) {
  return mhComposeView(hostSnap, me, localPod, null, pendingThrow, null);
}
