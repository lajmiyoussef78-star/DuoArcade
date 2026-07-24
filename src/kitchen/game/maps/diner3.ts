import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawCounterIsland,
  drawCuttingBoard,
  drawDarkCookCounter,
  drawDoor,
  drawDoughCrate,
  drawFloorDirt,
  drawFryer,
  drawGrill,
  drawMarbleCounter,
  drawMozzarellaBowl,
  drawOven,
  drawPlateStack,
  drawPotatoCrate,
  drawSink,
  drawTomatoCrate,
  drawTrash,
  drawWoodFloor,
  ensureCanvas,
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-diner-3-evening-v9";

/**
 * DINER MAP 3 — Evening Service
 *
 * Classic American front-counter diner (not a galley / circular kitchen):
 *   • Kitchen along the TOP (pantry bar → cook / prep / fryer)
 *   • Long HORIZONTAL pass as the service counter
 *   • Dining LOUNGE below + to the right (booths & round chrome tables)
 *
 * Same stations / menu / controls as Morning Rush & Cozy Lunch.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Top cook line (oven · grill · prep · fryer · trash)
  { x: 140, y: 90, w: 180, h: 52 },
  { x: 320, y: 90, w: 150, h: 52 },
  { x: 460, y: 90, w: 110, h: 52 },
  { x: 545, y: 85, w: 42, h: 40 },
  // Mid pantry bar — 4 kitchen tiles down; stand from north (inverted)
  { x: 230, y: 263, w: 380, h: 48 },
  // Long horizontal pass (service counter)
  { x: 260, y: 348, w: 420, h: 44 },
  // Dining booths / tables
  { x: 145, y: 405, w: 78, h: 48 },
  { x: 310, y: 405, w: 78, h: 48 },
  { x: 620, y: 195, w: 56, h: 56 },
  { x: 800, y: 280, w: 78, h: 48 },
  { x: 640, y: 400, w: 56, h: 56 },
];

const APPLIANCES: ApplianceDef[] = [
  // Top cook / prep / fry — stand south of counters
  { id: "oven_a", x: 90, y: 130, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 175, y: 130, kind: "grill", label: "Grill" },
  { id: "prep_a", x: 270, y: 130, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 350, y: 130, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 450, y: 130, kind: "fryer", label: "Fryer" },
  { id: "trash_a", x: 545, y: 125, kind: "trash", label: "Trash" },
  // Mid pantry — stand on kitchen side (north of counter)
  { id: "pantry_tomato", x: 70, y: 212, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 145, y: 212, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_potato", x: 220, y: 212, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 295, y: 212, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  { id: "plates", x: 380, y: 212, kind: "plates", label: "Plates", dispenses: "plate" },
  // Hold — right margin of the plates
  { id: "hold_plates", x: 435, y: 212, kind: "counter", label: "Hold" },
  // Pass — center of the long service counter (any side)
  { id: "pass_a", x: 260, y: 348, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 145, y: 410 },
  { id: 1, x: 310, y: 410 },
  { id: 2, x: 620, y: 200 },
  { id: 3, x: 800, y: 285 },
  { id: 4, x: 640, y: 405 },
];

function drawDinerTileFloor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#1a1a1a";
  roundRect(ctx, x, y, w, h, 14, true);
  const step = 22;
  for (let yy = y + 6; yy < y + h - 6; yy += step) {
    for (let xx = x + 6; xx < x + w - 6; xx += step) {
      const dark = ((xx + yy) / step) % 2 < 1;
      ctx.fillStyle = dark ? "#212121" : "#fafafa";
      ctx.fillRect(xx, yy, step - 1, step - 1);
    }
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
}

function drawLoungeCarpet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#3e2723";
  roundRect(ctx, x, y, w, h, 18, true);
  const rug = ctx.createLinearGradient(x, y, x + w, y + h);
  rug.addColorStop(0, "#4e342e");
  rug.addColorStop(0.5, "#5d4037");
  rug.addColorStop(1, "#3e2723");
  ctx.fillStyle = rug;
  roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 14, true);
  ctx.strokeStyle = "#ff8a65";
  ctx.lineWidth = 3;
  roundRect(ctx, x + 18, y + 18, w - 36, h - 36, 10, false);
  // Soft diamond pattern
  ctx.strokeStyle = "rgba(255,171,145,0.12)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const cx = x + 80 + i * 70;
    const cy = y + h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 28);
    ctx.lineTo(cx + 22, cy);
    ctx.lineTo(cx, cy + 28);
    ctx.lineTo(cx - 22, cy);
    ctx.closePath();
    ctx.stroke();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, w, h, 18, false);
}

function drawSunsetWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w = 70, h = 34) {
  const dusk = ctx.createLinearGradient(x, y, x, y + h);
  dusk.addColorStop(0, "#ffab40");
  dusk.addColorStop(0.45, "#ef5350");
  dusk.addColorStop(1, "#4527a0");
  ctx.fillStyle = dusk;
  roundRect(ctx, x, y, w, h, 4, true);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  roundRect(ctx, x + 4, y + 3, w * 0.4, h * 0.35, 2, true);
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x - 3, y - 2, 8, h + 4, 2, true);
  roundRect(ctx, x + w - 5, y - 2, 8, h + 4, 2, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, w, h, 4, false);
}

function drawNeonBanner(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#212121";
  roundRect(ctx, x, y, 130, 32, 6, true);
  ctx.strokeStyle = "#ff5252";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 3, y + 3, 124, 26, 4, false);
  ctx.fillStyle = "#ff8a80";
  ctx.font = "bold 12px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("OPEN LATE", x + 65, y + 21);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 130, 32, 6, false);
}

function drawChromeStool(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x, y + 16, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ef5350";
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#90a4ae";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Facing booth pair with a Formica table between — classic diner banquette. */
function drawBanquetteBooth(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y + 42, 48, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Left high-back
  ctx.fillStyle = INK;
  roundRect(ctx, x - 52, y - 8, 28, 48, 8, true);
  ctx.fillStyle = "#00695c";
  roundRect(ctx, x - 50, y - 6, 24, 44, 7, true);
  ctx.fillStyle = "#00897b";
  roundRect(ctx, x - 48, y, 20, 18, 5, true);

  // Right high-back
  ctx.fillStyle = INK;
  roundRect(ctx, x + 24, y - 8, 28, 48, 8, true);
  ctx.fillStyle = "#00695c";
  roundRect(ctx, x + 26, y - 6, 24, 44, 7, true);
  ctx.fillStyle = "#00897b";
  roundRect(ctx, x + 28, y, 20, 18, 5, true);

  // Table
  ctx.fillStyle = INK;
  roundRect(ctx, x - 22, y + 4, 44, 30, 6, true);
  ctx.fillStyle = "#fff3e0";
  roundRect(ctx, x - 20, y + 6, 40, 26, 5, true);
  ctx.fillStyle = "#ffcc80";
  roundRect(ctx, x - 14, y + 12, 28, 12, 3, true);
  // Napkin / ketchup
  ctx.fillStyle = "#e0f2f1";
  roundRect(ctx, x - 8, y + 14, 7, 8, 1, true);
  roundRect(ctx, x + 2, y + 14, 7, 8, 1, true);
  ctx.fillStyle = "#c62828";
  ctx.beginPath();
  ctx.arc(x, y + 18, 3, 0, Math.PI * 2);
  ctx.fill();

  strokeInk(ctx, 2.5);
  roundRect(ctx, x - 52, y - 8, 28, 48, 8, false);
  roundRect(ctx, x + 24, y - 8, 28, 48, 8, false);
  roundRect(ctx, x - 22, y + 4, 44, 30, 6, false);
}

