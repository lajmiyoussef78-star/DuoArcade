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
  drawTableCondiments,
  drawWallPicture,
  ensureCanvas,
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-diner-5-brunch-v4";

/**
 * DINER MAP 5 — Sunday Brunch
 *
 * L-shaped kitchen (distinct from maps 1–4):
 *   • Pantry column on the LEFT
 *   • Cook / fry / plates along the BOTTOM
 *   • Horizontal PASS between kitchen and dining
 *   • Brunch patio dining on the TOP-RIGHT
 *
 * Same stations / menu / controls as the other diner maps.
 * Stand points sit in walkable aisles outside counter colliders.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Left pantry column
  { x: 85, y: 230, w: 78, h: 250 },
  // Bottom cook — two blocks with a walkable gap between them
  { x: 310, y: 418, w: 340, h: 52 },
  { x: 720, y: 418, w: 320, h: 52 },
  // Horizontal pass
  { x: 420, y: 268, w: 400, h: 44 },
  // Dining patio furniture — spread across the reception floor
  { x: 575, y: 95, w: 78, h: 48 },
  { x: 860, y: 95, w: 78, h: 48 },
  { x: 575, y: 240, w: 56, h: 56 },
  { x: 860, y: 240, w: 56, h: 56 },
  { x: 720, y: 165, w: 70, h: 48 },
];

const APPLIANCES: ApplianceDef[] = [
  // Left pantry — stand east of crates
  { id: "pantry_tomato", x: 155, y: 130, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 155, y: 195, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_potato", x: 155, y: 260, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 155, y: 325, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // Bottom cook — stand SOUTH of counters; walkable gap between left & right blocks
  { id: "oven_a", x: 195, y: 470, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 290, y: 470, kind: "grill", label: "Grill" },
  { id: "prep_a", x: 385, y: 470, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 460, y: 470, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 615, y: 470, kind: "fryer", label: "Fryer" },
  { id: "plates", x: 710, y: 470, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_plates", x: 770, y: 470, kind: "counter", label: "Hold" },
  { id: "trash_a", x: 840, y: 470, kind: "trash", label: "Trash" },
  // Pass — usable from either side
  { id: "pass_a", x: 420, y: 268, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 575, y: 100 },
  { id: 1, x: 860, y: 100 },
  { id: 2, x: 575, y: 245 },
  { id: 3, x: 860, y: 245 },
  { id: 4, x: 720, y: 170 },
];

function drawBrunchFloor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // Soft cream dining tiles
  ctx.fillStyle = "#faf6f0";
  roundRect(ctx, x, y, w, h, 14, true);
  const step = 24;
  for (let yy = y + 6; yy < y + h - 6; yy += step) {
    for (let xx = x + 6; xx < x + w - 6; xx += step) {
      const warm = ((xx / step + yy / step) | 0) % 2 === 0;
      ctx.fillStyle = warm ? "#f5efe6" : "#fffdf8";
      ctx.fillRect(xx, yy, step - 1, step - 1);
      ctx.strokeStyle = "rgba(188,170,145,0.28)";
      ctx.lineWidth = 1;
      ctx.strokeRect(xx + 0.5, yy + 0.5, step - 2, step - 2);
    }
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
}

function drawKitchenHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // Cool sage-grey kitchen tile
  ctx.fillStyle = "#e8eeea";
  roundRect(ctx, x, y, w, h, 14, true);
  const step = 20;
  for (let yy = y + 6; yy < y + h - 6; yy += step) {
    for (let xx = x + 6; xx < x + w - 6; xx += step) {
      const dark = ((xx + yy) / step) % 2 < 1;
      ctx.fillStyle = dark ? "#d5ddd8" : "#eef3ef";
      ctx.fillRect(xx, yy, step - 1, step - 1);
    }
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
}

function drawPatioRug(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const rug = ctx.createLinearGradient(x, y, x + w, y + h);
  rug.addColorStop(0, "#dcedc8");
  rug.addColorStop(0.45, "#c5e1a5");
  rug.addColorStop(1, "#aed581");
  ctx.fillStyle = rug;
  roundRect(ctx, x, y, w, h, 18, true);
  ctx.strokeStyle = "#fff8e1";
  ctx.lineWidth = 4;
  roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 12, false);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const cx = x + 55 + i * 85;
      const cy = y + 50 + j * 70;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx + 12, cy);
      ctx.lineTo(cx, cy + 14);
      ctx.lineTo(cx - 12, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, w, h, 18, false);
}

function drawMorningWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w = 68, h = 34) {
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, "#90caf9");
  sky.addColorStop(0.5, "#ffe082");
  sky.addColorStop(1, "#ffcc80");
  ctx.fillStyle = sky;
  roundRect(ctx, x, y, w, h, 4, true);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  roundRect(ctx, x + 4, y + 3, w * 0.4, h * 0.35, 2, true);
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x - 3, y - 2, 7, h + 4, 2, true);
  roundRect(ctx, x + w - 4, y - 2, 7, h + 4, 2, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, w, h, 4, false);
}

function drawBrunchSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#fffdf8";
  roundRect(ctx, x, y, 128, 30, 6, true);
  ctx.strokeStyle = "#8bc34a";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 3, y + 3, 122, 24, 4, false);
  ctx.fillStyle = "#e65100";
  ctx.font = "bold 11px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SUNDAY BRUNCH", x + 64, y + 20);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 128, 30, 6, false);
}

function drawPlanter(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x, y + 22, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x - 12, y + 4, 24, 18, 4, true);
  ctx.fillStyle = "#a1887f";
  roundRect(ctx, x - 10, y + 6, 20, 6, 2, true);
  ctx.fillStyle = "#2e7d32";
  ctx.beginPath();
  ctx.ellipse(x - 6, y - 2, 8, 10, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 6, y - 4, 9, 11, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#66bb6a";
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 7, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 2);
  roundRect(ctx, x - 12, y + 4, 24, 18, 4, false);
}

function drawMintBooth(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 42, 48, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  roundRect(ctx, x - 52, y - 8, 28, 48, 8, true);
  ctx.fillStyle = "#33691e";
  roundRect(ctx, x - 50, y - 6, 24, 44, 7, true);
  ctx.fillStyle = "#7cb342";
  roundRect(ctx, x - 48, y, 20, 18, 5, true);

  ctx.fillStyle = INK;
  roundRect(ctx, x + 24, y - 8, 28, 48, 8, true);
  ctx.fillStyle = "#33691e";
  roundRect(ctx, x + 26, y - 6, 24, 44, 7, true);
  ctx.fillStyle = "#7cb342";
  roundRect(ctx, x + 28, y, 20, 18, 5, true);

  ctx.fillStyle = INK;
  roundRect(ctx, x - 22, y + 4, 44, 30, 6, true);
  ctx.fillStyle = "#fffdf8";
  roundRect(ctx, x - 20, y + 6, 40, 26, 5, true);
  ctx.fillStyle = "#ffe0b2";
  roundRect(ctx, x - 14, y + 12, 28, 12, 3, true);

  strokeInk(ctx, 2.5);
  roundRect(ctx, x - 52, y - 8, 28, 48, 8, false);
  roundRect(ctx, x + 24, y - 8, 28, 48, 8, false);
  roundRect(ctx, x - 22, y + 4, 44, 30, 6, false);
}

function drawPatioTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.ellipse(x, y, 21, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#aed581";
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x - 4, y + 10, 8, 10, 2, true);

  strokeInk(ctx, 2.5);
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 16, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawServiceSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#fffdf8";
  roundRect(ctx, x - 36, y - 14, 72, 20, 4, true);
  ctx.fillStyle = "#e65100";
  ctx.font = "bold 10px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS", x, y);
  strokeInk(ctx, 2);
  roundRect(ctx, x - 36, y - 14, 72, 20, 4, false);
}

function drawPendant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,213,79,0.18)";
  ctx.beginPath();
  ctx.moveTo(x - 3, y);
  ctx.lineTo(x + 3, y);
  ctx.lineTo(x + 22, y + 40);
  ctx.lineTo(x - 22, y + 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x - 9, y - 2, 18, 8, 3, true);
  ctx.fillStyle = "#ffd54f";
  ctx.beginPath();
  ctx.arc(x, y + 8, 5, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 2);
  roundRect(ctx, x - 9, y - 2, 18, 8, 3, false);
}

function drawBunting(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const colors = ["#ef5350", "#ffca28", "#66bb6a", "#42a5f5", "#ab47bc"];
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w / 2, y + 10, x + w, y);
  ctx.stroke();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const px = x + w * t;
    const py = y + 8 * Math.sin(t * Math.PI);
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.beginPath();
    ctx.moveTo(px - 7, py);
    ctx.lineTo(px + 7, py);
    ctx.lineTo(px, py + 14);
    ctx.closePath();
    ctx.fill();
    strokeInk(ctx, 1.5);
    ctx.beginPath();
    ctx.moveTo(px - 7, py);
    ctx.lineTo(px + 7, py);
    ctx.lineTo(px, py + 14);
    ctx.closePath();
    ctx.stroke();
  }
}

function drawChalkMenu(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x, y, 70, 56, 6, true);
  ctx.strokeStyle = "#8d6e63";
  ctx.lineWidth = 3;
  roundRect(ctx, x - 2, y - 2, 74, 60, 7, false);
  ctx.fillStyle = "#eceff1";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TODAY", x + 35, y + 14);
  ctx.fillStyle = "#b0bec5";
  ctx.font = "7px Sora, sans-serif";
  ctx.fillText("avocado toast", x + 35, y + 28);
  ctx.fillText("fresh juice", x + 35, y + 40);
  ctx.fillText("pastries", x + 35, y + 52);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 70, 56, 6, false);
}

function drawMimosaCart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 28, y + 52, 30, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 18, 56, 32, 6, true);
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 2, y + 20, 52, 28, 5, true);
  // Pitcher
  ctx.fillStyle = "#ffb74d";
  roundRect(ctx, x + 8, y + 6, 16, 22, 4, true);
  ctx.fillStyle = "#ffe082";
  roundRect(ctx, x + 10, y + 8, 12, 10, 3, true);
  // Glasses
  ctx.fillStyle = "rgba(129,199,132,0.85)";
  roundRect(ctx, x + 30, y + 14, 8, 16, 2, true);
  roundRect(ctx, x + 42, y + 14, 8, 16, 2, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 4, y + 46, 8, 6, 2, true);
  roundRect(ctx, x + 44, y + 46, 8, 6, 2, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y + 18, 56, 32, 6, false);
}

function drawKitchenShelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x, y + 28, 90, 8, 2, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x, y + 26, 90, 6, 2, true);
  // jars
  for (const [jx, color] of [
    [8, "#ef5350"],
    [30, "#ffca28"],
    [52, "#66bb6a"],
    [74, "#42a5f5"],
  ] as const) {
    ctx.fillStyle = color;
    roundRect(ctx, x + jx, y + 4, 14, 22, 3, true);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(ctx, x + jx + 2, y + 6, 5, 8, 2, true);
    ctx.fillStyle = "#5d4037";
    roundRect(ctx, x + jx + 2, y, 10, 5, 2, true);
  }
  strokeInk(ctx, 2);
  roundRect(ctx, x, y + 26, 90, 6, 2, false);
}

function drawFlowerVase(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#90caf9";
  roundRect(ctx, x - 5, y, 10, 12, 3, true);
  ctx.fillStyle = "#ef5350";
  ctx.beginPath();
  ctx.arc(x - 4, y - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffca28";
  ctx.beginPath();
  ctx.arc(x + 4, y - 5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#66bb6a";
  ctx.beginPath();
  ctx.arc(x, y - 8, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawClock(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#fffdf8";
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6d4c41";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 9);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 7, y + 2);
  ctx.stroke();
  strokeInk(ctx, 2);
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Soft morning wash — cream + sage
    const wash = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    wash.addColorStop(0, "#f7f3eb");
    wash.addColorStop(0.4, "#efe8dc");
    wash.addColorStop(1, "#e4efe6");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Kitchen L (bottom + left)
    drawKitchenHex(ctx, 28, 100, 500, 412);
    drawBrunchFloor(ctx, 28, 28, 500, 90);

    // Dining patio (top-right)
    drawBrunchFloor(ctx, 520, 28, 412, 300);
    drawPatioRug(ctx, 545, 48, 370, 255);

    // Kitchen continuation under pass / right of pantry
    drawKitchenHex(ctx, 520, 320, 412, 192);

    drawFloorDirt(ctx, 200, 200, 50, 35);
    drawFloorDirt(ctx, 650, 380, 45, 30);

    // Wall decor
    drawMorningWindow(ctx, 555, 36);
    drawMorningWindow(ctx, 645, 36);
    drawMorningWindow(ctx, 735, 36);
    drawBrunchSign(ctx, 812, 34);
    drawBunting(ctx, 548, 72, 250);
    drawChalkMenu(ctx, 48, 40);
    drawClock(ctx, 140, 55);
    drawWallPicture(ctx, 200, 42);
    drawWallPicture(ctx, 270, 42);
    drawKitchenShelf(ctx, 330, 38);

    // Pendant lights over dining
    drawPendant(ctx, 575, 55);
    drawPendant(ctx, 720, 50);
    drawPendant(ctx, 860, 55);

    // Plants & brunch props (kept out of walk aisles)
    drawPlanter(ctx, 540, 290);
    drawPlanter(ctx, 900, 290);
    drawPlanter(ctx, 500, 120);
    drawPlanter(ctx, 505, 200);
    drawMimosaCart(ctx, 870, 300);

    // —— Left pantry column ——
    drawCounterIsland(ctx, 45, 105, 70, 250, "#d7a86e", "#6d4c41");
    drawTomatoCrate(ctx, 52, 115);
    drawMozzarellaBowl(ctx, 52, 180);
    drawPotatoCrate(ctx, 52, 245);
    drawDoughCrate(ctx, 52, 310);

    // —— Bottom cook line (gap between blocks so you can walk through) ——
    drawDarkCookCounter(ctx, 140, 390, 340, 55);
    drawOven(ctx, 145, 385);
    drawGrill(ctx, 245, 385);
    drawCuttingBoard(ctx, 355, 402);
    drawSink(ctx, 425, 398);

    drawMarbleCounter(ctx, 560, 390, 320, 55);
    drawFryer(ctx, 570, 380);
    drawPlateStack(ctx, 675, 385);
    drawTrash(ctx, 810, 392);

    // Horizontal pass
    drawCounterIsland(ctx, 220, 245, 400, 48, "#ffe0b2", "#ef6c00");
    drawServiceSign(ctx, 420, 240);
    drawFlowerVase(ctx, 280, 250);
    drawFlowerVase(ctx, 560, 250);

    // —— Dining patio (spread) ——
    drawMintBooth(ctx, 575, 70);
    drawMintBooth(ctx, 860, 70);
    drawPatioTable(ctx, 575, 220);
    drawPatioTable(ctx, 860, 220);
    drawMintBooth(ctx, 720, 140);
    drawTableCondiments(ctx, 575, 218);
    drawTableCondiments(ctx, 860, 218);
    drawFlowerVase(ctx, 720, 148);

    drawDoor(ctx, 880, 250);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const DINER_5: MapDef = {
  id: "diner-5",
  env: "diner",
  name: "Sunday Brunch",
  slot: 5,
  unlocked: true,
  matchSeconds: 210,
  customerSpawnMs: [4200, 6400],
  spawn: { x: 520, y: 470 },
  door: { x: 880, y: 280 },
  menu: ["pizza", "salad", "fries_meal"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
