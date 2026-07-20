// src/lib/loopduel.js — Loop Duel PURE racing physics.
//
// One-button drift racing on a stadium circuit. Cars drive themselves;
// HOLD turns right (racing direction is clockwise), release goes straight.
// Off the asphalt you crawl through the dark grass. Host-authoritative
// like Micro Soccer: side A simulates, B streams its hold.

export const LD = {
  W: 900, H: 560,
  CX: 450, CY: 280,
  L: 190,              // half-length of the straights (spine from CX-L to CX+L)
  R: 150,              // centerline radius around the spine
  TRACK_HALF: 54,      // half-width of the asphalt
  CAR_R: 13,
  MAXV: 315,           // asphalt top speed
  GRASS_MAXV: 95,      // crawling in the grass
  ACC: 260,
  TURN: 3.05,          // rad/s while holding
  OIL_TURN: 0.42,      // turn multiplier inside the oil slick
  BOOST_V: 1.5,        // boost speed multiplier
  BOOST_MS: 900,
  LAPS: 5
};

// Decorations & hazards (positions in track space).
export const TIRES = [
  { x: LD.CX - LD.L - LD.R + 26, y: LD.CY - 78, r: 15 },
  { x: LD.CX + LD.L + LD.R - 26, y: LD.CY + 78, r: 15 },
  { x: LD.CX + 60, y: LD.CY - LD.R - LD.TRACK_HALF + 20, r: 14 }
];
export const OIL = { x: LD.CX - 120, y: LD.CY + LD.R, rx: 52, ry: 26 };   // bottom straight
export const BOOST = { x1: LD.CX + 30, x2: LD.CX + 130, half: LD.TRACK_HALF, y: LD.CY - LD.R }; // top straight pads

// Distance from a point to the spine segment (CX-L,CY)-(CX+L,CY).
export function distToSpine(x, y) {
  const sx = Math.max(LD.CX - LD.L, Math.min(LD.CX + LD.L, x));
  return Math.hypot(x - sx, y - LD.CY);
}

export function onTrack(x, y) {
  return Math.abs(distToSpine(x, y) - LD.R) <= LD.TRACK_HALF;
}

// Progress along the centerline, clockwise, s in [0, perimeter).
// s = 0 at the finish line: top-center, racing to the RIGHT.
export function perimeter() { return 4 * LD.L + 2 * Math.PI * LD.R; }

export function progressOf(x, y) {
  const P = perimeter();
  const { CX, CY, L, R } = LD;
  if (x >= CX - L && x <= CX + L) {
    if (y <= CY) {
      // top straight: rightward
      const s = x - CX;
      return s >= 0 ? s : P + s;      // left half of top straight = end of lap
    }
    // bottom straight: leftward
    return L + Math.PI * R + (CX + L - x);
  }
  if (x > CX + L) {
    // right cap: clockwise from top (angle 0 at straight-up)
    const th = Math.atan2(y - CY, x - (CX + L));   // -pi/2 at top .. +pi/2 at bottom
    return L + (th + Math.PI / 2) * R;
  }
  // left cap: clockwise from bottom to top
  const th = Math.atan2(y - CY, x - (CX - L));      // +pi/2 bottom .. (+-pi) mid .. -pi/2 top
  const a = th > 0 ? th : th + 2 * Math.PI;         // pi/2 .. 3pi/2
  return L + Math.PI * R + 2 * L + (a - Math.PI / 2) * R;
}

export function inOil(x, y) {
  const dx = (x - OIL.x) / OIL.rx, dy = (y - OIL.y) / OIL.ry;
  return dx * dx + dy * dy <= 1;
}
export function inBoost(x, y) {
  return x >= BOOST.x1 && x <= BOOST.x2 && Math.abs(y - BOOST.y) <= BOOST.half;
}

export function ldInitial() {
  return {
    cars: {
      A: { x: LD.CX - 34, y: LD.CY - LD.R + 18, a: 0, v: 0, lap: 0, half: false, boostT: 0, prevS: 0 },
      B: { x: LD.CX - 34, y: LD.CY - LD.R - 18, a: 0, v: 0, lap: 0, half: false, boostT: 0, prevS: 0 }
    },
    winner: null,
    t: 0
  };
}

// inputs: { A: bool(hold), B: bool } — returns { state, lapped: 'A'|'B'|null }
export function ldStep(st, inputs, dt) {
  const s = JSON.parse(JSON.stringify(st));
  s.t += dt;
  const P = perimeter();
  let lapped = null;

  for (const r of ['A', 'B']) {
    const c = s.cars[r];
    const hold = !!inputs[r];
    const track = onTrack(c.x, c.y);
    const oil = inOil(c.x, c.y);

    // steering: hold turns clockwise (right); oil murders your grip
    if (hold) c.a += LD.TURN * (oil ? LD.OIL_TURN : 1) * dt;

    // throttle toward target speed
    c.boostT = Math.max(0, c.boostT - dt);
    let target = track ? LD.MAXV : LD.GRASS_MAXV;
    if (c.boostT > 0) target *= LD.BOOST_V;
    if (c.v < target) c.v = Math.min(target, c.v + LD.ACC * dt);
    else c.v = Math.max(target, c.v - LD.ACC * 1.6 * dt);

    c.x += Math.cos(c.a) * c.v * dt;
    c.y += Math.sin(c.a) * c.v * dt;

    // hard outer bounds (never leave the world)
    c.x = Math.max(LD.CAR_R, Math.min(LD.W - LD.CAR_R, c.x));
    c.y = Math.max(LD.CAR_R, Math.min(LD.H - LD.CAR_R, c.y));

    // boost pads
    if (inBoost(c.x, c.y)) c.boostT = LD.BOOST_MS / 1000;

    // tire stacks: circle bounce
    for (const tt of TIRES) {
      const dx = c.x - tt.x, dy = c.y - tt.y;
      const d = Math.hypot(dx, dy), min = LD.CAR_R + tt.r;
      if (d > 0 && d < min) {
        const nx = dx / d, ny = dy / d;
        c.x = tt.x + nx * min; c.y = tt.y + ny * min;
        c.v *= 0.45;
      }
    }

    // lap progress: half-checkpoint (bottom-center) then finish (top-center)
    const sNow = progressOf(c.x, c.y);
    const half = P / 2;
    if (c.prevS < half && sNow >= half) c.half = true;
    if (c.prevS > P * 0.8 && sNow < P * 0.2 && c.half && track) {
      c.lap += 1;
      c.half = false;
      if (!s.winner) lapped = r;
      if (c.lap >= LD.LAPS && !s.winner) s.winner = r;
    }
    c.prevS = sNow;
  }

  // car-car bump
  const a = s.cars.A, b = s.cars.B;
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy), min = LD.CAR_R * 2;
  if (d > 0 && d < min) {
    const nx = dx / d, ny = dy / d, push = (min - d) / 2;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
    const va = a.v, vb = b.v;
    a.v = vb * 0.82; b.v = va * 0.82;
  }

  return { state: s, lapped };
}
