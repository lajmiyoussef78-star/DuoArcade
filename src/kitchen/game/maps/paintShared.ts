import type Phaser from "phaser";

/** Shared canvas drawing helpers — RSC cartoon kitchen props. */

export const INK = "#2b1d14";

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: boolean,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

export function strokeInk(ctx: CanvasRenderingContext2D, width = 4) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
}

export function drawWoodFloor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base = "#c49a6c",
) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  const shades = ["#b8895a", "#c49a6c", "#a67848", "#d2a878", "#9a6b42", "#c9a06e"];
  const plankH = 18;
  for (let yy = y, row = 0; yy < y + h; yy += plankH, row++) {
    let xx = x + ((row % 2) * 28);
    while (xx < x + w + 40) {
      const pw = 48 + ((row * 7 + Math.floor(xx)) % 5) * 6;
      ctx.fillStyle = shades[(row + Math.floor(xx / 40)) % shades.length]!;
      ctx.fillRect(xx, yy, Math.min(pw, x + w - xx), plankH - 1);
      // knot / wear
      if ((row + xx) % 9 === 0) {
        ctx.fillStyle = "rgba(80,50,25,0.18)";
        ctx.beginPath();
        ctx.ellipse(xx + pw * 0.4, yy + 8, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      xx += pw + 1;
    }
    ctx.strokeStyle = "rgba(80,50,25,0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, yy + plankH - 0.5);
    ctx.lineTo(x + w, yy + plankH - 0.5);
    ctx.stroke();
  }
}

/** Soft dirt scuff near cooking stations. */
export function drawFloorDirt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(90,60,30,0.14)";
  for (let i = 0; i < 8; i++) {
    const px = x + Math.random() * w;
    const py = y + Math.random() * h;
    ctx.beginPath();
    ctx.ellipse(px, py, 8 + Math.random() * 14, 3 + Math.random() * 5, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawMarbleCounter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 6, w * 0.42, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x, y + h * 0.4, w, h * 0.6, 10, true);
  ctx.fillStyle = "#eceff1";
  roundRect(ctx, x - 3, y, w + 6, h * 0.48, 12, true);
  ctx.strokeStyle = "rgba(120,144,156,0.45)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 8 + i * 18, y + 6);
    ctx.bezierCurveTo(x + 20 + i * 16, y + 14, x + 10 + i * 20, y + 22, x + 30 + i * 14, y + 28);
    ctx.stroke();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x - 3, y, w + 6, h * 0.48, 12, false);
}

export function drawDarkCookCounter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 6, w * 0.42, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#455a64";
  roundRect(ctx, x, y + h * 0.4, w, h * 0.6, 10, true);
  ctx.fillStyle = "#263238";
  roundRect(ctx, x - 3, y, w + 6, h * 0.48, 12, true);
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x + 8, y + 8, w - 16, h * 0.16, 4, true);
  strokeInk(ctx, 3);
  roundRect(ctx, x - 3, y, w + 6, h * 0.48, 12, false);
}

/** Dining-area props: plants, candles, salt/pepper, bread, pictures, lamps. */
export function drawDiningDecor(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // plant pot
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(cx - 150, cy + 70, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, cx - 158, cy + 50, 16, 18, 3, true);
  ctx.fillStyle = "#2e7d32";
  ctx.beginPath();
  ctx.ellipse(cx - 150, cy + 42, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#66bb6a";
  ctx.beginPath();
  ctx.ellipse(cx - 144, cy + 38, 8, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // second plant
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, cx + 142, cy + 52, 16, 16, 3, true);
  ctx.fillStyle = "#43a047";
  ctx.beginPath();
  ctx.ellipse(cx + 150, cy + 44, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // bread basket between tables
  ctx.fillStyle = "#a1887f";
  roundRect(ctx, cx - 18, cy + 20, 36, 14, 6, true);
  ctx.fillStyle = "#ffe0b2";
  roundRect(ctx, cx - 12, cy + 14, 10, 8, 3, true);
  roundRect(ctx, cx + 2, cy + 12, 12, 9, 3, true);
  strokeInk(ctx, 2);
  roundRect(ctx, cx - 18, cy + 20, 36, 14, 6, false);

  // hanging lamp glow
  for (const lx of [cx - 80, cx + 80]) {
    ctx.fillStyle = "rgba(255,213,79,0.12)";
    ctx.beginPath();
    ctx.moveTo(lx - 4, cy - 40);
    ctx.lineTo(lx + 4, cy - 40);
    ctx.lineTo(lx + 36, cy + 50);
    ctx.lineTo(lx - 36, cy + 50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff8e1";
    roundRect(ctx, lx - 10, cy - 48, 20, 10, 4, true);
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.arc(lx, cy - 36, 6, 0, Math.PI * 2);
    ctx.fill();
    strokeInk(ctx, 2);
    ctx.beginPath();
    ctx.arc(lx, cy - 36, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, cy - 70);
    ctx.lineTo(lx, cy - 48);
    ctx.stroke();
  }
}

export function drawWallWindow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#4fc3f7";
  roundRect(ctx, x, y, 48, 28, 4, true);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, x + 4, y + 4, 18, 10, 2, true);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, 48, 28, 4, false);
  ctx.beginPath();
  ctx.moveTo(x + 24, y);
  ctx.lineTo(x + 24, y + 28);
  ctx.moveTo(x, y + 14);
  ctx.lineTo(x + 48, y + 14);
  ctx.stroke();
}

