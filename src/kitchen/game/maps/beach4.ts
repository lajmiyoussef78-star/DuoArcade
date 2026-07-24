import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawBunCrate,
  drawCounterIsland,
  drawCuttingBoard,
  drawDoor,
  drawDoughCrate,
  drawFryer,
  drawGrill,
  drawJuiceMachine,
  drawMozzarellaBowl,
  drawOven,
  drawPattyTray,
  drawPlateStack,
  drawPotatoCrate,
  drawSink,
  drawTableCondiments,
  drawTomatoCrate,
  drawTrash,
  ensureCanvas,
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-beach-4-coral-v5";

/**
 * BEACH MAP 4 — Coral Cove
 *
 * Distinct from maps 1–3:
 *   • Coral dining along the TOP (so order bubbles never cover stations)
 *   • U-shaped kitchen around a central lagoon below the dining strip
 *   • Cook along the TOP of the U
 *   • Pantry down the RIGHT arm
 *   • Fryer / plates / holds on the LEFT arm
 *   • Juice NE of the cook bar (east of sink), facing the dining tables
 *
 * Same stations / menu / timing as the other Beach House maps.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Dining tables (top strip)
  { x: 200, y: 100, w: 70, h: 48 },
  { x: 380, y: 100, w: 70, h: 48 },
  { x: 580, y: 100, w: 70, h: 48 },
  { x: 760, y: 100, w: 70, h: 48 },
  // Cook bar (top of U) — starts further east so west walk stays open
  { x: 520, y: 195, w: 460, h: 52 },
  // Juice pad — east of sink, above pantry, facing dining
  { x: 800, y: 200, w: 80, h: 55 },
  // Left arm — fryer / plates / holds (lower, leaves NW aisle to dining)
  { x: 200, y: 410, w: 100, h: 180 },
  // Right arm — pantry
  { x: 760, y: 360, w: 100, h: 280 },
  // Lagoon pool (impassable water)
  { x: 480, y: 335, w: 260, h: 100 },
  // Pass at mouth of U
  { x: 480, y: 420, w: 160, h: 44 },
];

const APPLIANCES: ApplianceDef[] = [
  // Top cook — stand south into the U
  { id: "oven_a", x: 320, y: 245, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 410, y: 245, kind: "grill", label: "Grill" },
  { id: "trash_a", x: 490, y: 245, kind: "trash", label: "Trash" },
  { id: "prep_a", x: 570, y: 245, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 660, y: 245, kind: "sink", label: "Sink" },
  // Juice — east of sink; stand north so you face the clients while pouring
  { id: "juice_a", x: 800, y: 155, kind: "juice", label: "Juice", dispenses: "juice" },
  // Left arm — stand east (toward lagoon)
  { id: "fryer_a", x: 270, y: 350, kind: "fryer", label: "Fryer" },
  { id: "plates", x: 270, y: 410, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_bar_l", x: 270, y: 455, kind: "counter", label: "Hold" },
  { id: "hold_bar_r", x: 330, y: 455, kind: "counter", label: "Hold" },
  // Right pantry — stand west (toward lagoon)
  { id: "pantry_tomato", x: 690, y: 270, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 690, y: 315, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 690, y: 360, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 690, y: 405, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 690, y: 450, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 690, y: 490, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // Pass at open mouth of U
  { id: "pass_a", x: 480, y: 420, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 200, y: 105 },
  { id: 1, x: 380, y: 105 },
  { id: 2, x: 580, y: 105 },
  { id: 3, x: 760, y: 105 },
];

function drawSand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#f0d9a8";
  roundRect(ctx, x, y, w, h, 14, true);
  for (let i = 0; i < 110; i++) {
    const px = x + 8 + ((i * 53) % Math.max(1, w - 16));
    const py = y + 8 + ((i * 37) % Math.max(1, h - 16));
    ctx.fillStyle = i % 3 === 0 ? "rgba(210,180,120,0.35)" : "rgba(255,248,225,0.4)";
    ctx.beginPath();
    ctx.ellipse(px, py, 6 + (i % 5), 2 + (i % 3), (i % 7) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
}

function drawLagoon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const water = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.55);
  water.addColorStop(0, "#4dd0e1");
  water.addColorStop(0.45, "#26c6da");
  water.addColorStop(1, "#00838f");
  ctx.fillStyle = water;
  roundRect(ctx, x, y, w, h, 40, true);
  // Ripples
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, 40 + i * 28, 18 + i * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Fish
  ctx.fillStyle = "#ff8a65";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.35, y + h * 0.45, 10, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35 - 10, y + h * 0.45);
  ctx.lineTo(x + w * 0.35 - 16, y + h * 0.45 - 5);
  ctx.lineTo(x + w * 0.35 - 16, y + h * 0.45 + 5);
  ctx.fill();
  ctx.fillStyle = "#fff176";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.65, y + h * 0.6, 8, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, w, h, 40, false);
}

function drawCoral(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + 18);
  ctx.quadraticCurveTo(x - 10, y + 4, x - 4, y - 10);
  ctx.quadraticCurveTo(x, y, x + 4, y - 12);
  ctx.quadraticCurveTo(x + 12, y + 2, x + 6, y + 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
  ctx.arc(x + 5, y + 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 2);
  ctx.beginPath();
  ctx.moveTo(x, y + 18);
  ctx.quadraticCurveTo(x - 10, y + 4, x - 4, y - 10);
  ctx.quadraticCurveTo(x, y, x + 4, y - 12);
  ctx.quadraticCurveTo(x + 12, y + 2, x + 6, y + 18);
  ctx.closePath();
  ctx.stroke();
}

function drawStarfish(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#ff7043";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = x + Math.cos(a) * 11;
    const py = y + Math.sin(a) * 11;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    const a2 = a + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a2) * 4, y + Math.sin(a2) * 4);
  }
  ctx.closePath();
  ctx.fill();
  strokeInk(ctx, 2);
  ctx.stroke();
}

function drawSeashell(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#ffe0b2";
  ctx.beginPath();
  ctx.ellipse(x, y, 12, 8, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#ffab91";
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + i * 4, y - 6, x + i * 5, y - 10);
    ctx.stroke();
  }
  strokeInk(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(x, y, 12, 8, 0, Math.PI, 0);
  ctx.stroke();
}

function drawTikiTorch(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x, y + 36, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x - 3, y, 6, 36, 2, true);
  // Flame
  ctx.fillStyle = "#ff6f00";
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.quadraticCurveTo(x - 8, y - 2, x, y + 4);
  ctx.quadraticCurveTo(x + 8, y - 2, x, y - 14);
  ctx.fill();
  ctx.fillStyle = "#ffee58";
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.quadraticCurveTo(x - 4, y, x, y + 2);
  ctx.quadraticCurveTo(x + 4, y, x, y - 10);
  ctx.fill();
}

function drawTreasureChest(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 28, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRect(ctx, x, y + 8, 44, 22, 4, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 2, y + 10, 40, 18, 3, true);
  ctx.fillStyle = "#ffc107";
  roundRect(ctx, x + 16, y + 14, 12, 10, 2, true);
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x, y, 44, 12, 4, true);
  ctx.fillStyle = "#a1887f";
  roundRect(ctx, x + 2, y + 2, 40, 8, 3, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 44, 12, 4, false);
  roundRect(ctx, x, y + 8, 44, 22, 4, false);
}

function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = "#ffecb3";
  roundRect(ctx, x - 8, y, 16, 14, 3, true);
  ctx.fillStyle = "#ffb300";
  roundRect(ctx, x - 5, y + 3, 10, 8, 2, true);
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x - 9, y - 2, 18, 4, 2, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x - 8, y, 16, 14, 3, false);
}

function drawServiceSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#004d40";
  roundRect(ctx, x - 34, y - 14, 68, 20, 4, true);
  ctx.fillStyle = "#80cbc4";
  ctx.font = "bold 10px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS", x, y);
  strokeInk(ctx, 2);
  roundRect(ctx, x - 34, y - 14, 68, 20, 4, false);
}

function drawCoralTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 20, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0f7fa";
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Coral centerpiece
  ctx.fillStyle = "#ec407a";
  ctx.beginPath();
  ctx.arc(x, y - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 2.5);
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 16, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Tropical sunset wash
    const wash = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    wash.addColorStop(0, "#ff8a65");
    wash.addColorStop(0.35, "#ffab91");
    wash.addColorStop(0.7, "#80deea");
    wash.addColorStop(1, "#4db6ac");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Ocean band
    const ocean = ctx.createLinearGradient(0, 0, 0, 52);
    ocean.addColorStop(0, "#00695c");
    ocean.addColorStop(1, "#26a69a");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, MAP_W, 52);
    ctx.fillStyle = "#80cbc4";
    for (let x = 0; x < MAP_W; x += 38) {
      ctx.beginPath();
      ctx.ellipse(x + 19, 50, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e0f2f1";
    ctx.font = "bold 13px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CORAL COVE  ·  lagoon kitchen", 480, 28);

    // Sand everywhere in play area
    drawSand(ctx, 28, 60, MAP_W - 56, MAP_H - 80);

    // Central lagoon
    drawLagoon(ctx, 350, 285, 260, 100);

    // Decor around lagoon & dining
    drawCoral(ctx, 330, 310, "#e91e63");
    drawCoral(ctx, 630, 300, "#ab47bc");
    drawCoral(ctx, 370, 375, "#ff7043");
    drawCoral(ctx, 590, 380, "#26a69a");
    drawStarfish(ctx, 100, 160);
    drawStarfish(ctx, 860, 160);
    drawSeashell(ctx, 140, 480);
    drawSeashell(ctx, 820, 200);
    drawSeashell(ctx, 480, 500);
    drawTikiTorch(ctx, 100, 480);
    drawTikiTorch(ctx, 860, 480);
    drawTikiTorch(ctx, 50, 300);
    drawTikiTorch(ctx, 910, 300);
    drawLantern(ctx, 300, 55);
    drawLantern(ctx, 480, 48);
    drawLantern(ctx, 660, 55);
    drawTreasureChest(ctx, 880, 500);

    // —— Dining on sand (top — keeps bubbles off stations) ——
    drawCoralTable(ctx, 200, 80);
    drawCoralTable(ctx, 380, 80);
    drawCoralTable(ctx, 580, 80);
    drawCoralTable(ctx, 760, 80);
    drawTableCondiments(ctx, 200, 78);
    drawTableCondiments(ctx, 380, 78);
    drawTableCondiments(ctx, 580, 78);
    drawTableCondiments(ctx, 760, 78);
    drawDoor(ctx, 480, 42);

    // —— Top cook bar ——
    drawCounterIsland(ctx, 290, 160, 460, 58, "#e8c9a0", "#00897b");
    drawOven(ctx, 300, 148);
    drawGrill(ctx, 390, 145);
    drawTrash(ctx, 470, 165);
    drawCuttingBoard(ctx, 540, 178);
    drawSink(ctx, 610, 172);

    // Juice — east of sink, above pantry; spout faces dining (north)
    drawCounterIsland(ctx, 760, 168, 80, 55, "#fff3e0", "#ffb74d");
    drawJuiceMachine(ctx, 776, 162, 180);

    // —— Left arm (lower — open NW walk to dining) ——
    drawCounterIsland(ctx, 150, 320, 100, 180, "#e8c9a0", "#00897b");
    drawFryer(ctx, 155, 315, 90);
    drawPlateStack(ctx, 168, 385);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(200, 450, 11, 0, Math.PI * 2);
    ctx.arc(240, 450, 11, 0, Math.PI * 2);
    ctx.fill();

    // —— Right pantry arm ——
    drawCounterIsland(ctx, 710, 240, 100, 280, "#d7a86e", "#5d4037");
    drawTomatoCrate(ctx, 720, 250);
    drawMozzarellaBowl(ctx, 720, 295);
    drawBunCrate(ctx, 720, 340);
    drawPattyTray(ctx, 720, 385);
    drawPotatoCrate(ctx, 720, 430);
    drawDoughCrate(ctx, 720, 470);

    // Pass at mouth of U
    drawCounterIsland(ctx, 400, 395, 160, 48, "#004d40", "#80cbc4");
    drawServiceSign(ctx, 480, 390);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const BEACH_4: MapDef = {
  id: "beach-4",
  env: "beach",
  name: "Coral Cove",
  slot: 4,
  unlocked: true,
  matchSeconds: 235,
  customerSpawnMs: [3800, 5800],
  spawn: { x: 280, y: 290 },
  door: { x: 480, y: 50 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
