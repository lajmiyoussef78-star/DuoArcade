import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawBunCrate,
  drawCuttingBoardVertical,
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
  drawSinkFacingEast,
  drawSteelCounter,
  drawTableCondiments,
  drawTomatoCrate,
  drawTrash,
  ensureCanvas,
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-mall-4-cinema-v4";

/**
 * MALL MAP 4 — Neon Cinema
 *
 * Distinct from maps 1–3:
 *   • U-kitchen: cook along WEST, stock along NORTH, sweets EAST
 *   • Center cinema plaza dining (2×2) on a star carpet
 *   • Pass between cook and plaza
 *   • Marquee entrance at top-center
 *   • Arcade cabinets, popcorn, velvet ropes, film-strip trim
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // North stock strip
  { x: 480, y: 100, w: 560, h: 52 },
  // West cook column
  { x: 115, y: 300, w: 110, h: 260 },
  // Trash — bottom-left corner
  { x: 70, y: 490, w: 50, h: 40 },
  // East sweets
  { x: 850, y: 300, w: 100, h: 260 },
  // Pass bar
  { x: 280, y: 280, w: 90, h: 48 },
  // Cinema plaza tables
  { x: 420, y: 265, w: 55, h: 40 },
  { x: 560, y: 265, w: 55, h: 40 },
  { x: 420, y: 385, w: 55, h: 40 },
  { x: 560, y: 385, w: 55, h: 40 },
];

const APPLIANCES: ApplianceDef[] = [
  // West cook — stand east into plaza (spaced so sink stays visible)
  { id: "oven_a", x: 160, y: 200, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 160, y: 260, kind: "grill", label: "Grill" },
  { id: "prep_a", x: 170, y: 310, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 170, y: 380, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 160, y: 450, kind: "fryer", label: "Fryer" },
  // Bottom-left corner trash
  { id: "trash_a", x: 70, y: 490, kind: "trash", label: "Trash" },
  // North stock — stand south
  { id: "pantry_tomato", x: 260, y: 145, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 340, y: 145, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 420, y: 145, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 500, y: 145, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 580, y: 145, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 660, y: 145, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // East sweets
  { id: "juice_a", x: 810, y: 200, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "icecream_a", x: 810, y: 265, kind: "icecream", label: "Ice cream", dispenses: "ice_cream" },
  { id: "plates", x: 810, y: 345, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_bar_l", x: 810, y: 395, kind: "counter", label: "Hold" },
  { id: "hold_bar_r", x: 810, y: 435, kind: "counter", label: "Hold" },
  // Pass facing plaza
  { id: "pass_a", x: 280, y: 280, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 420, y: 270 },
  { id: 1, x: 560, y: 270 },
  { id: 2, x: 420, y: 390 },
  { id: 3, x: 560, y: 390 },
];

function drawCinemaFloor(ctx: CanvasRenderingContext2D) {
  const wash = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
  wash.addColorStop(0, "#1a0a2e");
  wash.addColorStop(0.35, "#2d1b4e");
  wash.addColorStop(0.7, "#1a237e");
  wash.addColorStop(1, "#4a148c");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Soft aisle glow
  const aisle = ctx.createRadialGradient(480, 320, 40, 480, 320, 280);
  aisle.addColorStop(0, "rgba(255,64,129,0.18)");
  aisle.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aisle;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Checker cinema carpet under plaza
  const ox = 340;
  const oy = 220;
  const cw = 300;
  const ch = 220;
  for (let y = 0; y < ch; y += 20) {
    for (let x = 0; x < cw; x += 20) {
      const even = ((x / 20) + (y / 20)) % 2 === 0;
      ctx.fillStyle = even ? "rgba(233,30,99,0.35)" : "rgba(49,27,146,0.45)";
      ctx.fillRect(ox + x, oy + y, 19, 19);
    }
  }
  strokeInk(ctx, 3);
  roundRect(ctx, ox, oy, cw, ch, 10, false);

  // Gold stars on carpet
  for (const [sx, sy] of [
    [400, 260],
    [520, 260],
    [400, 360],
    [520, 360],
    [460, 310],
  ] as const) {
    drawStar(ctx, sx, sy, 7, "#ffd54f");
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a + Math.PI / 5;
    const x1 = cx + Math.cos(a) * r;
    const y1 = cy + Math.sin(a) * r;
    const x2 = cx + Math.cos(a2) * (r * 0.4);
    const y2 = cy + Math.sin(a2) * (r * 0.4);
    if (i === 0) ctx.moveTo(x1, y1);
    else ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMarquee(ctx: CanvasRenderingContext2D) {
  // Board
  ctx.fillStyle = INK;
  roundRect(ctx, 260, 4, 440, 42, 8, true);
  const g = ctx.createLinearGradient(260, 4, 700, 46);
  g.addColorStop(0, "#f50057");
  g.addColorStop(0.5, "#ff4081");
  g.addColorStop(1, "#ff80ab");
  ctx.fillStyle = g;
  roundRect(ctx, 264, 7, 432, 36, 7, true);

  // Bulb lights
  for (let i = 0; i < 18; i++) {
    const bx = 280 + i * 24;
    ctx.fillStyle = i % 2 === 0 ? "#fff59d" : "#ffe082";
    ctx.beginPath();
    ctx.arc(bx, 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, 38, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NEON CINEMA", 480, 28);
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.fillStyle = "#fce4ec";
  ctx.fillText("NOW SHOWING  ·  FOOD COURT", 480, 38);
}

function drawFilmStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
) {
  ctx.fillStyle = "#212121";
  roundRect(ctx, x, y, 28, h, 4, true);
  ctx.fillStyle = "#424242";
  for (let i = 0; i < Math.floor(h / 16); i++) {
    roundRect(ctx, x + 4, y + 4 + i * 16, 20, 10, 2, true);
    ctx.fillStyle = "#ffecb3";
    ctx.fillRect(x + 2, y + 6 + i * 16, 3, 6);
    ctx.fillRect(x + 23, y + 6 + i * 16, 3, 6);
    ctx.fillStyle = "#424242";
  }
}

function drawArcadeCabinet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  accent: string,
) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  roundRect(ctx, x + 4, y + 70, 52, 10, 4, true);
  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 56, 78, 6, true);
  ctx.fillStyle = accent;
  roundRect(ctx, x + 2, y + 2, 52, 74, 5, true);
  ctx.fillStyle = "#0d47a1";
  roundRect(ctx, x + 8, y + 10, 40, 28, 3, true);
  // Screen glow
  ctx.fillStyle = "rgba(128,222,234,0.7)";
  roundRect(ctx, x + 10, y + 12, 36, 24, 2, true);
  ctx.fillStyle = "#212121";
  roundRect(ctx, x + 14, y + 46, 28, 8, 2, true);
  ctx.fillStyle = "#ff5252";
  ctx.beginPath();
  ctx.arc(x + 20, y + 64, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#69f0ae";
  ctx.beginPath();
  ctx.arc(x + 36, y + 64, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPopcornBucket(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 18, 28, 26, 4, true);
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 2, y + 20, 24, 22, 3, true);
  ctx.fillStyle = "#e53935";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 4 + i * 8, y + 20, 4, 22);
  }
  // Kernels
  for (const [px, py] of [
    [8, 12],
    [16, 8],
    [22, 14],
    [12, 16],
  ] as const) {
    ctx.fillStyle = "#ffe082";
    ctx.beginPath();
    ctx.ellipse(x + px, y + py, 5, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVelvetRope(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  // Posts
  for (const [px, py] of [
    [x1, y1],
    [x2, y2],
  ] as const) {
    ctx.fillStyle = INK;
    ctx.fillRect(px - 3, py - 2, 6, 28);
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.arc(px, py - 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#c62828";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1 + 6);
  ctx.quadraticCurveTo((x1 + x2) / 2, y1 - 12, x2, y2 + 6);
  ctx.stroke();
}

function drawNeonSign(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, x - 4, y - 12, text.length * 7 + 16, 20, 6, true);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x - 4, y - 12, text.length * 7 + 16, 20, 6, false);
  ctx.fillStyle = color;
  ctx.font = "bold 10px Sora, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(text, x + 4, y + 2);
}

function drawTicketBooth(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 70, 48, 6, true);
  ctx.fillStyle = "#6a1b9a";
  roundRect(ctx, x + 2, y + 2, 66, 44, 5, true);
  ctx.fillStyle = "#80deea";
  roundRect(ctx, x + 10, y + 10, 50, 18, 3, true);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TICKETS", x + 35, y + 40);
}

function drawRotatedScaled(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  deg: number,
  scale: number,
  paintFn: () => void,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  paintFn();
  ctx.restore();
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawCinemaFloor(ctx);
    drawMarquee(ctx);

    // Film strips on side walls
    drawFilmStrip(ctx, 8, 60, 420);
    drawFilmStrip(ctx, 924, 60, 420);

    // Arcade lounge (paint-only décor, top-right corner)
    drawArcadeCabinet(ctx, 730, 55, "#7c4dff");
    drawArcadeCabinet(ctx, 800, 55, "#00e676");
    drawPopcornBucket(ctx, 700, 90);
    drawPopcornBucket(ctx, 870, 90);

    // Velvet ropes guiding into plaza
    drawVelvetRope(ctx, 340, 200, 420, 230);
    drawVelvetRope(ctx, 620, 200, 540, 230);

    drawNeonSign(ctx, 70, 155, "GRILL", "#ff4081");
    drawNeonSign(ctx, 700, 155, "SWEETS", "#80d8ff");
    drawNeonSign(ctx, 430, 455, "PLAZA", "#ffd740");

    drawTicketBooth(ctx, 445, 48);
    drawDoor(ctx, 452, 45);

    // —— North stock ——
    drawSteelCounter(ctx, 220, 85, 500, 48);
    drawTomatoCrate(ctx, 235, 78);
    drawMozzarellaBowl(ctx, 315, 78);
    drawBunCrate(ctx, 395, 80);
    drawPattyTray(ctx, 475, 82);
    drawPotatoCrate(ctx, 555, 78);
    drawDoughCrate(ctx, 635, 78);

    // —— West cook — face EAST; chop + sink spaced so neither hides ——
    drawSteelCounter(ctx, 55, 170, 120, 300);
    drawRotatedScaled(ctx, 115, 200, -90, 0.62, () => drawOven(ctx, 70, 155));
    drawRotatedScaled(ctx, 115, 258, -90, 0.62, () => drawGrill(ctx, 70, 213));
    drawCuttingBoardVertical(ctx, 100, 288);
    drawSinkFacingEast(ctx, 95, 352);
    drawFryer(ctx, 72, 415, -90);

    // Trash tucked in bottom-left corner
    drawTrash(ctx, 48, 455);

    // —— East sweets ——
    drawSteelCounter(ctx, 790, 170, 110, 290);
    drawJuiceMachine(ctx, 810, 165);
    drawIceCreamMachine(ctx, 805, 230);
    drawPlateStack(ctx, 812, 320);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(810, 398, 10, 0, Math.PI * 2);
    ctx.arc(810, 438, 10, 0, Math.PI * 2);
    ctx.fill();

    // —— Pass ——
    drawSteelCounter(ctx, 235, 255, 90, 50);
    ctx.fillStyle = "#f50057";
    ctx.beginPath();
    ctx.arc(280, 280, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 8px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PASS", 280, 283);

    // —— Plaza dining ——
    drawDiningSet(ctx, 420, 270);
    drawDiningSet(ctx, 560, 270);
    drawDiningSet(ctx, 420, 390);
    drawDiningSet(ctx, 560, 390);
    drawTableCondiments(ctx, 420, 268);
    drawTableCondiments(ctx, 560, 268);
    drawTableCondiments(ctx, 420, 388);
    drawTableCondiments(ctx, 560, 388);

    // Vignette
    const vig = ctx.createRadialGradient(480, 280, 160, 480, 280, 520);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(26,10,46,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const MALL_4: MapDef = {
  id: "mall-4",
  env: "mall",
  name: "Neon Cinema",
  slot: 4,
  unlocked: true,
  matchSeconds: 255,
  customerSpawnMs: [3200, 4800],
  spawn: { x: 400, y: 320 },
  door: { x: 480, y: 55 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice", "ice_cream"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
