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

const BG = "bg-mall-5-loft-v3";

/**
 * MALL MAP 5 — Escalator Loft
 *
 * Distinct from maps 1–4:
 *   • Split kitchens: WEST cook line + EAST sweets wing
 *   • Stock on a raised NORTH mezzanine strip
 *   • Glass bridge / pass in the center atrium
 *   • Twin escalators (décor) flanking the loft
 *   • Dining along the SOUTH gallery
 *   • Door mid-right into the loft corridor
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // North mezzanine stock
  { x: 400, y: 95, w: 520, h: 50 },
  // West cook
  { x: 140, y: 280, w: 160, h: 220 },
  // East sweets
  { x: 820, y: 280, w: 110, h: 220 },
  // Center glass pass / bridge pier
  { x: 480, y: 270, w: 120, h: 70 },
  // Escalator blockers (thin)
  { x: 300, y: 200, w: 40, h: 90 },
  { x: 660, y: 200, w: 40, h: 90 },
  // South dining
  { x: 260, y: 470, w: 65, h: 42 },
  { x: 400, y: 470, w: 65, h: 42 },
  { x: 560, y: 470, w: 65, h: 42 },
  { x: 700, y: 470, w: 65, h: 42 },
];

const APPLIANCES: ApplianceDef[] = [
  // West cook bay — stand east
  { id: "oven_a", x: 120, y: 210, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 200, y: 210, kind: "grill", label: "Grill" },
  { id: "trash_a", x: 120, y: 290, kind: "trash", label: "Trash" },
  { id: "prep_a", x: 225, y: 290, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 120, y: 370, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 200, y: 370, kind: "fryer", label: "Fryer" },
  // North mezzanine stock — stand south
  { id: "pantry_tomato", x: 220, y: 140, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 300, y: 140, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 380, y: 140, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 460, y: 140, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 540, y: 140, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 620, y: 140, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // East sweets wing
  { id: "juice_a", x: 800, y: 200, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "icecream_a", x: 800, y: 265, kind: "icecream", label: "Ice cream", dispenses: "ice_cream" },
  { id: "plates", x: 800, y: 340, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_bar_l", x: 800, y: 390, kind: "counter", label: "Hold" },
  { id: "hold_bar_r", x: 800, y: 430, kind: "counter", label: "Hold" },
  // Glass bridge pass
  { id: "pass_a", x: 480, y: 270, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 260, y: 475 },
  { id: 1, x: 400, y: 475 },
  { id: 2, x: 560, y: 475 },
  { id: 3, x: 700, y: 475 },
];

function drawLoftFloor(ctx: CanvasRenderingContext2D) {
  const wash = ctx.createLinearGradient(0, 0, 0, MAP_H);
  wash.addColorStop(0, "#e0f7fa");
  wash.addColorStop(0.4, "#f5f5f5");
  wash.addColorStop(0.75, "#eceff1");
  wash.addColorStop(1, "#cfd8dc");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Polished tile grid
  ctx.strokeStyle = "rgba(144,164,174,0.35)";
  ctx.lineWidth = 1;
  for (let x = 0; x < MAP_W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, MAP_H);
    ctx.stroke();
  }
  for (let y = 0; y < MAP_H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(MAP_W, y);
    ctx.stroke();
  }

  // Warm atrium glow under skylight
  const glow = ctx.createRadialGradient(480, 220, 30, 480, 240, 260);
  glow.addColorStop(0, "rgba(255,236,179,0.35)");
  glow.addColorStop(1, "rgba(255,236,179,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
}

function drawSkylightDome(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(3,169,244,0.12)";
  ctx.beginPath();
  ctx.ellipse(480, 70, 220, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(2,136,209,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(480, 70, 220, 40, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Ribs
  for (const dx of [-140, -70, 0, 70, 140]) {
    ctx.beginPath();
    ctx.moveTo(480 + dx, 35);
    ctx.quadraticCurveTo(480 + dx * 0.3, 70, 480 + dx * 0.15, 105);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Light shafts
  for (const sx of [360, 440, 520, 600]) {
    const shaft = ctx.createLinearGradient(sx, 90, sx, 280);
    shaft.addColorStop(0, "rgba(255,255,255,0.28)");
    shaft.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shaft;
    ctx.beginPath();
    ctx.moveTo(sx - 18, 90);
    ctx.lineTo(sx + 18, 90);
    ctx.lineTo(sx + 40, 280);
    ctx.lineTo(sx - 40, 280);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBanner(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = INK;
  roundRect(ctx, 300, 4, 360, 30, 6, true);
  const g = ctx.createLinearGradient(300, 4, 660, 34);
  g.addColorStop(0, "#00838f");
  g.addColorStop(1, "#26c6da");
  ctx.fillStyle = g;
  roundRect(ctx, 303, 6, 354, 26, 5, true);
  ctx.fillStyle = "#e0f7fa";
  ctx.font = "bold 14px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ESCALATOR LOFT", 480, 24);
}

function drawEscalator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  /** -1 = up-left visual, 1 = up-right */
  dir: 1 | -1,
) {
  const w = 44;
  const h = 100;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  roundRect(ctx, x + 3, y + h - 4, w, 10, 3, true);

  // Side rails
  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 8, h, 3, true);
  roundRect(ctx, x + w - 8, y, 8, h, 3, true);
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 1, y + 1, 6, h - 2, 2, true);
  roundRect(ctx, x + w - 7, y + 1, 6, h - 2, 2, true);

  // Glass panels
  ctx.fillStyle = "rgba(179,229,252,0.55)";
  roundRect(ctx, x + 8, y + 4, w - 16, h - 10, 2, true);

  // Steps
  for (let i = 0; i < 8; i++) {
    const sy = y + 8 + i * 11;
    const sx = x + 10 + dir * (i * 1.2);
    ctx.fillStyle = i % 2 === 0 ? "#546e7a" : "#78909c";
    roundRect(ctx, sx, sy, w - 20, 9, 1, true);
    ctx.fillStyle = "#ffc107";
    ctx.fillRect(sx, sy + 7, w - 20, 2);
  }

  // Handrail chrome
  ctx.strokeStyle = "#eceff1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h - 6);
  ctx.lineTo(x + 4 + dir * 6, y + 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w - 4, y + h - 6);
  ctx.lineTo(x + w - 4 + dir * 6, y + 6);
  ctx.stroke();
}