export function drawWallPicture(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x, y, 28, 22, 3, true);
  ctx.fillStyle = "#ffe0b2";
  roundRect(ctx, x + 3, y + 3, 22, 16, 2, true);
  ctx.fillStyle = "#ef6c00";
  ctx.beginPath();
  ctx.arc(x + 14, y + 11, 5, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 2);
  roundRect(ctx, x, y, 28, 22, 3, false);
}

export function drawTableCondiments(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // salt / pepper
  ctx.fillStyle = INK;
  roundRect(ctx, x - 8, y - 4, 6, 10, 2, true);
  roundRect(ctx, x + 2, y - 4, 6, 10, 2, true);
  ctx.fillStyle = "#fafafa";
  roundRect(ctx, x - 7, y - 3, 4, 8, 1, true);
  ctx.fillStyle = "#424242";
  roundRect(ctx, x + 3, y - 3, 4, 8, 1, true);
  // napkin
  ctx.fillStyle = "#e3f2fd";
  roundRect(ctx, x + 12, y - 2, 10, 8, 2, true);
  strokeInk(ctx, 1.5);
  roundRect(ctx, x + 12, y - 2, 10, 8, 2, false);
}

export function drawRestaurantLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = "rgba(93,64,55,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 70, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(93,64,55,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 62, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(93,64,55,0.45)";
  ctx.font = "bold 11px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GASTRONOMICA", cx, cy + 4);
}

export function drawCheckerPad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  light = "#eef7ff",
  dark = "#5dade2",
) {
  ctx.fillStyle = "#d6ecf8";
  roundRect(ctx, x, y, w, h, 16, true);
  const step = 14;
  for (let yy = y + 5; yy < y + h - 5; yy += step) {
    for (let xx = x + 5; xx < x + w - 5; xx += step) {
      ctx.fillStyle = ((xx + yy) / step) % 2 < 1 ? light : dark;
      ctx.fillRect(xx, yy, step - 1, step - 1);
    }
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 16, false);
}

export function drawCounterIsland(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  top = "#e8c9a0",
  face = "#4fc3f7",
) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 6, (w * 0.9) / 2, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = face;
  roundRect(ctx, x, y + h * 0.4, w, h * 0.6, 12, true);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  for (let i = 0; i < Math.max(2, Math.floor(w / 40)); i++) {
    ctx.fillRect(x + 10 + i * 36, y + h * 0.5, 12, 12);
  }

  ctx.fillStyle = top;
  roundRect(ctx, x - 4, y, w + 8, h * 0.5, 14, true);
  ctx.fillStyle = "#fff3e0";
  roundRect(ctx, x + 6, y + 6, w - 12, h * 0.18, 6, true);
  strokeInk(ctx, 4);
  roundRect(ctx, x - 4, y, w + 8, h * 0.5, 14, false);
  roundRect(ctx, x, y + h * 0.4, w, h * 0.6, 12, false);
}

export function drawSteelCounter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 4, w * 0.42, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#78909c";
  roundRect(ctx, x, y + h * 0.38, w, h * 0.62, 8, true);
  ctx.fillStyle = "#eceff1";
  roundRect(ctx, x - 2, y, w + 4, h * 0.48, 8, true);
  ctx.fillStyle = "#cfd8dc";
  roundRect(ctx, x + 8, y + 8, w - 16, h * 0.18, 4, true);
  strokeInk(ctx, 3);
  roundRect(ctx, x - 2, y, w + 4, h * 0.48, 8, false);
  roundRect(ctx, x, y + h * 0.38, w, h * 0.62, 8, false);
}