/** Round chrome-rim table with two stools — lounge seating. */
function drawRoundChromeTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawChromeStool(ctx, x - 32, y + 8);
  drawChromeStool(ctx, x + 32, y + 8);

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eceff1";
  ctx.beginPath();
  ctx.ellipse(x, y, 21, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#90a4ae";
  ctx.beginPath();
  ctx.ellipse(x, y, 18, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Specular
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(x - 6, y - 4, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Pedestal
  ctx.fillStyle = "#546e7a";
  roundRect(ctx, x - 4, y + 10, 8, 10, 2, true);
  ctx.fillStyle = "#78909c";
  ctx.beginPath();
  ctx.ellipse(x, y + 20, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  strokeInk(ctx, 2.5);
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 16, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Wall booth along the right — single long banquette + side table. */
function drawWallBooth(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x + 20, y + 40, 40, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bench back against “wall”
  ctx.fillStyle = INK;
  roundRect(ctx, x, y - 6, 70, 20, 6, true);
  ctx.fillStyle = "#bf360c";
  roundRect(ctx, x + 2, y - 4, 66, 16, 5, true);
  // Seat
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 10, 70, 22, 6, true);
  ctx.fillStyle = "#e64a19";
  roundRect(ctx, x + 2, y + 12, 66, 18, 5, true);
  // Small table in front
  ctx.fillStyle = INK;
  roundRect(ctx, x + 12, y + 28, 46, 18, 5, true);
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 14, y + 30, 42, 14, 4, true);

  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y - 6, 70, 20, 6, false);
  roundRect(ctx, x, y + 10, 70, 22, 6, false);
  roundRect(ctx, x + 12, y + 28, 46, 18, 5, false);
}

function drawJukebox(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x + 4, y + 58, 40, 6);
  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 48, 58, 8, true);
  const glow = ctx.createLinearGradient(x, y, x + 48, y + 58);
  glow.addColorStop(0, "#7b1fa2");
  glow.addColorStop(0.5, "#e91e63");
  glow.addColorStop(1, "#ff5722");
  ctx.fillStyle = glow;
  roundRect(ctx, x + 3, y + 3, 42, 52, 6, true);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, x + 8, y + 8, 32, 18, 4, true);
  ctx.fillStyle = "#212121";
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, x + 10, y + 32 + i * 7, 28, 5, 2, true);
  }
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 48, 58, 8, false);
}

function drawServiceSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#e65100";
  ctx.font = "bold 10px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✦  SERVICE COUNTER  ✦", x, y);
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawWoodFloor(ctx, 0, 0, MAP_W, MAP_H, "#4e342e");

    // Kitchen — black & white diner tile (top zone)
    drawDinerTileFloor(ctx, 36, 48, 540, 220);
    drawFloorDirt(ctx, 200, 140, 180, 80);

    // Dining lounge — warm carpet + right wing
    drawLoungeCarpet(ctx, 36, 330, 480, 155);
    drawLoungeCarpet(ctx, 530, 70, 390, 415);

    // Walls
    ctx.fillStyle = "#263238";
    ctx.fillRect(0, 0, MAP_W, 46);
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(0, 40, MAP_W, 6);
    drawSunsetWindow(ctx, 200, 5);
    drawSunsetWindow(ctx, 300, 5);
    drawSunsetWindow(ctx, 560, 5);
    drawSunsetWindow(ctx, 660, 5);
    drawSunsetWindow(ctx, 760, 5);
    drawNeonBanner(ctx, 40, 6);
    strokeInk(ctx, 4);
    ctx.strokeRect(2, 2, MAP_W - 4, 44);

    ctx.fillStyle = "#263238";
    ctx.fillRect(0, 0, 34, MAP_H);
    ctx.fillRect(MAP_W - 34, 0, 34, MAP_H);
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(0, MAP_H - 26, 34, 26);
    ctx.fillRect(MAP_W - 34, MAP_H - 26, 34, 26);

    // Lounge title
    ctx.fillStyle = "#ffab91";
    ctx.font = "bold 12px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LOUNGE  ·  EVENING SERVICE", 720, 95);

    // —— Kitchen (top) ——
    // Cook · prep · fry along the back wall
    drawDarkCookCounter(ctx, 50, 55, 180, 58);
    drawOven(ctx, 55, 30);
    drawGrill(ctx, 140, 27);

    drawMarbleCounter(ctx, 245, 60, 150, 52);
    drawCuttingBoard(ctx, 255, 67);
    drawSink(ctx, 325, 65);

    drawCounterIsland(ctx, 405, 60, 120, 55, "#e8c9a0", "#00897b");
    drawFryer(ctx, 415, 43);
    drawTrash(ctx, 530, 55);

    // Pantry bar — 4 kitchen floor tiles down; stands on kitchen side (north)
    drawCounterIsland(ctx, 45, 228, 400, 55, "#d7a86e", "#6d4c41");
    drawTomatoCrate(ctx, 50, 220);
    drawMozzarellaBowl(ctx, 125, 222);
    drawPotatoCrate(ctx, 200, 220);
    drawDoughCrate(ctx, 275, 222);
    drawPlateStack(ctx, 350, 216);

    // Long horizontal service / pass counter
    drawCounterIsland(ctx, 50, 320, 420, 55, "#ffe0b2", "#ff6f00");
    drawServiceSign(ctx, 260, 315);
    // Chrome stools on the dining side of the pass
    drawChromeStool(ctx, 100, 382);
    drawChromeStool(ctx, 170, 382);
    drawChromeStool(ctx, 240, 382);
    drawChromeStool(ctx, 310, 382);
    drawChromeStool(ctx, 380, 382);

    // —— Dining lounge ——
    drawBanquetteBooth(ctx, 145, 380);
    drawBanquetteBooth(ctx, 310, 380);
    drawRoundChromeTable(ctx, 620, 185);
    drawWallBooth(ctx, 770, 250);
    drawRoundChromeTable(ctx, 640, 390);

    drawJukebox(ctx, 880, 120);
    drawDoor(ctx, 480, 440);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const DINER_3: MapDef = {
  id: "diner-3",
  env: "diner",
  name: "Evening Service",
  slot: 3,
  unlocked: true,
  matchSeconds: 210,
  customerSpawnMs: [4200, 6400],
  spawn: { x: 260, y: 170 },
  door: { x: 510, y: 500 },
  menu: ["pizza", "salad", "fries_meal"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