function drawGlassBridge(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Pier
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 28, 70, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  roundRect(ctx, cx - 60, cy - 18, 120, 48, 10, true);
  ctx.fillStyle = "rgba(224,247,250,0.85)";
  roundRect(ctx, cx - 56, cy - 14, 112, 40, 8, true);

  // Glass sheen
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  roundRect(ctx, cx - 50, cy - 10, 40, 12, 4, true);

  // Chrome posts
  for (const dx of [-50, -20, 20, 50]) {
    ctx.fillStyle = "#607d8b";
    ctx.fillRect(cx + dx - 2, cy - 28, 4, 14);
    ctx.fillStyle = "#cfd8dc";
    ctx.beginPath();
    ctx.arc(cx + dx, cy - 28, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Railing cable
  ctx.strokeStyle = "#90a4ae";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy - 24);
  ctx.lineTo(cx + 52, cy - 24);
  ctx.stroke();

  ctx.fillStyle = "#00695c";
  ctx.font = "bold 9px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS  ·  BRIDGE", cx, cy + 6);
}

function drawHangingPlanter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  // Cord
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 30);
  ctx.lineTo(x, y);
  ctx.stroke();
  // Pot
  ctx.fillStyle = INK;
  roundRect(ctx, x - 14, y, 28, 18, 4, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x - 12, y + 2, 24, 14, 3, true);
  // Leaves
  ctx.fillStyle = "#43a047";
  for (const [lx, ly, r] of [
    [-8, -2, 7],
    [0, -8, 8],
    [8, -2, 7],
    [-4, 4, 5],
    [5, 3, 5],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + lx, y + ly, r, r * 0.7, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bloom
  ctx.fillStyle = "#ec407a";
  ctx.beginPath();
  ctx.arc(x + 2, y - 6, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawChromeColumn(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.fillStyle = INK;
  roundRect(ctx, x - 8, y, 16, h, 4, true);
  const g = ctx.createLinearGradient(x - 8, y, x + 8, y);
  g.addColorStop(0, "#90a4ae");
  g.addColorStop(0.45, "#eceff1");
  g.addColorStop(1, "#546e7a");
  ctx.fillStyle = g;
  roundRect(ctx, x - 6, y + 2, 12, h - 4, 3, true);
}

function drawFashionBay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  accent: string,
) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  roundRect(ctx, x + 3, y + 70, 90, 10, 4, true);
  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 90, 78, 8, true);
  ctx.fillStyle = "#fafafa";
  roundRect(ctx, x + 2, y + 2, 86, 74, 7, true);
  // Glass
  ctx.fillStyle = "rgba(179,229,252,0.4)";
  roundRect(ctx, x + 8, y + 10, 74, 40, 4, true);
  // Mannequin silhouette
  ctx.fillStyle = "#78909c";
  ctx.beginPath();
  ctx.arc(x + 45, y + 22, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + 40, y + 28, 10, 18);
  // Neon title
  ctx.fillStyle = accent;
  ctx.font = "bold 9px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, x + 45, y + 68);
}