/** Rustic stone oven — arched fire mouth, chimney, cartoon RSC style. */
export function drawOven(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x + 46, y + 92, 48, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // chimney stack
  ctx.fillStyle = INK;
  roundRect(ctx, x + 58, y - 6, 28, 28, 4, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 60, y - 4, 24, 24, 3, true);
  ctx.fillStyle = "#6d4c41";
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, x + 62, y + 2 + i * 6, 20, 4, 1, true);
  }
  // chimney lip
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x + 56, y - 10, 32, 8, 3, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x + 56, y - 10, 32, 8, 3, false);

  // smoke puffs
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (const [sx, sy, r] of [
    [x + 68, y - 16, 5],
    [x + 78, y - 24, 6],
    [x + 64, y - 28, 4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // main stone body
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 10, 92, 78, 14, true);
  // warm stone gradient bands
  ctx.fillStyle = "#a1887f";
  roundRect(ctx, x + 3, y + 13, 86, 72, 12, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 6, y + 18, 80, 62, 10, true);

  // brick pattern
  ctx.fillStyle = "#bcaaa4";
  for (let row = 0; row < 7; row++) {
    const oy = y + 20 + row * 9;
    const ox = (row % 2) * 8;
    for (let col = 0; col < 4; col++) {
      roundRect(ctx, x + 8 + ox + col * 20, oy, 17, 7, 2, true);
    }
  }

  // darker mortar outline on body
  strokeInk(ctx, 4);
  roundRect(ctx, x, y + 10, 92, 78, 14, false);

  // arched fire mouth (dark recess)
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 78);
  ctx.lineTo(x + 18, y + 48);
  ctx.quadraticCurveTo(x + 46, y + 22, x + 74, y + 48);
  ctx.lineTo(x + 74, y + 78);
  ctx.closePath();
  ctx.fill();

  // inner arch glow
  const grad = ctx.createRadialGradient(x + 46, y + 68, 4, x + 46, y + 62, 28);
  grad.addColorStop(0, "#fff59d");
  grad.addColorStop(0.35, "#ffab00");
  grad.addColorStop(0.7, "#ff6d00");
  grad.addColorStop(1, "#bf360c");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 76);
  ctx.lineTo(x + 22, y + 50);
  ctx.quadraticCurveTo(x + 46, y + 28, x + 70, y + 50);
  ctx.lineTo(x + 70, y + 76);
  ctx.closePath();
  ctx.fill();

  // flame tongues
  for (const [fx, fy, fw, fh, col] of [
    [x + 34, y + 58, 10, 18, "#ffee58"],
    [x + 46, y + 52, 12, 24, "#fff176"],
    [x + 58, y + 60, 9, 16, "#ffca28"],
    [x + 40, y + 62, 8, 14, "#ffffff"],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(fx, fy + fh);
    ctx.quadraticCurveTo(fx - fw / 2, fy + fh * 0.4, fx, fy);
    ctx.quadraticCurveTo(fx + fw / 2, fy + fh * 0.4, fx, fy + fh);
    ctx.fill();
  }

  // stone arch rim
  ctx.strokeStyle = "#efebe9";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 78);
  ctx.lineTo(x + 18, y + 48);
  ctx.quadraticCurveTo(x + 46, y + 22, x + 74, y + 48);
  ctx.lineTo(x + 74, y + 78);
  ctx.stroke();
  strokeInk(ctx, 3);
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 78);
  ctx.lineTo(x + 18, y + 48);
  ctx.quadraticCurveTo(x + 46, y + 22, x + 74, y + 48);
  ctx.lineTo(x + 74, y + 78);
  ctx.stroke();

  // wood logs in mouth
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x + 28, y + 70, 18, 6, 2, true);
  roundRect(ctx, x + 46, y + 72, 16, 5, 2, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 30, y + 71, 14, 3, 1, true);

  // ivy on top-left
  ctx.fillStyle = "#2e7d32";
  ctx.beginPath();
  ctx.ellipse(x + 14, y + 14, 10, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#66bb6a";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 10, 8, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 8, y + 20, 6, 4, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // small "OVEN" plate
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 30, y + 82, 32, 10, 3, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x + 30, y + 82, 32, 10, 3, false);
  ctx.fillStyle = "#5d4037";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("OVEN", x + 46, y + 90);
}

