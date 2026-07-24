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

const BG = "bg-beach-3-surf-v3";

/**
 * BEACH MAP 3 — Surf Shack
 *
 * Distinct from Sunset Grill (top bar) and Palm Cabana (right kitchen):
 *   • Cook / fry / pass along the BOTTOM pier
 *   • Pantry + juice stacked on the LEFT
 *   • Sand dining UP TOP facing the ocean
 *   • Horizontal PASS between kitchen and dining
 *
 * Same stations / menu / timing as the other Beach House maps.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Left pantry column (full height under juice)
  { x: 95, y: 345, w: 90, h: 320 },
  // Juice nook (separate from pantry — no overlap)
  { x: 95, y: 125, w: 90, h: 50 },
  // Bottom cook pier (two blocks + walk gap)
  { x: 390, y: 428, w: 360, h: 52 },
  { x: 750, y: 428, w: 280, h: 52 },
  // Horizontal pass
  { x: 520, y: 300, w: 420, h: 44 },
  // Ocean picnic tables
  { x: 280, y: 120, w: 70, h: 48 },
  { x: 460, y: 120, w: 70, h: 48 },
  { x: 640, y: 120, w: 70, h: 48 },
  { x: 820, y: 120, w: 70, h: 48 },
];

const APPLIANCES: ApplianceDef[] = [
  // Left pantry — stand east of crates (evenly spaced on extended counter)
  { id: "pantry_tomato", x: 170, y: 210, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 170, y: 265, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 170, y: 320, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 170, y: 375, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 170, y: 430, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 170, y: 485, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // Juice — stand east (own counter above pantry)
  { id: "juice_a", x: 170, y: 130, kind: "juice", label: "Juice", dispenses: "juice" },
  // Bottom cook — stand SOUTH of pier (front side)
  { id: "oven_a", x: 255, y: 475, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 350, y: 475, kind: "grill", label: "Grill" },
  { id: "prep_a", x: 445, y: 475, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 520, y: 475, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 670, y: 475, kind: "fryer", label: "Fryer" },
  { id: "plates", x: 760, y: 475, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_bar_l", x: 825, y: 475, kind: "counter", label: "Hold" },
  { id: "hold_bar_r", x: 875, y: 475, kind: "counter", label: "Hold" },
  { id: "trash_a", x: 920, y: 475, kind: "trash", label: "Trash" },
  // Pass
  { id: "pass_a", x: 520, y: 300, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 280, y: 125 },
  { id: 1, x: 460, y: 125 },
  { id: 2, x: 640, y: 125 },
  { id: 3, x: 820, y: 125 },
];

function drawBeachSand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#f0d9a8";
  roundRect(ctx, x, y, w, h, 14, true);
  for (let i = 0; i < 130; i++) {
    const px = x + 8 + ((i * 53) % Math.max(1, w - 16));
    const py = y + 8 + ((i * 37) % Math.max(1, h - 16));
    ctx.fillStyle = i % 3 === 0 ? "rgba(210,180,120,0.38)" : "rgba(255,248,225,0.42)";
    ctx.beginPath();
    ctx.ellipse(px, py, 7 + (i % 5), 2.5 + (i % 3), (i % 7) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
}

function drawPierPlanks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x, y, w, h, 12, true);
  const step = 18;
  for (let yy = y + 4; yy < y + h - 4; yy += step) {
    ctx.fillStyle = yy / step % 2 < 1 ? "#8d6e63" : "#a1887f";
    ctx.fillRect(x + 4, yy, w - 8, step - 2);
    ctx.strokeStyle = "rgba(62,39,35,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 8, yy + step / 2);
    ctx.lineTo(x + w - 8, yy + step / 2);
    ctx.stroke();
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 12, false);
}

function drawPicnicTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 36, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // benches
  ctx.fillStyle = INK;
  roundRect(ctx, x - 40, y + 14, 18, 20, 4, true);
  roundRect(ctx, x + 22, y + 14, 18, 20, 4, true);
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x - 38, y + 16, 14, 16, 3, true);
  roundRect(ctx, x + 24, y + 16, 14, 16, 3, true);
  // table top
  ctx.fillStyle = INK;
  roundRect(ctx, x - 28, y, 56, 22, 5, true);
  ctx.fillStyle = "#a1887f";
  roundRect(ctx, x - 26, y + 2, 52, 18, 4, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x - 40, y + 14, 18, 20, 4, false);
  roundRect(ctx, x + 22, y + 14, 18, 20, 4, false);
  roundRect(ctx, x - 28, y, 56, 22, 5, false);
}

function drawSurfboard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 70, 12, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y + 30, 12, 40, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#29b6f6";
  ctx.beginPath();
  ctx.ellipse(x, y + 30, 9, 36, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.ellipse(x - 1, y + 20, 3, 20, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ef5350";
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 45, 5, 8, 0.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(255,249,196,0.9)";
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a237e";
  ctx.beginPath();
  ctx.arc(x + 7, y - 2, 14, 0, Math.PI * 2);
  ctx.fill();
}

function drawServiceSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#0d47a1";
  roundRect(ctx, x - 34, y - 14, 68, 20, 4, true);
  ctx.fillStyle = "#82b1ff";
  ctx.font = "bold 10px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS", x, y);
  strokeInk(ctx, 2);
  roundRect(ctx, x - 34, y - 14, 68, 20, 4, false);
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Night pier wash
    const wash = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    wash.addColorStop(0, "#1a237e");
    wash.addColorStop(0.35, "#283593");
    wash.addColorStop(1, "#4a148c");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Night ocean
    const ocean = ctx.createLinearGradient(0, 0, 0, 58);
    ocean.addColorStop(0, "#0d47a1");
    ocean.addColorStop(1, "#1565c0");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, MAP_W, 58);
    ctx.fillStyle = "#42a5f5";
    for (let x = 0; x < MAP_W; x += 40) {
      ctx.beginPath();
      ctx.ellipse(x + 20, 54, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawMoon(ctx, 880, 28);
    ctx.fillStyle = "#e3f2fd";
    ctx.font = "bold 13px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SURF SHACK  ·  moonlit pier", 420, 28);

    // Sand dining (top) + pier kitchen (bottom)
    drawBeachSand(ctx, 200, 70, 732, 200);
    drawPierPlanks(ctx, 200, 320, 732, 192);
    drawPierPlanks(ctx, 28, 90, 160, 422);

    // Surfboards away from the pantry column
    drawSurfboard(ctx, 900, 250);
    drawSurfboard(ctx, 930, 320);

    // —— Left column: juice (cream) then gap, then one long wood pantry ——
    drawCounterIsland(ctx, 45, 95, 100, 55, "#fff3e0", "#ffb74d");
    drawJuiceMachine(ctx, 60, 80);

    // Clear gap (~18px) so counters don’t overlap, then extended pantry
    drawCounterIsland(ctx, 45, 168, 100, 345, "#d7a86e", "#5d4037");
    drawTomatoCrate(ctx, 55, 178);
    drawMozzarellaBowl(ctx, 55, 233);
    drawBunCrate(ctx, 55, 288);
    drawPattyTray(ctx, 55, 343);
    drawPotatoCrate(ctx, 55, 398);
    drawDoughCrate(ctx, 55, 453);

    // —— Bottom cook pier ——
    drawCounterIsland(ctx, 200, 400, 360, 55, "#e8c9a0", "#5c6bc0");
    drawOven(ctx, 210, 388);
    drawGrill(ctx, 310, 385);
    drawCuttingBoard(ctx, 420, 412);
    drawSink(ctx, 490, 408);

    drawCounterIsland(ctx, 620, 400, 300, 55, "#e8c9a0", "#5c6bc0");
    drawFryer(ctx, 630, 385);
    drawPlateStack(ctx, 730, 392);
    drawTrash(ctx, 880, 398);
    // Hold pads
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(820, 425, 11, 0, Math.PI * 2);
    ctx.arc(870, 425, 11, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal pass
    drawCounterIsland(ctx, 310, 275, 420, 48, "#0d47a1", "#82b1ff");
    drawServiceSign(ctx, 520, 270);

    // —— Ocean picnic dining ——
    drawPicnicTable(ctx, 280, 95);
    drawPicnicTable(ctx, 460, 95);
    drawPicnicTable(ctx, 640, 95);
    drawPicnicTable(ctx, 820, 95);
    drawTableCondiments(ctx, 280, 100);
    drawTableCondiments(ctx, 460, 100);
    drawTableCondiments(ctx, 640, 100);
    drawTableCondiments(ctx, 820, 100);

    drawDoor(ctx, 880, 200);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const BEACH_3: MapDef = {
  id: "beach-3",
  env: "beach",
  name: "Surf Shack",
  slot: 3,
  unlocked: true,
  matchSeconds: 235,
  customerSpawnMs: [3800, 5800],
  spawn: { x: 580, y: 475 },
  door: { x: 880, y: 230 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