function drawBalloon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 14);
  ctx.lineTo(x + 2, y + 40);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(x - 3, y - 4, 3, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawLoftFloor(ctx);
    drawSkylightDome(ctx);
    drawBanner(ctx);

    // Chrome atrium columns
    drawChromeColumn(ctx, 250, 160, 200);
    drawChromeColumn(ctx, 710, 160, 200);

    // Twin escalators flanking the bridge
    drawEscalator(ctx, 278, 155, -1);
    drawEscalator(ctx, 638, 155, 1);

    // Hanging planters from mezzanine
    drawHangingPlanter(ctx, 200, 175);
    drawHangingPlanter(ctx, 480, 165);
    drawHangingPlanter(ctx, 760, 175);

    // Fashion storefronts (paint-only)
    drawFashionBay(ctx, 30, 400, "ATELIER", "#ab47bc");
    drawFashionBay(ctx, 840, 55, "LUXE", "#26c6da");

    // Celebration balloons near door
    drawBalloon(ctx, 880, 100, "#ef5350");
    drawBalloon(ctx, 900, 120, "#42a5f5");
    drawBalloon(ctx, 865, 130, "#66bb6a");

    drawDoor(ctx, 870, 42);
    ctx.fillStyle = "#00838f";
    ctx.font = "bold 8px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ENTER", 898, 38);

    // —— North mezzanine stock ——
    drawSteelCounter(ctx, 180, 80, 500, 48);
    // Mezzanine edge stripe
    ctx.fillStyle = "#00acc1";
    ctx.fillRect(180, 122, 500, 4);
    drawTomatoCrate(ctx, 195, 72);
    drawMozzarellaBowl(ctx, 275, 72);
    drawBunCrate(ctx, 355, 74);
    drawPattyTray(ctx, 435, 76);
    drawPotatoCrate(ctx, 515, 72);
    drawDoughCrate(ctx, 595, 72);

    // —— West cook bay (2×3 grid) ——
    drawSteelCounter(ctx, 60, 185, 180, 220);
    drawOven(ctx, 70, 175);
    drawGrill(ctx, 150, 175);
    drawTrash(ctx, 78, 260);
    drawCuttingBoardVertical(ctx, 187, 268);
    drawSink(ctx, 70, 345);
    drawFryer(ctx, 145, 340);

    // —— East sweets ——
    drawSteelCounter(ctx, 760, 175, 120, 280);
    drawJuiceMachine(ctx, 780, 165);
    drawIceCreamMachine(ctx, 775, 230);
    drawPlateStack(ctx, 782, 315);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(800, 393, 10, 0, Math.PI * 2);
    ctx.arc(800, 433, 10, 0, Math.PI * 2);
    ctx.fill();

    // —— Glass bridge pass ——
    drawGlassBridge(ctx, 480, 270);

    // —— South gallery dining ——
    ctx.fillStyle = "rgba(0,151,167,0.12)";
    roundRect(ctx, 200, 440, 560, 70, 12, true);
    drawDiningSet(ctx, 260, 475);
    drawDiningSet(ctx, 400, 475);
    drawDiningSet(ctx, 560, 475);
    drawDiningSet(ctx, 700, 475);
    drawTableCondiments(ctx, 260, 473);
    drawTableCondiments(ctx, 400, 473);
    drawTableCondiments(ctx, 560, 473);
    drawTableCondiments(ctx, 700, 473);

    // Soft vignette
    const vig = ctx.createRadialGradient(480, 260, 140, 480, 270, 500);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(38,50,56,0.28)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const MALL_5: MapDef = {
  id: "mall-5",
  env: "mall",
  name: "Escalator Loft",
  slot: 5,
  unlocked: true,
  matchSeconds: 255,
  customerSpawnMs: [3200, 4800],
  spawn: { x: 480, y: 360 },
  door: { x: 900, y: 55 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice", "ice_cream"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