/** Flat-top grill / stove with grate, burners, pans, and knobs. */
export function drawGrill(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x + 46, y + 88, 48, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // cabinet body
  ctx.fillStyle = INK;
  roundRect(ctx, x + 4, y + 40, 84, 48, 10, true);
  ctx.fillStyle = "#78909c";
  roundRect(ctx, x + 6, y + 42, 80, 44, 9, true);
  // door panels
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 12, y + 48, 32, 28, 5, true);
  roundRect(ctx, x + 48, y + 48, 32, 28, 5, true);
  ctx.fillStyle = "#546e7a";
  roundRect(ctx, x + 24, y + 58, 10, 4, 2, true);
  roundRect(ctx, x + 60, y + 58, 10, 4, 2, true);

  // cooktop slab
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 18, 92, 36, 10, true);
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x + 2, y + 20, 88, 32, 9, true);
  ctx.fillStyle = "#455a64";
  roundRect(ctx, x + 6, y + 24, 80, 24, 6, true);

  // grill grate lines
  ctx.strokeStyle = "#263238";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const gy = y + 28 + i * 3.5;
    ctx.beginPath();
    ctx.moveTo(x + 10, gy);
    ctx.lineTo(x + 82, gy);
    ctx.stroke();
  }
  // vertical grate accents
  ctx.strokeStyle = "#546e7a";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const gx = x + 18 + i * 14;
    ctx.beginPath();
    ctx.moveTo(gx, y + 26);
    ctx.lineTo(gx, y + 46);
    ctx.stroke();
  }

  // glowing burners under pans
  drawBurner(ctx, x + 28, y + 38);
  drawBurner(ctx, x + 64, y + 38);

  // pans on the grill
  drawPan(ctx, x + 28, y + 34);
  drawPan(ctx, x + 64, y + 34);

  // sizzle sparks
  ctx.fillStyle = "#ffecb3";
  for (const [sx, sy] of [
    [x + 22, y + 26],
    [x + 34, y + 22],
    [x + 58, y + 24],
    [x + 70, y + 20],
  ] as const) {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // control knobs on front lip
  ctx.fillStyle = INK;
  roundRect(ctx, x + 8, y + 48, 76, 10, 3, true);
  ctx.fillStyle = "#cfd8dc";
  roundRect(ctx, x + 10, y + 49, 72, 7, 2, true);
  for (const kx of [x + 24, x + 46, x + 68]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(kx, y + 52.5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eceff1";
    ctx.beginPath();
    ctx.arc(kx, y + 52.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#90a4ae";
    ctx.beginPath();
    ctx.arc(kx + 1, y + 51.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // steam
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  for (const [sx, sy, r] of [
    [x + 24, y + 10, 4],
    [x + 46, y + 4, 5],
    [x + 68, y + 10, 4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // label plate
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 30, y + 78, 32, 10, 3, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x + 30, y + 78, 32, 10, 3, false);
  ctx.fillStyle = "#37474f";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GRILL", x + 46, y + 86);

  strokeInk(ctx, 4);
  roundRect(ctx, x, y + 18, 92, 36, 10, false);
  roundRect(ctx, x + 4, y + 40, 84, 48, 10, false);
}

function drawPan(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // handle
  ctx.fillStyle = INK;
  roundRect(ctx, cx + 8, cy - 3, 16, 5, 2, true);
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, cx + 9, cy - 2, 14, 3, 1, true);

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#455a64";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // hot oil / patty glow
  ctx.fillStyle = "#8d6e63";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, 7, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a1887f";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#90a4ae";
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - 2, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBurner(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = "#e65100";
  ctx.beginPath();
  ctx.arc(cx, cy + 8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff6d00";
  ctx.beginPath();
  ctx.arc(cx, cy + 7, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffab00";
  ctx.beginPath();
  ctx.arc(cx, cy + 6, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff59d";
  ctx.beginPath();
  ctx.arc(cx - 1, cy + 5, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

/** Stack of clean white plates — obvious plate station. */
export function drawPlateStack(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x + 32, y + 52, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Big stacked circular plates (read as plates, not white blobs)
  const plates = [
    { cy: 42, rx: 30, ry: 10 },
    { cy: 34, rx: 29, ry: 10 },
    { cy: 26, rx: 28, ry: 10 },
    { cy: 18, rx: 27, ry: 10 },
    { cy: 10, rx: 26, ry: 10 },
  ] as const;
  for (const p of plates) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + 32, y + p.cy, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(x + 32, y + p.cy, p.rx - 3, p.ry - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e0e0e0";
    ctx.beginPath();
    ctx.ellipse(x + 32, y + p.cy, p.rx - 12, p.ry - 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fafafa";
    ctx.beginPath();
    ctx.ellipse(x + 32, y + p.cy, p.rx - 16, p.ry - 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // shine
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(x + 24, y + 8, 8, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  strokeInk(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(x + 32, y + 10, 26, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Bright yellow cutting board — the prep station landmark. */
export function drawCuttingBoard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  roundRect(ctx, x + 2, y + 4, 52, 34, 6, true);
  ctx.fillStyle = "#f9a825";
  roundRect(ctx, x, y, 52, 34, 6, true);
  ctx.fillStyle = "#ffd54f";
  roundRect(ctx, x + 4, y + 4, 44, 26, 4, true);
  // knife groove
  ctx.strokeStyle = "rgba(93,64,55,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 17);
  ctx.lineTo(x + 42, y + 17);
  ctx.stroke();
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, 52, 34, 6, false);
}

/** Portrait cutting board for left-wall counters facing the kitchen interior. */
export function drawCuttingBoardVertical(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  roundRect(ctx, x + 4, y + 2, 34, 52, 6, true);
  ctx.fillStyle = "#f9a825";
  roundRect(ctx, x, y, 34, 52, 6, true);
  ctx.fillStyle = "#ffd54f";
  roundRect(ctx, x + 4, y + 4, 26, 44, 4, true);
  ctx.strokeStyle = "rgba(93,64,55,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 17, y + 10);
  ctx.lineTo(x + 17, y + 42);
  ctx.stroke();
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, 34, 52, 6, false);
}

export function drawSink(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#cfd8dc";
  roundRect(ctx, x, y, 58, 40, 8, true);
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 8, y + 10, 42, 22, 6, true);
  ctx.fillStyle = "rgba(79,195,247,0.7)";
  roundRect(ctx, x + 12, y + 14, 34, 14, 4, true);
  // faucet
  ctx.fillStyle = "#78909c";
  roundRect(ctx, x + 26, y - 8, 8, 14, 3, true);
  ctx.fillStyle = "#b0bec5";
  roundRect(ctx, x + 22, y - 10, 16, 6, 3, true);
  // bubbles
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(x + 18, y + 18, 3, 0, Math.PI * 2);
  ctx.arc(x + 28, y + 20, 2, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, 58, 40, 8, false);
}

/**
 * Sink on a left-wall counter: faucet toward the wall, basin / water facing east
 * so the cook standing inside the kitchen looks into the water.
 */
export function drawSinkFacingEast(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#cfd8dc";
  roundRect(ctx, x, y, 48, 58, 8, true);
  // Basin opens toward the right (kitchen interior)
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 14, y + 8, 28, 42, 6, true);
  ctx.fillStyle = "rgba(79,195,247,0.75)";
  roundRect(ctx, x + 18, y + 12, 20, 34, 4, true);
  // Faucet on the left (wall side), spout pointing at the basin
  ctx.fillStyle = "#78909c";
  roundRect(ctx, x + 2, y + 22, 14, 8, 3, true);
  ctx.fillStyle = "#b0bec5";
  roundRect(ctx, x, y + 18, 8, 16, 3, true);
  // bubbles toward the open side
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(x + 28, y + 22, 3, 0, Math.PI * 2);
  ctx.arc(x + 32, y + 34, 2, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, 48, 58, 8, false);
}

/**
 * Sink on a right-wall counter: faucet toward the wall, basin / water facing west
 * so the cook standing inside the kitchen looks into the water.
 */
export function drawSinkFacingWest(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#cfd8dc";
  roundRect(ctx, x, y, 48, 58, 8, true);
  // Basin opens toward the left (kitchen interior)
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 6, y + 8, 28, 42, 6, true);
  ctx.fillStyle = "rgba(79,195,247,0.75)";
  roundRect(ctx, x + 10, y + 12, 20, 34, 4, true);
  // Faucet on the right (wall side)
  ctx.fillStyle = "#78909c";
  roundRect(ctx, x + 32, y + 22, 14, 8, 3, true);
  ctx.fillStyle = "#b0bec5";
  roundRect(ctx, x + 40, y + 18, 8, 16, 3, true);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(x + 18, y + 22, 3, 0, Math.PI * 2);
  ctx.arc(x + 14, y + 34, 2, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, 48, 58, 8, false);
}

export function drawFryer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  /** Clockwise degrees. Use 90 on tall/narrow side counters. */
  rotateDeg = 0,
) {
  const paint = () => {
  // Soft ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + 48, y + 92, 52, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tall steel cabinet
  ctx.fillStyle = INK;
  roundRect(ctx, x + 4, y + 42, 88, 48, 10, true);
  ctx.fillStyle = "#607d8b";
  roundRect(ctx, x + 6, y + 44, 84, 44, 9, true);
  // Door with recessed panel
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 14, y + 50, 68, 30, 6, true);
  ctx.fillStyle = "#546e7a";
  roundRect(ctx, x + 18, y + 54, 60, 22, 4, true);
  // Handle bar
  ctx.fillStyle = INK;
  roundRect(ctx, x + 42, y + 62, 18, 6, 2, true);
  ctx.fillStyle = "#cfd8dc";
  roundRect(ctx, x + 43, y + 63, 16, 4, 2, true);

  // Hazard stripe under vat
  ctx.fillStyle = "#ffc107";
  ctx.fillRect(x + 10, y + 44, 76, 5);
  ctx.fillStyle = "#212121";
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 12 + i * 12, y + 44);
    ctx.lineTo(x + 19 + i * 12, y + 44);
    ctx.lineTo(x + 15 + i * 12, y + 49);
    ctx.lineTo(x + 8 + i * 12, y + 49);
    ctx.fill();
  }

  // Big oil vat — deep rectangular tank
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 2, 96, 48, 10, true);
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x + 2, y + 4, 92, 44, 9, true);
  // Inner lip
  ctx.fillStyle = "#546e7a";
  roundRect(ctx, x + 6, y + 8, 84, 36, 7, true);

  // Deep hot oil pool (much larger)
  ctx.fillStyle = "#e65100";
  roundRect(ctx, x + 10, y + 12, 76, 28, 6, true);
  ctx.fillStyle = "#ef6c00";
  roundRect(ctx, x + 12, y + 14, 72, 24, 5, true);
  // Oil depth gradient bands
  ctx.fillStyle = "#ff8f00";
  roundRect(ctx, x + 14, y + 16, 68, 14, 4, true);
  ctx.fillStyle = "#ffb300";
  roundRect(ctx, x + 16, y + 17, 64, 8, 3, true);
  ctx.fillStyle = "#ffe082";
  roundRect(ctx, x + 20, y + 18, 36, 4, 2, true);

  // Oil surface shimmer / bubbles
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(x + 32, y + 22, 14, 3.5, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,236,179,0.55)";
  ctx.beginPath();
  ctx.ellipse(x + 58, y + 28, 10, 2.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  for (const [bx, by, br] of [
    [24, 30, 2.2],
    [40, 32, 1.8],
    [55, 29, 2.4],
    [70, 31, 1.6],
    [48, 24, 1.4],
  ] as const) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(x + bx, y + by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wide wire basket submerged in oil
  ctx.strokeStyle = "#eceff1";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 18 + i * 10, y + 14);
    ctx.lineTo(x + 18 + i * 10, y + 36);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 18 + i * 7);
    ctx.lineTo(x + 80, y + 18 + i * 7);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  roundRect(ctx, x + 14, y + 13, 68, 24, 4, false);

  // Tall basket handle
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 26, y + 14);
  ctx.quadraticCurveTo(x + 48, y - 14, x + 70, y + 14);
  ctx.stroke();
  ctx.strokeStyle = "#b0bec5";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 28, y + 13);
  ctx.quadraticCurveTo(x + 48, y - 8, x + 68, y + 13);
  ctx.stroke();

  // Fries sticking out of the big oil
  ctx.fillStyle = INK;
  roundRect(ctx, x + 30, y + 6, 4, 16, 1, true);
  roundRect(ctx, x + 40, y + 4, 4, 18, 1, true);
  roundRect(ctx, x + 50, y + 7, 4, 15, 1, true);
  roundRect(ctx, x + 60, y + 5, 4, 17, 1, true);
  ctx.fillStyle = "#ffc107";
  roundRect(ctx, x + 31, y + 7, 2.5, 14, 1, true);
  roundRect(ctx, x + 41, y + 5, 2.5, 16, 1, true);
  roundRect(ctx, x + 51, y + 8, 2.5, 13, 1, true);
  roundRect(ctx, x + 61, y + 6, 2.5, 15, 1, true);

  // Control knobs
  for (const kx of [x + 22, x + 48, x + 74]) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(kx, y + 82, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eceff1";
    ctx.beginPath();
    ctx.arc(kx, y + 82, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e53935";
    ctx.beginPath();
    ctx.arc(kx + 1.5, y + 80.5, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Label
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 28, y + 88, 40, 11, 3, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x + 28, y + 88, 40, 11, 3, false);
  ctx.fillStyle = "#37474f";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FRYER", x + 48, y + 97);

  strokeInk(ctx, 4);
  roundRect(ctx, x, y + 2, 96, 48, 10, false);
  roundRect(ctx, x + 4, y + 42, 88, 48, 10, false);
  };

  if (!rotateDeg) {
    paint();
    return;
  }
  // Pivot around the fryer's visual center so it stays planted on the counter.
  const cx = x + 48;
  const cy = y + 48;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotateDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  paint();
  ctx.restore();
}

/** Restaurant entrance door. */
export function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Frame
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 28, y + 70, 32, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 56, 68, 6, true);
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x + 3, y + 3, 50, 62, 5, true);

  // Door panels
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 8, y + 8, 18, 28, 3, true);
  roundRect(ctx, x + 30, y + 8, 18, 28, 3, true);
  roundRect(ctx, x + 8, y + 40, 18, 20, 3, true);
  roundRect(ctx, x + 30, y + 40, 18, 20, 3, true);

  // Glass window
  ctx.fillStyle = "#81d4fa";
  roundRect(ctx, x + 10, y + 10, 14, 14, 2, true);
  roundRect(ctx, x + 32, y + 10, 14, 14, 2, true);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  roundRect(ctx, x + 11, y + 11, 6, 6, 1, true);

  // Handle
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + 44, y + 36, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd54f";
  ctx.beginPath();
  ctx.arc(x + 44, y + 36, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // OPEN mat
  ctx.fillStyle = "#c62828";
  roundRect(ctx, x + 8, y + 66, 40, 10, 2, true);
  ctx.fillStyle = "#fff8e1";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ENTER", x + 28, y + 74);

  strokeInk(ctx, 3);
  roundRect(ctx, x, y, 56, 68, 6, false);
}

/** Beach / mall juice dispenser — glass tank of orange juice. */
export function drawJuiceMachine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  /** Clockwise degrees. Use 180 so the spout faces dining / north. */
  rotateDeg = 0,
) {
  const paint = () => {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 28, y + 72, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = INK;
  roundRect(ctx, x + 4, y + 28, 48, 42, 8, true);
  ctx.fillStyle = "#eceff1";
  roundRect(ctx, x + 6, y + 30, 44, 38, 7, true);
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 10, y + 50, 36, 12, 4, true);

  // Juice tank
  ctx.fillStyle = INK;
  roundRect(ctx, x + 8, y, 40, 36, 8, true);
  ctx.fillStyle = "#ff9800";
  roundRect(ctx, x + 11, y + 4, 34, 28, 6, true);
  ctx.fillStyle = "#ffb74d";
  roundRect(ctx, x + 14, y + 8, 28, 12, 4, true);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  roundRect(ctx, x + 16, y + 10, 10, 16, 3, true);

  // Spout + cup
  ctx.fillStyle = "#546e7a";
  roundRect(ctx, x + 24, y + 34, 8, 10, 2, true);
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 20, y + 44, 16, 14, 3, true);
  ctx.fillStyle = "#ffb74d";
  roundRect(ctx, x + 22, y + 46, 12, 8, 2, true);

  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 12, y + 64, 32, 10, 3, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x + 12, y + 64, 32, 10, 3, false);
  ctx.fillStyle = "#e65100";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("JUICE", x + 28, y + 72);

  strokeInk(ctx, 3);
  roundRect(ctx, x + 8, y, 40, 36, 8, false);
  roundRect(ctx, x + 4, y + 28, 48, 42, 8, false);
  };

  if (!rotateDeg) {
    paint();
    return;
  }
  const cx = x + 28;
  const cy = y + 36;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotateDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  paint();
  ctx.restore();
}

