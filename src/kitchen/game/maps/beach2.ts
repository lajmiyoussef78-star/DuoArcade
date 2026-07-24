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

const BG = "bg-beach-2-cabana-v2";

/**
 * BEACH MAP 2 — Palm Cabana
 *
 * Distinct from Sunset Grill’s top-bar layout:
 *   • Kitchen stacked on the RIGHT
 *   • Vertical PASS as the divider
 *   • Cabana patio dining on the LEFT
 *   • Pantry strip along the BOTTOM of the kitchen
 *
 * Same stations / menu / timing as Sunset Grill.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Right kitchen — top cook
  { x: 720, y: 105, w: 360, h: 55 },
  // Mid fry / plates / holds
  { x: 720, y: 250, w: 360, h: 50 },
  // Juice nook
  { x: 880, y: 175, w: 80, h: 45 },
  // Bottom pantry
  { x: 700, y: 430, w: 400, h: 48 },
  // Vertical pass
  { x: 440, y: 270, w: 48, h: 240 },
  // Cabana dining
  { x: 130, y: 150, w: 70, h: 55 },
  { x: 300, y: 150, w: 70, h: 55 },
  { x: 130, y: 310, w: 56, h: 56 },
  { x: 300, y: 310, w: 56, h: 56 },
];

const APPLIANCES: ApplianceDef[] = [
  // Top cook — stand south of counter
  { id: "oven_a", x: 580, y: 155, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 680, y: 155, kind: "grill", label: "Grill" },
  { id: "trash_a", x: 760, y: 155, kind: "trash", label: "Trash" },
  { id: "prep_a", x: 830, y: 155, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 900, y: 155, kind: "sink", label: "Sink" },
  // Mid line — stand south
  { id: "fryer_a", x: 600, y: 295, kind: "fryer", label: "Fryer" },
  { id: "plates", x: 710, y: 295, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_bar_l", x: 780, y: 295, kind: "counter", label: "Hold" },
  { id: "hold_bar_r", x: 850, y: 295, kind: "counter", label: "Hold" },
  // Juice — stand west of machine
  { id: "juice_a", x: 820, y: 210, kind: "juice", label: "Juice", dispenses: "juice" },
  // Bottom pantry — stand north
  { id: "pantry_tomato", x: 560, y: 385, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 625, y: 385, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 690, y: 385, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 755, y: 385, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 820, y: 385, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 885, y: 385, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // Pass
  { id: "pass_a", x: 440, y: 270, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 130, y: 155 },
  { id: 1, x: 300, y: 155 },
  { id: 2, x: 130, y: 315 },
  { id: 3, x: 300, y: 315 },
];

function drawSandFloor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // Natural beach sand (grain, not tiles)
  ctx.fillStyle = "#f0d9a8";
  roundRect(ctx, x, y, w, h, 14, true);
  for (let i = 0; i < 140; i++) {
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

function drawCabanaTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#b2ebf2";
  roundRect(ctx, x, y, w, h, 14, true);
  const step = 20;
  for (let yy = y + 6; yy < y + h - 6; yy += step) {
    for (let xx = x + 6; xx < x + w - 6; xx += step) {
      const dark = ((xx + yy) / step) % 2 < 1;
      ctx.fillStyle = dark ? "#4dd0e1" : "#e0f7fa";
      ctx.fillRect(xx, yy, step - 1, step - 1);
    }
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x, y + 40, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x - 5, y, 10, 42, 4, true);
  ctx.fillStyle = "#2e7d32";
  for (const [dx, dy, ang] of [
    [-18, -6, -0.7],
    [0, -14, 0],
    [18, -6, 0.7],
    [-10, 4, -0.35],
    [10, 4, 0.35],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, 16, 6, ang, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#66bb6a";
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawUmbrellaTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Umbrella
  ctx.fillStyle = "#ef5350";
  ctx.beginPath();
  ctx.moveTo(x, y - 36);
  ctx.lineTo(x - 32, y - 8);
  ctx.lineTo(x + 32, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.moveTo(x, y - 36);
  ctx.lineTo(x - 16, y - 8);
  ctx.lineTo(x + 16, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 36);
  ctx.lineTo(x, y + 8);
  ctx.stroke();

  // Table
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 22, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe0b2";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 21, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 2.5);
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 24, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawLoungeChair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x, y + 28, 28, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  roundRect(ctx, x - 26, y - 4, 52, 18, 6, true);
  ctx.fillStyle = "#26c6da";
  roundRect(ctx, x - 24, y - 2, 48, 14, 5, true);
  ctx.fillStyle = INK;
  roundRect(ctx, x - 26, y + 12, 52, 14, 5, true);
  ctx.fillStyle = "#00acc1";
  roundRect(ctx, x - 24, y + 14, 48, 10, 4, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x - 26, y - 4, 52, 18, 6, false);
  roundRect(ctx, x - 26, y + 12, 52, 14, 5, false);
}

function drawServiceSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#004d40";
  roundRect(ctx, x - 34, y - 14, 68, 20, 4, true);
  ctx.fillStyle = "#b2ff59";
  ctx.font = "bold 10px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS", x, y);
  strokeInk(ctx, 2);
  roundRect(ctx, x - 34, y - 14, 68, 20, 4, false);
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Warm dusk wash
    const wash = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    wash.addColorStop(0, "#ffe0b2");
    wash.addColorStop(0.35, "#ffcc80");
    wash.addColorStop(1, "#80deea");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Ocean band
    const ocean = ctx.createLinearGradient(0, 0, 0, 56);
    ocean.addColorStop(0, "#0277bd");
    ocean.addColorStop(1, "#4fc3f7");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, MAP_W, 56);
    ctx.fillStyle = "#81d4fa";
    for (let x = 0; x < MAP_W; x += 36) {
      ctx.beginPath();
      ctx.ellipse(x + 18, 52, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff8e1";
    ctx.font = "bold 13px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PALM CABANA  ·  lagoon side", 480, 28);

    // Dining (left) + kitchen (right)
    drawSandFloor(ctx, 28, 70, 390, 440);
    drawCabanaTile(ctx, 490, 70, 442, 440);

    drawPalm(ctx, 60, 90);
    drawPalm(ctx, 380, 95);
    drawPalm(ctx, 70, 400);
    drawPalm(ctx, 370, 410);

    // —— Right kitchen ——
    drawCounterIsland(ctx, 540, 70, 360, 60, "#e8c9a0", "#26c6da");
    drawOven(ctx, 545, 58);
    drawGrill(ctx, 645, 55);
    drawTrash(ctx, 740, 75);
    drawCuttingBoard(ctx, 800, 88);
    drawSink(ctx, 860, 82);

    drawCounterIsland(ctx, 820, 150, 90, 50, "#fff3e0", "#ffb74d");
    drawJuiceMachine(ctx, 835, 135);

    drawCounterIsland(ctx, 540, 220, 360, 55, "#e8c9a0", "#26c6da");
    drawFryer(ctx, 555, 205);
    drawPlateStack(ctx, 670, 212);
    // Hold pads
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(780, 245, 12, 0, Math.PI * 2);
    ctx.arc(850, 245, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(780, 245, 12, 0, Math.PI * 2);
    ctx.arc(850, 245, 12, 0, Math.PI * 2);
    ctx.stroke();

    drawCounterIsland(ctx, 520, 400, 400, 55, "#d7a86e", "#00838f");
    drawTomatoCrate(ctx, 530, 392);
    drawMozzarellaBowl(ctx, 595, 394);
    drawBunCrate(ctx, 660, 396);
    drawPattyTray(ctx, 720, 400);
    drawPotatoCrate(ctx, 785, 392);
    drawDoughCrate(ctx, 850, 394);

    // Vertical pass
    drawCounterIsland(ctx, 416, 150, 48, 240, "#004d40", "#b2ff59");
    drawServiceSign(ctx, 440, 145);

    // —— Cabana dining ——
    drawUmbrellaTable(ctx, 130, 130);
    drawUmbrellaTable(ctx, 300, 130);
    drawLoungeChair(ctx, 130, 295);
    drawLoungeChair(ctx, 300, 295);
    drawTableCondiments(ctx, 130, 138);
    drawTableCondiments(ctx, 300, 138);

    drawDoor(ctx, 200, 450);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const BEACH_2: MapDef = {
  id: "beach-2",
  env: "beach",
  name: "Palm Cabana",
  slot: 2,
  unlocked: true,
  matchSeconds: 235,
  customerSpawnMs: [3800, 5800],
  spawn: { x: 620, y: 340 },
  door: { x: 200, y: 500 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
