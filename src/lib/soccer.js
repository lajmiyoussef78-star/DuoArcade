// src/lib/soccer.js — Micro Soccer data layer + PURE physics.
// The pure section (below the marker) has no imports and is unit-tested
// standalone. Uses the same Supabase project as the rest of DuoArcade.

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export const MATCH_SECONDS = 90;

export async function myRoleInDuo(code) {
  const supabase = await getClient();
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.rpc('list_my_duos', {});
  if (error) return null;
  const d = (data || []).find(x => x.code === code);
  if (!d) return null;
  return d.member_a === uid ? 'A' : d.member_b === uid ? 'B' : null;
}

export async function duoNames(code) {
  const supabase = await getClient();
  const { data } = await supabase.rpc('list_my_duos', {});
  const d = (data || []).find(x => x.code === code);
  return d ? { A: d.name_a, B: d.name_b } : { A: 'A', B: 'B' };
}

export async function loadSoccer(code) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('soccer_results').select('wins_a, wins_b, draws').eq('duo_code', code).maybeSingle();
  if (error || !data) return { a: 0, b: 0, d: 0 };
  return { a: data.wins_a, b: data.wins_b, d: data.draws };
}

export async function recordSoccer(code, winner) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('record_soccer', { p_duo_code: code, p_winner: winner });
  if (error) throw new Error(error.message);
  return data;
}

export async function soccerChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('soccer-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}

/* ================= PURE PHYSICS (no imports below this line) ================= */

export const SOC = { W: 800, H: 500, GOAL_H: 160, CAR_W: 44, CAR_H: 26, BALL_R: 13 };

export function socInitial() {
  return {
    cars: {
      A: { x: 160, y: SOC.H / 2, a: 0, v: 0 },
      B: { x: SOC.W - 160, y: SOC.H / 2, a: Math.PI, v: 0 }
    },
    ball: { x: SOC.W / 2, y: SOC.H / 2, vx: 0, vy: 0 },
    score: { A: 0, B: 0 }
  };
}

// inputs: { A:{up,down,left,right}, B:{...} } -> { state, goal:'A'|'B'|null }
export function socStep(st, inputs, dt) {
  const s = JSON.parse(JSON.stringify(st));
  for (const r of ['A', 'B']) {
    const c = s.cars[r], k = inputs[r] || {};
    const TURN = 3.4, ACC = 420, MAXV = 300, FRICTION = 1.6;
    if (k.left) c.a -= TURN * dt;
    if (k.right) c.a += TURN * dt;
    if (k.up) c.v = Math.min(MAXV, c.v + ACC * dt);
    else if (k.down) c.v = Math.max(-MAXV * 0.6, c.v - ACC * dt);
    else c.v *= Math.max(0, 1 - FRICTION * dt);
    c.x += Math.cos(c.a) * c.v * dt;
    c.y += Math.sin(c.a) * c.v * dt;
    c.x = Math.max(SOC.CAR_W / 2, Math.min(SOC.W - SOC.CAR_W / 2, c.x));
    c.y = Math.max(SOC.CAR_H / 2, Math.min(SOC.H - SOC.CAR_H / 2, c.y));
  }
  const b = s.ball;
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.vx *= Math.max(0, 1 - 0.55 * dt);
  b.vy *= Math.max(0, 1 - 0.55 * dt);
  const gTop = (SOC.H - SOC.GOAL_H) / 2, gBot = gTop + SOC.GOAL_H;
  if (b.y < SOC.BALL_R) { b.y = SOC.BALL_R; b.vy = Math.abs(b.vy); }
  if (b.y > SOC.H - SOC.BALL_R) { b.y = SOC.H - SOC.BALL_R; b.vy = -Math.abs(b.vy); }
  let goal = null;
  if (b.x < SOC.BALL_R) {
    if (b.y > gTop && b.y < gBot) goal = 'B';
    else { b.x = SOC.BALL_R; b.vx = Math.abs(b.vx); }
  }
  if (b.x > SOC.W - SOC.BALL_R) {
    if (b.y > gTop && b.y < gBot) goal = 'A';
    else { b.x = SOC.W - SOC.BALL_R; b.vx = -Math.abs(b.vx); }
  }
  for (const r of ['A', 'B']) {
    const c = s.cars[r];
    const dx = b.x - c.x, dy = b.y - c.y;
    const dist = Math.hypot(dx, dy), min = SOC.BALL_R + Math.max(SOC.CAR_W, SOC.CAR_H) / 2 - 4;
    if (dist > 0 && dist < min) {
      const nx = dx / dist, ny = dy / dist;
      const push = Math.max(120, Math.abs(c.v) * 1.15);
      b.vx = nx * push; b.vy = ny * push;
      b.x = c.x + nx * min; b.y = c.y + ny * min;
    }
  }
  if (goal) {
    s.score[goal]++;
    const fresh = socInitial();
    s.ball = fresh.ball; s.cars = fresh.cars;
  }
  return { state: s, goal };
}