/** Soft-serve ice cream machine. */
export function drawIceCreamMachine(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 30, y + 78, 28, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 8, 60, 66, 10, true);
  ctx.fillStyle = "#fafafa";
  roundRect(ctx, x + 3, y + 11, 54, 60, 9, true);

  // Freezer window
  ctx.fillStyle = "#b3e5fc";
  roundRect(ctx, x + 10, y + 18, 40, 28, 6, true);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  roundRect(ctx, x + 14, y + 22, 14, 18, 3, true);

  // Soft-serve swirl peek
  ctx.fillStyle = "#f8bbd0";
  ctx.beginPath();
  ctx.ellipse(x + 30, y + 36, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.ellipse(x + 30, y + 30, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ce93d8";
  ctx.beginPath();
  ctx.ellipse(x + 30, y + 24, 5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lever
  ctx.fillStyle = INK;
  roundRect(ctx, x + 48, y + 20, 6, 20, 2, true);
  ctx.fillStyle = "#ef5350";
  ctx.beginPath();
  ctx.arc(x + 51, y + 18, 5, 0, Math.PI * 2);
  ctx.fill();

  // Cone shelf
  ctx.fillStyle = "#ffe0b2";
  roundRect(ctx, x + 16, y + 52, 28, 12, 3, true);
  ctx.fillStyle = "#ffcc80";
  for (const cx of [x + 22, x + 30, x + 38]) {
    ctx.beginPath();
    ctx.moveTo(cx, y + 52);
    ctx.lineTo(cx - 4, y + 62);
    ctx.lineTo(cx + 4, y + 62);
    ctx.fill();
  }

  ctx.fillStyle = "#fce4ec";
  roundRect(ctx, x + 10, y + 66, 40, 10, 3, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x + 10, y + 66, 40, 10, 3, false);
  ctx.fillStyle = "#ad1457";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ICE CREAM", x + 30, y + 74);

  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 8, 60, 66, 10, false);
}

/** Wooden crate overflowing with red tomatoes. */
export function drawTomatoCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  roundRect(ctx, x + 2, y + 6, 56, 38, 6, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x, y + 14, 56, 30, 6, true);
  ctx.fillStyle = "#a1887f";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 4, y + 18 + i * 8, 48, 5);
  }
  // tomatoes piled high
  const tomatoes = [
    [14, 10],
    [28, 6],
    [42, 10],
    [20, 18],
    [36, 16],
    [28, 22],
  ] as const;
  for (const [tx, ty] of tomatoes) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + tx, y + ty, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e53935";
    ctx.beginPath();
    ctx.arc(x + tx, y + ty, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8a80";
    ctx.beginPath();
    ctx.arc(x + tx - 2, y + ty - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#43a047";
    ctx.beginPath();
    ctx.moveTo(x + tx, y + ty - 7);
    ctx.lineTo(x + tx - 3, y + ty - 3);
    ctx.lineTo(x + tx + 3, y + ty - 3);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 14, 56, 30, 6, false);
}

