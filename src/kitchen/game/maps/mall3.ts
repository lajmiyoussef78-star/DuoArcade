import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawBunCrate,
  drawCuttingBoard,
  drawDiningSet,
  drawDoor,
  drawDoughCrate,
  drawFryer,
  drawGrill,
  drawIceCreamMachine,
  drawJuiceMachine,
  drawMozzarellaBowl,
  drawOven,
  drawPattyTray,
  drawPlateStack,
  drawPotatoCrate,
  drawSink,
  drawSteelCounter,
  drawTableCondiments,
  drawTomatoCrate,
  drawTrash,
  ensureCanvas,
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-mall-3-fountain-v2";

/**
 * MALL MAP 3 — Fountain Court
 *
 * Distinct from maps 1–2:
 *   • Cook storefront along the NORTH rim
 *   • Stock column on the WEST (clears dining)
 *   • Sweets + plates / holds on the EAST
 *   • Central fountain island (impassable) — walk the ring
 *   • Pass on the SOUTH rim of the fountain
 *   • Dining centered along the BOTTOM
 *
 * Same full mall menu / timing as maps 1–2.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  { x: 420, y: 100, w: 560, h: 52 },
  { x: 95, y: 295, w: 95, h: 260 },
  { x: 480, y: 265, w: 150, h: 110 },
  { x: 855, y: 210, w: 110, h: 120 },
  { x: 855, y: 355, w: 110, h: 100 },
  { x: 480, y: 370, w: 170, h: 44 },
  { x: 240, y: 475, w: 70, h: 48 },
  { x: 400, y: 475, w: 70, h: 48 },
  { x: 560, y: 475, w: 70, h: 48 },
  { x: 720, y: 475, w: 70, h: 48 },
];

const APPLIANCES: ApplianceDef[] = [
  { id: "oven_a", x: 200, y: 155, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 290, y: 155, kind: "grill", label: "Grill" },
  { id: "trash_a", x: 370, y: 155, kind: "trash", label: "Trash" },
  { id: "prep_a", x: 450, y: 155, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 530, y: 155, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 620, y: 155, kind: "fryer", label: "Fryer" },
  { id: "pantry_tomato", x: 175, y: 200, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 175, y: 245, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 175, y: 290, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 175, y: 335, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 175, y: 380, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 175, y: 420, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  { id: "juice_a", x: 770, y: 180, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "icecream_a", x: 770, y: 245, kind: "icecream", label: "Ice cream", dispenses: "ice_cream" },
  { id: "plates", x: 770, y: 330, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_bar_l", x: 770, y: 375, kind: "counter", label: "Hold" },
  { id: "hold_bar_r", x: 770, y: 415, kind: "counter", label: "Hold" },
  { id: "pass_a", x: 480, y: 370, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 240, y: 480 },
  { id: 1, x: 400, y: 480 },
  { id: 2, x: 560, y: 480 },
  { id: 3, x: 720, y: 480 },
];

function drawMarbleFloor(ctx: CanvasRenderingContext2D) {
  const wash = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
  wash.addColorStop(0, "#f3e5f5");
  wash.addColorStop(0.35, "#e8eaf6");
  wash.addColorStop(0.7, "#e3f2fd");
  wash.addColorStop(1, "#fce4ec");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  const step = 40;
  for (let y = 0; y < MAP_H; y += step) {
    for (let x = 0; x < MAP_W; x += step) {
      const even = (x / step + y / step) % 2 === 0;
      ctx.fillStyle = even ? "rgba(255,255,255,0.35)" : "rgba(120,144,156,0.12)";
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
      if ((x + y) % 120 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x + 8, y + 6, 10, 3);
      }
    }
  }

  ctx.strokeStyle = "rgba(255,193,7,0.4)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(480, 270, 210, 130, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,236,179,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(480, 270, 200, 120, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSkylightGlow(ctx: CanvasRenderingContext2D) {
  const glow = ctx.createRadialGradient(480, 200, 20, 480, 260, 280);
  glow.addColorStop(0, "rgba(255,255,255,0.55)");
  glow.addColorStop(0.35, "rgba(179,229,252,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  ctx.fillStyle = "rgba(187,222,251,0.55)";
  roundRect(ctx, 280, 48, 400, 36, 6, true);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(280 + i * 80, 50);
    ctx.lineTo(280 + i * 80, 82);
    ctx.stroke();
  }
  strokeInk(ctx, 2.5);
  roundRect(ctx, 280, 48, 400, 36, 6, false);

  for (const sx of [340, 420, 500, 580]) {
    const shaft = ctx.createLinearGradient(sx, 84, sx + 20, 340);
    shaft.addColorStop(0, "rgba(255,255,255,0.22)");
    shaft.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(sx, 84);
    ctx.lineTo(sx + 28, 84);
    ctx.lineTo(sx + 55, 340);
    ctx.lineTo(sx - 15, 340);
    ctx.closePath();
    ctx.fill();
  }
}

function drawStorefront(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  accent: string,
  title: string,
) {
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  roundRect(ctx, x + 3, y + 4, 108, h, 8, true);
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x, y, 108, h, 8, true);
  const face = ctx.createLinearGradient(x, y, x + 108, y);
  face.addColorStop(0, "#455a64");
  face.addColorStop(0.5, "#607d8b");
  face.addColorStop(1, "#37474f");
  ctx.fillStyle = face;
  roundRect(ctx, x + 3, y + 3, 102, h - 6, 6, true);

  const glass = ctx.createLinearGradient(x, y + 28, x + 108, y + 100);
  glass.addColorStop(0, "#e1f5fe");
  glass.addColorStop(0.5, "#b3e5fc");
  glass.addColorStop(1, "#4fc3f7");
  ctx.fillStyle = glass;
  roundRect(ctx, x + 10, y + 28, 88, Math.min(72, h - 48), 6, true);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  roundRect(ctx, x + 14, y + 32, 26, Math.min(48, h - 58), 4, true);
  // Mannequin silhouette in window
  ctx.fillStyle = "rgba(55,71,79,0.35)";
  ctx.beginPath();
  ctx.arc(x + 54, y + 42, 8, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, x + 46, y + 50, 16, 28, 4, true);

  ctx.fillStyle = "#212121";
  roundRect(ctx, x + 8, y + 8, 92, 16, 4, true);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 10, y + 10, 88, 12, 3, false);
  ctx.fillStyle = accent;
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, x + 54, y + 19);

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 24);
  for (let i = 0; i <= 8; i++) {
    const px = x - 4 + (116 * i) / 8;
    ctx.lineTo(px, y + 24 + (i % 2 === 0 ? 0 : 10));
  }
  ctx.lineTo(x + 112, y + 26);
  ctx.lineTo(x - 4, y + 26);
  ctx.closePath();
  ctx.fill();
  strokeInk(ctx, 2);
  roundRect(ctx, x, y, 108, h, 8, false);
}

function drawFountain(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const plaza = ctx.createRadialGradient(cx, cy + 20, 10, cx, cy + 20, 120);
  plaza.addColorStop(0, "rgba(129,212,250,0.4)");
  plaza.addColorStop(1, "rgba(129,212,250,0)");
  ctx.fillStyle = plaza;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 30, 120, 55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 58, 95, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  const rim = ctx.createLinearGradient(cx - 90, cy, cx + 90, cy);
  rim.addColorStop(0, "#78909c");
  rim.addColorStop(0.5, "#eceff1");
  rim.addColorStop(1, "#607d8b");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 34, 88, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cfd8dc";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 28, 76, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffc107";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 26, 68, 20, 0, 0, Math.PI * 2);
  ctx.stroke();

  const water = ctx.createRadialGradient(cx - 12, cy + 8, 6, cx, cy + 20, 60);
  water.addColorStop(0, "#e1f5fe");
  water.addColorStop(0.35, "#4fc3f7");
  water.addColorStop(0.75, "#0288d1");
  water.addColorStop(1, "#01579b");
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 22, 62, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  for (const [ox, oy, rw, rh] of [
    [-18, 16, 16, 4],
    [10, 24, 12, 3],
    [28, 14, 10, 3],
    [-30, 26, 8, 2.5],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, rw, rh, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#b0bec5";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, 36, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4fc3f7";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const col = ctx.createLinearGradient(cx - 12, cy - 50, cx + 12, cy - 50);
  col.addColorStop(0, "#78909c");
  col.addColorStop(0.45, "#eceff1");
  col.addColorStop(1, "#546e7a");
  ctx.fillStyle = INK;
  roundRect(ctx, cx - 12, cy - 48, 24, 55, 4, true);
  ctx.fillStyle = col;
  roundRect(ctx, cx - 10, cy - 46, 20, 51, 3, true);

  const halo = ctx.createRadialGradient(cx, cy - 58, 2, cx, cy - 58, 30);
  halo.addColorStop(0, "rgba(255,236,179,0.75)");
  halo.addColorStop(1, "rgba(255,236,179,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy - 58, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fafafa";
  ctx.beginPath();
  ctx.arc(cx, cy - 58, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#90caf9";
  roundRect(ctx, cx - 7, cy - 48, 14, 18, 5, true);
  ctx.strokeStyle = "#e3f2fd";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 40);
  ctx.quadraticCurveTo(cx - 28, cy - 55, cx - 22, cy - 70);
  ctx.moveTo(cx + 6, cy - 40);
  ctx.quadraticCurveTo(cx + 28, cy - 55, cx + 22, cy - 70);
  ctx.stroke();

  for (const dx of [-28, -14, 0, 14, 28]) {
    ctx.strokeStyle = "rgba(179,229,252,0.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + dx * 0.35, cy + 8);
    ctx.quadraticCurveTo(cx + dx, cy - 18, cx + dx * 0.2, cy - 42);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(cx + dx * 0.25, cy - 36, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const [ox, oy] of [
    [-24, 28],
    [8, 32],
    [-6, 34],
    [26, 26],
    [16, 30],
    [-16, 32],
  ] as const) {
    ctx.fillStyle = "#ffc107";
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, 4.5, 2.8, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe082";
    ctx.beginPath();
    ctx.ellipse(cx + ox - 1, cy + oy - 0.5, 2, 1.2, 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  strokeInk(ctx, 3.5);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 34, 88, 32, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDirectory(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  roundRect(ctx, x + 3, y + 5, 58, 84, 6, true);
  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 58, 84, 6, true);
  const panel = ctx.createLinearGradient(x, y, x, y + 84);
  panel.addColorStop(0, "#311b92");
  panel.addColorStop(1, "#1a237e");
  ctx.fillStyle = panel;
  roundRect(ctx, x + 3, y + 3, 52, 78, 4, true);
  ctx.strokeStyle = "#ea80fc";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 6, y + 6, 46, 20, 3, false);
  ctx.fillStyle = "#f8bbd0";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DIRECTORY", x + 29, y + 19);
  ctx.fillStyle = "#ea80fc";
  ctx.beginPath();
  ctx.arc(x + 16, y + 38, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.fillText("YOU", x + 34, y + 36);
  ctx.fillText("ARE HERE", x + 34, y + 46);
  ctx.fillStyle = "#80deea";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.fillText("▲ Grill", x + 29, y + 60);
  ctx.fillText("◀ Stock", x + 29, y + 70);
  ctx.fillText("Sweets ▶", x + 29, y + 80);
}

function drawPalmPlanter(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 28, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 4, 44, 26, 5, true);
  const pot = ctx.createLinearGradient(x, y, x + 44, y);
  pot.addColorStop(0, "#6d4c41");
  pot.addColorStop(0.5, "#a1887f");
  pot.addColorStop(1, "#5d4037");
  ctx.fillStyle = pot;
  roundRect(ctx, x + 2, y + 6, 40, 22, 4, true);
  ctx.fillStyle = "#4e342e";
  roundRect(ctx, x + 4, y + 4, 36, 6, 2, true);
  ctx.fillStyle = "#3e2723";
  roundRect(ctx, x + 8, y + 8, 28, 6, 2, true);
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 10);
  ctx.quadraticCurveTo(x + 26, y - 10, x + 22, y - 28);
  ctx.stroke();
  for (const [a, len] of [
    [-1.1, 34],
    [-0.55, 38],
    [0, 40],
    [0.55, 38],
    [1.1, 34],
  ] as const) {
    const tipX = x + 22 + Math.cos(a - Math.PI / 2) * len;
    const tipY = y - 28 + Math.sin(a - Math.PI / 2) * len * 0.55;
    ctx.strokeStyle = "#1b5e20";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 22, y - 28);
    ctx.quadraticCurveTo(x + 22 + Math.cos(a) * 10, y - 42, tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = "#66bb6a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 22, y - 28);
    ctx.quadraticCurveTo(x + 22 + Math.cos(a) * 8, y - 40, tipX, tipY);
    ctx.stroke();
  }
  ctx.fillStyle = "#43a047";
  ctx.beginPath();
  ctx.arc(x + 22, y - 28, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "rgba(43,29,20,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y);
  ctx.stroke();
  const glow = ctx.createRadialGradient(x, y + 10, 1, x, y + 10, 20);
  glow.addColorStop(0, "rgba(255,236,179,0.85)");
  glow.addColorStop(0.45, "rgba(255,193,7,0.4)");
  glow.addColorStop(1, "rgba(255,193,7,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y + 10, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRect(ctx, x - 7, y, 14, 18, 3, true);
  ctx.fillStyle = "#ffe082";
  roundRect(ctx, x - 5, y + 2, 10, 12, 2, true);
  ctx.fillStyle = "#ffecb3";
  roundRect(ctx, x - 2, y + 4, 3, 7, 1, true);
}

function drawStringLights(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(43,29,20,0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(160, 140);
  ctx.quadraticCurveTo(480, 175, 800, 140);
  ctx.stroke();
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    drawLantern(ctx, 160 + t * 640, 140 + Math.sin(t * Math.PI) * 35);
  }
}

function drawBench(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x + 28, y + 18, 30, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 6, 56, 12, 3, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 2, y + 8, 52, 8, 2, true);
  ctx.fillStyle = "#a1887f";
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 12, y + 9, 10, 6);
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x + 4, y + 16, 6, 8, 1, true);
  roundRect(ctx, x + 46, y + 16, 6, 8, 1, true);
}

function drawNeonBanner(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(234,128,252,0.28)";
  roundRect(ctx, 200, 2, 560, 44, 12, true);
  const bar = ctx.createLinearGradient(220, 0, 740, 0);
  bar.addColorStop(0, "#4a148c");
  bar.addColorStop(0.5, "#6a1b9a");
  bar.addColorStop(1, "#1a237e");
  ctx.fillStyle = bar;
  roundRect(ctx, 220, 6, 520, 34, 10, true);
  ctx.strokeStyle = "#f8bbd0";
  ctx.lineWidth = 2;
  roundRect(ctx, 226, 11, 508, 24, 7, false);
  ctx.strokeStyle = "#ea80fc";
  ctx.lineWidth = 1.5;
  roundRect(ctx, 230, 14, 500, 18, 5, false);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 15px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("FOUNTAIN COURT", 480, 22);
  ctx.fillStyle = "#f8bbd0";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.fillText("ring the atrium  ·  premium food hall", 480, 34);
}

function drawServiceSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(234,128,252,0.3)";
  roundRect(ctx, x - 34, y - 2, 68, 20, 5, true);
  ctx.fillStyle = "#4a148c";
  roundRect(ctx, x - 30, y, 60, 16, 4, true);
  ctx.strokeStyle = "#ea80fc";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x - 28, y + 2, 56, 12, 3, false);
  ctx.fillStyle = "#f8bbd0";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS", x, y + 12);
}

function drawStationPlaque(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  roundRect(ctx, x - 48, y - 1, 96, 14, 4, true);
  ctx.fillStyle = color;
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 9);
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawMarbleFloor(ctx);
    drawSkylightGlow(ctx);
    drawNeonBanner(ctx);
    drawStringLights(ctx);

    drawStorefront(ctx, 28, 145, 130, "#ce93d8", "BOUTIQUE");
    drawStorefront(ctx, 824, 145, 130, "#80deea", "GIFTS");
    drawStorefront(ctx, 28, 360, 110, "#ffab91", "BOOKS");
    drawStorefront(ctx, 824, 360, 110, "#a5d6a7", "MUSIC");

    drawSteelCounter(ctx, 140, 68, 560, 58);
    drawStationPlaque(ctx, 420, 52, "GRILL PROMENADE", "#e1bee7");
    drawOven(ctx, 155, 45);
    drawGrill(ctx, 245, 45);
    drawTrash(ctx, 340, 70);
    drawCuttingBoard(ctx, 420, 85);
    drawSink(ctx, 500, 78);
    drawFryer(ctx, 570, 52);

    drawSteelCounter(ctx, 48, 165, 95, 265);
    drawStationPlaque(ctx, 95, 150, "STOCK", "#80cbc4");
    drawTomatoCrate(ctx, 62, 175);
    drawMozzarellaBowl(ctx, 62, 220);
    drawBunCrate(ctx, 62, 265);
    drawPattyTray(ctx, 62, 310);
    drawPotatoCrate(ctx, 62, 355);
    drawDoughCrate(ctx, 62, 400);

    drawSteelCounter(ctx, 800, 150, 110, 120);
    drawStationPlaque(ctx, 855, 136, "SWEETS", "#f48fb1");
    drawJuiceMachine(ctx, 818, 155);
    drawIceCreamMachine(ctx, 818, 210);

    drawSteelCounter(ctx, 800, 300, 110, 105);
    drawPlateStack(ctx, 825, 305);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.strokeStyle = "rgba(234,128,252,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(855, 370, 11, 0, Math.PI * 2);
    ctx.arc(855, 410, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawFountain(ctx, 480, 250);
    drawPalmPlanter(ctx, 318, 295);
    drawPalmPlanter(ctx, 598, 295);
    drawDirectory(ctx, 618, 168);
    drawBench(ctx, 200, 320);
    drawBench(ctx, 700, 320);

    drawSteelCounter(ctx, 395, 348, 170, 48);
    drawServiceSign(ctx, 480, 340);
    ctx.strokeStyle = "rgba(234,128,252,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(480, 370, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(234,128,252,0.25)";
    ctx.beginPath();
    ctx.arc(480, 370, 13, 0, Math.PI * 2);
    ctx.fill();

    drawStationPlaque(ctx, 480, 428, "COURT SEATING", "#b39ddb");
    ctx.fillStyle = "rgba(94,53,177,0.14)";
    roundRect(ctx, 180, 448, 600, 70, 12, true);
    ctx.strokeStyle = "rgba(94,53,177,0.3)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 180, 448, 600, 70, 12, false);

    drawDiningSet(ctx, 240, 470);
    drawDiningSet(ctx, 400, 470);
    drawDiningSet(ctx, 560, 470);
    drawDiningSet(ctx, 720, 470);
    drawTableCondiments(ctx, 240, 468);
    drawTableCondiments(ctx, 400, 468);
    drawTableCondiments(ctx, 560, 468);
    drawTableCondiments(ctx, 720, 468);

    drawDoor(ctx, 40, 42);
    ctx.fillStyle = "#7e57c2";
    ctx.font = "bold 8px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ENTER", 68, 38);

    const vig = ctx.createRadialGradient(480, 270, 180, 480, 270, 520);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(26,35,126,0.2)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 14, false);
  });
}

export const MALL_3: MapDef = {
  id: "mall-3",
  env: "mall",
  name: "Fountain Court",
  slot: 3,
  unlocked: true,
  matchSeconds: 255,
  customerSpawnMs: [3200, 4800],
  spawn: { x: 280, y: 250 },
  door: { x: 70, y: 55 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice", "ice_cream"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
