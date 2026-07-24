import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  INK,
  drawCheckerPad,
  drawCounterIsland,
  drawCuttingBoardVertical,
  drawDarkCookCounter,
  drawDoor,
  drawDoughCrate,
  drawFloorDirt,
  drawFryer,
  drawGrill,
  drawMozzarellaBowl,
  drawOven,
  drawPlateStack,
  drawPotatoCrate,
  drawRestaurantLogo,
  drawSinkFacingWest,
  drawTableCondiments,
  drawTomatoCrate,
  drawTrash,
  drawWoodFloor,
  ensureCanvas,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-diner-2-cozy-v25";

/**
 * DINER MAP 2 — Cozy Lunch
 *
 * Same restaurant as Morning Rush, remodeled for lunch service.
 * Circular kitchen flow (distinct from Morning Rush's vertical stack):
 *   cook line along the TOP
 *   ingredient column on the LEFT
 *   prep / sink on the RIGHT (face interior)
 *   plates + fryer along the BOTTOM (above MENU bar)
 *   vertical PASS between kitchen and dining
 *
 * Same stations / menu / controls as Morning Rush — layout & look only.
 * Interact points sit in walkable space in front of each station.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Top cook line (oven · grill)
  { x: 160, y: 90, w: 200, h: 55 },
  // Ingredient column — stand east on floor
  { x: 66, y: 255, w: 48, h: 160 },
  // Prep + sink — stand west on floor
  { x: 300, y: 222, w: 52, h: 148 },
  // Fryer · plates — covers counter only; floor strip north stays walkable
  { x: 195, y: 430, w: 195, h: 38 },
  // Trash
  { x: 48, y: 448, w: 40, h: 40 },
  // Pass — interact from any side (point at table center)
  { x: 385, y: 228, w: 48, h: 120 },
  // Dining tables
  { x: 520, y: 160, w: 42, h: 30 },
  { x: 790, y: 175, w: 42, h: 30 },
  { x: 655, y: 285, w: 42, h: 30 },
  { x: 505, y: 395, w: 42, h: 30 },
  { x: 770, y: 405, w: 42, h: 30 },
];

const APPLIANCES: ApplianceDef[] = [
  // Top — stand south of cook counter
  { id: "oven_a", x: 100, y: 140, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 205, y: 140, kind: "grill", label: "Grill" },
  // Left ingredients — stand on floor east of each crate center
  { id: "pantry_tomato", x: 102, y: 195, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 102, y: 245, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_potato", x: 102, y: 295, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 102, y: 340, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // Right chop/sink — stand on floor west of board / basin
  { id: "prep_a", x: 255, y: 180, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 255, y: 258, kind: "sink", label: "Sink" },
  // Bottom — stand on floor north of counter (not on the counter top)
  { id: "fryer_a", x: 148, y: 378, kind: "fryer", label: "Fryer" },
  { id: "plates", x: 247, y: 378, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "trash_a", x: 78, y: 415, kind: "trash", label: "Trash" },
  // Pass — center of table; reachable from any side
  { id: "pass_a", x: 385, y: 228, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 480, y: 165 },
  { id: 1, x: 830, y: 180 },
  { id: 2, x: 655, y: 290 },
  { id: 3, x: 465, y: 400 },
  { id: 4, x: 810, y: 410 },
];

function drawLargeWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w = 72, h = 36) {
  const sun = ctx.createLinearGradient(x, y, x + w, y + h);
  sun.addColorStop(0, "#fff9c4");
  sun.addColorStop(0.45, "#81d4fa");
  sun.addColorStop(1, "#4fc3f7");
  ctx.fillStyle = sun;
  roundRect(ctx, x, y, w, h, 5, true);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  roundRect(ctx, x + 5, y + 4, w * 0.38, h * 0.35, 3, true);
  ctx.fillStyle = "#a5d6a7";
  roundRect(ctx, x - 4, y - 2, 10, h + 6, 3, true);
  roundRect(ctx, x + w - 6, y - 2, 10, h + 6, 3, true);
  ctx.fillStyle = "#81c784";
  roundRect(ctx, x - 2, y, 6, h + 2, 2, true);
  roundRect(ctx, x + w - 4, y, 6, h + 2, 2, true);
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, w, h, 5, false);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
}

function drawPendant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 22);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 22);
  ctx.lineTo(x + 14, y + 22);
  ctx.lineTo(x + 8, y + 38);
  ctx.lineTo(x - 8, y + 38);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 24);
  ctx.lineTo(x + 10, y + 24);
  ctx.lineTo(x + 6, y + 34);
  ctx.lineTo(x - 6, y + 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 236, 179, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + 52, 28, 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x, y + 18, 22, 16, 3, true);
  ctx.fillStyle = "#a1887f";
  roundRect(ctx, x + 2, y + 20, 18, 10, 2, true);
  ctx.fillStyle = "#66bb6a";
  for (const [ox, oy, r] of [
    [11, 10, 9],
    [4, 14, 7],
    [18, 14, 7],
    [11, 4, 6],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 2);
  roundRect(ctx, x, y + 18, 22, 16, 3, false);
}

function drawWallShelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x, y + 18, 70, 6, 2, true);
  ctx.fillStyle = "#eceff1";
  ctx.beginPath();
  ctx.arc(x + 14, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 34, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#bcaaa4";
  roundRect(ctx, x + 48, y + 4, 14, 14, 2, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x, y + 18, 70, 6, 2, false);
}

function drawWallClock(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#efebe9";
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 2.5);
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 8);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 6, y + 2);
  ctx.stroke();
}

function drawChalkboard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x - 2, y - 2, 64, 44, 4, true);
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x, y, 60, 40, 3, true);
  ctx.fillStyle = "#cfd8dc";
  ctx.font = "bold 7px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TODAY", x + 30, y + 12);
  ctx.fillStyle = "#a5d6a7";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.fillText("Soup  ·  Pie", x + 30, y + 26);
  strokeInk(ctx, 2);
  roundRect(ctx, x, y, 60, 40, 3, false);
}

function drawMenuBoard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x, y, 52, 70, 4, true);
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 4, y + 6, 44, 58, 3, true);
  ctx.fillStyle = "#bf360c";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MENU", x + 26, y + 20);
  ctx.fillStyle = "#5d4037";
  ctx.font = "6px Sora, sans-serif";
  ctx.fillText("Pizza", x + 26, y + 34);
  ctx.fillText("Salad", x + 26, y + 46);
  ctx.fillText("Fries", x + 26, y + 58);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 52, 70, 4, false);
}

function drawBarrel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x + 16, y + 36, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x, y, 32, 34, 8, true);
  ctx.fillStyle = "#a1887f";
  roundRect(ctx, x + 3, y + 4, 26, 26, 6, true);
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 2;
  for (const yy of [y + 10, y + 20]) {
    ctx.beginPath();
    ctx.moveTo(x + 2, yy);
    ctx.lineTo(x + 30, yy);
    ctx.stroke();
  }
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 32, 34, 8, false);
}

function drawCoffeeCart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x, y + 18, 48, 28, 4, true);
  ctx.fillStyle = "#efebe9";
  roundRect(ctx, x + 3, y + 20, 42, 22, 3, true);
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x + 10, y + 4, 28, 18, 4, true);
  ctx.fillStyle = "#d7ccc8";
  roundRect(ctx, x + 14, y + 8, 20, 10, 2, true);
  ctx.fillStyle = "#ffcc80";
  ctx.beginPath();
  ctx.arc(x + 12, y + 32, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 36, y + 32, 5, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 2);
  roundRect(ctx, x, y + 18, 48, 28, 4, false);
}

function drawNapkinStation(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x, y, 36, 22, 3, true);
  ctx.fillStyle = "#e3f2fd";
  roundRect(ctx, x + 4, y + 4, 12, 14, 2, true);
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 18, y + 4, 12, 14, 2, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x, y, 36, 22, 3, false);
}

function drawEntranceRug(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#c62828";
  roundRect(ctx, x, y, 90, 36, 6, true);
  ctx.fillStyle = "#ef9a9a";
  roundRect(ctx, x + 6, y + 5, 78, 26, 4, true);
  ctx.fillStyle = "#b71c1c";
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + 12 + i * 14, y + 8, 6, 20);
  }
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 90, 36, 6, false);
}

function drawKitchenShelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x, y, 86, 8, 2, true);
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, x + 6, y - 16, 18, 16, 2, true);
  roundRect(ctx, x + 30, y - 14, 16, 14, 2, true);
  ctx.fillStyle = "#ffe0b2";
  roundRect(ctx, x + 52, y - 18, 14, 18, 2, true);
  ctx.fillStyle = "#a5d6a7";
  roundRect(ctx, x + 70, y - 12, 12, 12, 2, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x, y, 86, 8, 2, false);
}

function drawTightStationPad(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.beginPath();
  ctx.ellipse((left + right) / 2, bottom + 4, (right - left) * 0.42, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#90a4ae";
  roundRect(ctx, left, top + 10, right - left, bottom - top - 8, 8, true);
  ctx.fillStyle = "#cfd8dc";
  roundRect(ctx, left, top, right - left, bottom - top - 6, 8, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, left, top, right - left, bottom - top - 6, 8, false);
}

/** Dark wood chairs + white cloth + soft green runner. */
function drawCozyDiningSet(ctx: CanvasRenderingContext2D, x: number, y: number, flower = false) {
  for (const [cx, cy] of [
    [x - 34, y + 4],
    [x + 34, y + 4],
  ] as const) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 18, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4e342e";
    roundRect(ctx, cx - 12, cy, 24, 18, 4, true);
    ctx.fillStyle = "#6d4c41";
    roundRect(ctx, cx - 10, cy + 2, 20, 10, 3, true);
    strokeInk(ctx, 2);
    roundRect(ctx, cx - 12, cy, 24, 18, 4, false);
  }
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x, y + 22, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRect(ctx, x - 26, y - 8, 52, 36, 8, true);
  ctx.fillStyle = "#fffef7";
  roundRect(ctx, x - 24, y - 6, 48, 32, 7, true);
  ctx.fillStyle = "#c8e6c9";
  roundRect(ctx, x - 8, y - 4, 16, 28, 3, true);
  ctx.fillStyle = "#a5d6a7";
  roundRect(ctx, x - 5, y, 10, 18, 2, true);
  if (flower) {
    ctx.fillStyle = "#ef9a9a";
    ctx.beginPath();
    ctx.arc(x, y + 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#66bb6a";
    ctx.fillRect(x - 1, y + 10, 2, 6);
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x - 26, y - 8, 52, 36, 8, false);
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawWoodFloor(ctx, 0, 0, MAP_W, MAP_H, "#c49a6c");

    ctx.fillStyle = "rgba(255, 248, 225, 0.18)";
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Kitchen pad — ends above MENU ribbon
    drawCheckerPad(ctx, 38, 52, 310, 398, "#faf6ef", "#c5d8b8");
    drawFloorDirt(ctx, 80, 180, 160, 80);

    // Dining rug
    ctx.fillStyle = "rgba(80, 55, 35, 0.16)";
    roundRect(ctx, 430, 58, 490, 390, 22, true);
    ctx.fillStyle = "#efe6d6";
    roundRect(ctx, 440, 68, 470, 370, 18, true);
    ctx.strokeStyle = "#81c784";
    ctx.lineWidth = 5;
    roundRect(ctx, 448, 76, 454, 354, 14, false);
    strokeInk(ctx, 3);
    roundRect(ctx, 440, 68, 470, 370, 18, false);

    drawRestaurantLogo(ctx, 670, 118);
    ctx.fillStyle = "#5d4037";
    ctx.font = "bold 11px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("COZY LUNCH  ·  DINING", 670, 92);

    // Cream walls + soft green trim
    ctx.fillStyle = "#f5f0e6";
    ctx.fillRect(0, 0, MAP_W, 48);
    ctx.fillStyle = "#a5d6a7";
    ctx.fillRect(0, 42, MAP_W, 6);
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(0, 40, MAP_W, 2);

    drawLargeWindow(ctx, 430, 6, 78, 34);
    drawLargeWindow(ctx, 530, 6, 78, 34);
    drawLargeWindow(ctx, 630, 6, 78, 34);
    drawLargeWindow(ctx, 740, 6, 78, 34);

    drawWallShelf(ctx, 90, 8);
    drawWallShelf(ctx, 220, 8);
    drawWallClock(ctx, 340, 22);
    drawChalkboard(ctx, 860, 55);

    strokeInk(ctx, 4);
    ctx.strokeRect(2, 2, MAP_W - 4, 46);

    ctx.fillStyle = "#f5f0e6";
    ctx.fillRect(0, 0, 36, MAP_H);
    ctx.fillRect(MAP_W - 36, 0, 36, MAP_H);
    ctx.fillStyle = "#81c784";
    ctx.fillRect(0, MAP_H - 28, 36, 28);
    ctx.fillRect(MAP_W - 36, MAP_H - 28, 36, 28);

    drawPendant(ctx, 520, 48);
    drawPendant(ctx, 655, 48);
    drawPendant(ctx, 790, 48);

    // —— Kitchen ——
    // Top cook: oven + grill
    drawDarkCookCounter(ctx, 55, 50, 210, 68);
    drawOven(ctx, 55, 25);
    drawGrill(ctx, 160, 22);
    drawKitchenShelf(ctx, 55, 48);

    // Ingredient column — shifted up 2 floor tiles toward oven
    drawCounterIsland(ctx, 42, 167, 52, 185, "#d7a86e", "#8d6e63");
    drawTomatoCrate(ctx, 47, 172);
    drawMozzarellaBowl(ctx, 47, 222);
    drawPotatoCrate(ctx, 47, 272);
    drawDoughCrate(ctx, 47, 317);

    // Prep + sink — right side of kitchen, face west toward interior
    {
      const pad = 7;
      const boardX = 278;
      const boardY = 155;
      const sinkX = 272;
      const sinkY = 230;
      drawTightStationPad(
        ctx,
        Math.min(boardX, sinkX) - pad,
        boardY - pad,
        Math.max(boardX + 34, sinkX + 48) + pad,
        sinkY + 58 + pad,
      );
      drawCuttingBoardVertical(ctx, boardX, boardY);
      drawSinkFacingWest(ctx, sinkX, sinkY);
    }

    // Fryer · plates — green face flush with kitchen pad bottom
    drawCounterIsland(ctx, 95, 395, 200, 55, "#e8c9a0", "#66bb6a");
    drawFryer(ctx, 100, 375);
    drawPlateStack(ctx, 215, 390);
    drawTrash(ctx, 28, 420);

    // Pass — vertical bridge between kitchen & dining
    drawCounterIsland(ctx, 350, 150, 70, 155, "#ffe0b2", "#ff9800");
    ctx.fillStyle = "#e65100";
    ctx.font = "bold 9px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PASS", 385, 145);

    // —— Dining ——
    drawCozyDiningSet(ctx, 520, 155, true);
    drawCozyDiningSet(ctx, 790, 170, false);
    drawCozyDiningSet(ctx, 655, 280, true);
    drawCozyDiningSet(ctx, 505, 390, false);
    drawCozyDiningSet(ctx, 770, 400, true);
    drawTableCondiments(ctx, 520, 153);
    drawTableCondiments(ctx, 790, 168);
    drawTableCondiments(ctx, 655, 278);
    drawTableCondiments(ctx, 505, 388);
    drawTableCondiments(ctx, 770, 398);

    // Decor — kept off main kitchen walk path
    drawPlant(ctx, 420, 340);
    drawPlant(ctx, 880, 300);
    drawPlant(ctx, 430, 430);
    drawBarrel(ctx, 880, 430);
    drawBarrel(ctx, 420, 420);
    drawCoffeeCart(ctx, 860, 200);
    drawNapkinStation(ctx, 710, 220);
    drawMenuBoard(ctx, 880, 100);
    drawEntranceRug(ctx, 610, 455);
    drawDoor(ctx, 640, 430);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const DINER_2: MapDef = {
  id: "diner-2",
  env: "diner",
  name: "Cozy Lunch",
  slot: 2,
  unlocked: true,
  matchSeconds: 210,
  customerSpawnMs: [4200, 6400],
  spawn: { x: 230, y: 300 },
  door: { x: 655, y: 500 },
  menu: ["pizza", "salad", "fries_meal"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