/** Blue bowl of white mozzarella balls. */
export function drawMozzarellaBowl(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x + 28, y + 42, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e88e5";
  roundRect(ctx, x, y + 12, 56, 28, 14, true);
  ctx.fillStyle = "#64b5f6";
  roundRect(ctx, x + 4, y + 16, 48, 16, 10, true);
  // mozzarella balls
  for (const [bx, by] of [
    [16, 18],
    [28, 14],
    [40, 18],
    [22, 26],
    [34, 24],
  ] as const) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + bx, y + by, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fafafa";
    ctx.beginPath();
    ctx.arc(x + bx, y + by, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(x + bx - 2, y + by - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 12, 56, 28, 14, false);
}

export function drawBunCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x, y + 10, 52, 28, 5, true);
  for (const [bx, by] of [
    [14, 12],
    [28, 8],
    [42, 12],
    [22, 20],
    [36, 18],
  ] as const) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + bx, y + by, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffcc80";
    ctx.beginPath();
    ctx.ellipse(x + bx, y + by, 7, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb74d";
    ctx.beginPath();
    ctx.ellipse(x + bx, y + by + 1, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 10, 52, 28, 5, false);
}

export function drawPattyTray(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x, y, 52, 30, 5, true);
  ctx.fillStyle = "#cfd8dc";
  roundRect(ctx, x + 3, y + 3, 46, 24, 4, true);
  for (const [px, py] of [
    [16, 14],
    [36, 14],
  ] as const) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + px, y + py, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a1887f";
    ctx.beginPath();
    ctx.ellipse(x + px, y + py, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, 52, 30, 5, false);
}

/** Wooden crate of brown potatoes — easy to spot. */
export function drawPotatoCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  roundRect(ctx, x + 2, y + 6, 56, 38, 6, true);
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x, y + 16, 56, 28, 6, true);
  ctx.fillStyle = "#8d6e63";
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 4, y + 20 + i * 7, 48, 4);
  // potatoes piled up
  for (const [px, py] of [
    [14, 14],
    [30, 10],
    [44, 14],
    [22, 22],
    [38, 20],
  ] as const) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + px, y + py, 10, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d7b874";
    ctx.beginPath();
    ctx.ellipse(x + px, y + py, 8, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9a86c";
    ctx.beginPath();
    ctx.ellipse(x + px - 2, y + py - 1, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 16, 56, 28, 6, false);
  ctx.fillStyle = "#5d4037";
  ctx.font = "bold 9px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("POTATOES", x + 28, y + 52);
}

/** Dining table with two chairs — customers sit here. */
/** Flour-dusted pizza dough rounds in a shallow basket. */
export function drawDoughCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x + 4, y + 42, 52, 8);
  // Basket
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 18, 54, 28, 6, true);
  ctx.fillStyle = "#a1887f";
  roundRect(ctx, x + 2, y + 20, 50, 24, 5, true);
  ctx.fillStyle = "#8d6e63";
  ctx.fillRect(x + 4, y + 38, 46, 4);
  // Dough rounds
  const doughs = [
    [14, 28],
    [28, 26],
    [40, 30],
    [22, 34],
  ] as const;
  for (const [dx, dy] of doughs) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe0b2";
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8e1";
    ctx.beginPath();
    ctx.ellipse(x + dx - 2, y + dy - 2, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 18, 54, 28, 6, false);
}

export function drawDiningSet(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // chairs
  for (const [cx, cy] of [
    [x - 34, y + 4],
    [x + 34, y + 4],
  ] as const) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 18, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8d6e63";
    roundRect(ctx, cx - 12, cy, 24, 18, 4, true);
    ctx.fillStyle = "#c62828";
    roundRect(ctx, cx - 10, cy + 2, 20, 10, 3, true);
    strokeInk(ctx, 2);
    roundRect(ctx, cx - 12, cy, 24, 18, 4, false);
  }
  // table
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x, y + 22, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRect(ctx, x - 26, y - 8, 52, 36, 8, true);
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x - 24, y - 6, 48, 32, 7, true);
  ctx.fillStyle = "#ffe0b2";
  roundRect(ctx, x - 18, y, 36, 16, 4, true);
  // placemat
  ctx.fillStyle = "#e3f2fd";
  roundRect(ctx, x - 14, y + 2, 12, 10, 2, true);
  roundRect(ctx, x + 2, y + 2, 12, 10, 2, true);
  strokeInk(ctx, 3);
  roundRect(ctx, x - 26, y - 8, 52, 36, 8, false);
}

export function drawCrate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
) {
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x, y, 44, 32, 4, true);
  ctx.fillStyle = fill;
  roundRect(ctx, x + 6, y + 5, 32, 14, 3, true);
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, 44, 32, 4, false);
}

export function drawTrash(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Compact pedal-bin style — fits in a corner without covering neighbors
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 58, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = INK;
  roundRect(ctx, x + 2, y + 14, 40, 42, 8, true);
  ctx.fillStyle = "#607d8b";
  roundRect(ctx, x + 4, y + 16, 36, 38, 7, true);
  // Face highlight
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 8, y + 20, 12, 28, 4, true);
  // Swing door seam
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 18);
  ctx.lineTo(x + 22, y + 50);
  ctx.stroke();

  // Domed lid
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 16, 22, 10, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#455a64";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 16, 19, 8, 0, Math.PI, 0);
  ctx.fill();
  // Lid knob
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + 22, y + 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cfd8dc";
  ctx.beginPath();
  ctx.arc(x + 22, y + 8, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Pedal
  ctx.fillStyle = INK;
  roundRect(ctx, x + 14, y + 52, 16, 5, 2, true);
  ctx.fillStyle = "#78909c";
  roundRect(ctx, x + 15, y + 53, 14, 3, 1, true);

  // Small label plate (no emoji clutter)
  ctx.fillStyle = "#eceff1";
  roundRect(ctx, x + 6, y + 30, 32, 12, 3, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x + 6, y + 30, 32, 12, 3, false);
  ctx.fillStyle = "#37474f";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TRASH", x + 22, y + 39);

  strokeInk(ctx, 3);
  roundRect(ctx, x + 2, y + 14, 40, 42, 8, false);
}

export function drawBooth(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(x + 4, y + 46, 82, 8);
  ctx.fillStyle = "#c62828";
  roundRect(ctx, x, y, 90, 48, 12, true);
  ctx.fillStyle = "#e53935";
  roundRect(ctx, x + 6, y + 6, 78, 26, 8, true);
  ctx.fillStyle = "#b71c1c";
  ctx.fillRect(x + 10, y + 36, 70, 8);
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, 90, 48, 12, false);
}

export function drawTableSet(ctx: CanvasRenderingContext2D, x: number, y: number) {
  for (const [cx, cy] of [
    [x - 26, y + 16],
    [x + 26, y + 16],
    [x, y - 8],
  ] as const) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a1887f";
    roundRect(ctx, cx - 9, cy - 7, 18, 14, 3, true);
    strokeInk(ctx, 2);
    roundRect(ctx, cx - 9, cy - 7, 18, 14, 3, false);
  }
  ctx.fillStyle = "#fafafa";
  roundRect(ctx, x - 20, y - 16, 40, 32, 6, true);
  strokeInk(ctx, 3);
  roundRect(ctx, x - 20, y - 16, 40, 32, 6, false);
}

export function ensureCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xb8895a);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
    return;
  }
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
}
