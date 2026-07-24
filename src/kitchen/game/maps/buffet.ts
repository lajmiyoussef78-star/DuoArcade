import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { BuffetTrayDef, Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawCuttingBoard,
  drawDoor,
  drawFryer,
  drawGrill,
  drawJuiceMachine,
  drawPlateStack,
  drawPotatoCrate,
  drawSink,
  drawSteelCounter,
  drawTomatoCrate,
  drawTrash,
  drawWoodFloor,
  ensureCanvas,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-buffet-2";

/**
 * BUFFET HALL — window dining on top, U-shaped buffet center,
 * dual fryers + one dual-slot grill on the bottom kitchen line.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Dining counter top
  { x: 480, y: 100, w: 760, h: 40 },
  // U-buffet ring
  { x: 480, y: 250, w: 420, h: 36 },
  { x: 300, y: 290, w: 40, h: 100 },
  { x: 660, y: 290, w: 40, h: 100 },
  // Prep island
  { x: 480, y: 340, w: 120, h: 50 },
  // Bottom cook line
  { x: 480, y: 455, w: 720, h: 50 },
  // Juice / trash left
  { x: 90, y: 300, w: 70, h: 80 },
  // Plate stack near sink
  { x: 760, y: 400, w: 50, h: 40 },
];

const TRAYS: BuffetTrayDef[] = [
  { id: "chicken", x: 360, y: 248, label: "Chicken", accepts: "chicken_fried", max: 6, addPerStock: 2 },
  { id: "shrimp", x: 430, y: 248, label: "Shrimp", accepts: "shrimp_fried", max: 4, addPerStock: 2 },
  { id: "fries", x: 500, y: 248, label: "Fries", accepts: "fries", max: 10, addPerStock: 5 },
  { id: "tomato", x: 570, y: 248, label: "Tomatoes", accepts: "tomato_grilled", max: 2, addPerStock: 2 },
  { id: "pepper", x: 640, y: 248, label: "Peppers", accepts: "pepper_grilled", max: 2, addPerStock: 2 },
];

const APPLIANCES: ApplianceDef[] = [
  { id: "fryer_a", x: 220, y: 470, kind: "fryer", label: "Fryer" },
  { id: "fryer_b", x: 320, y: 470, kind: "fryer", label: "Fryer" },
  // Free hold spots on the fryer line — park any one item each
  { id: "hold_fryer_l", x: 220, y: 410, kind: "counter", label: "Hold" },
  { id: "hold_fryer_r", x: 320, y: 410, kind: "counter", label: "Hold" },
  { id: "flour_a", x: 400, y: 470, kind: "flour", label: "Flour" },
  // One grill body — two pan slots
  { id: "grill_panel_a", x: 520, y: 455, kind: "grill_panel", label: "Pan L" },
  { id: "grill_panel_b", x: 575, y: 455, kind: "grill_panel", label: "Pan R" },
  { id: "sink_a", x: 680, y: 470, kind: "sink", label: "Sink" },
  // Plates next to sink (away from raw chicken)
  { id: "plates", x: 760, y: 400, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "trash_a", x: 90, y: 360, kind: "trash", label: "Trash" },
  { id: "juice_a", x: 90, y: 280, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "prep_a", x: 440, y: 340, kind: "prep", label: "Chop" },
  { id: "prep_b", x: 520, y: 340, kind: "prep", label: "Chop" },
  { id: "pantry_chicken", x: 80, y: 470, kind: "pantry", label: "Chicken", dispenses: "chicken_raw" },
  { id: "pantry_shrimp", x: 140, y: 470, kind: "pantry", label: "Shrimp", dispenses: "shrimp_raw" },
  { id: "pantry_fries", x: 160, y: 400, kind: "pantry", label: "Raw fries", dispenses: "fries_raw" },
  { id: "pantry_tomato", x: 820, y: 470, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_pepper", x: 880, y: 470, kind: "pantry", label: "Peppers", dispenses: "pepper" },
];

/** Dining stools along the window counter — 8 seats. */
const SEATS: CustomerSeat[] = [
  { id: 0, x: 160, y: 135 },
  { id: 1, x: 250, y: 128 },
  { id: 2, x: 340, y: 122 },
  { id: 3, x: 430, y: 120 },
  { id: 4, x: 520, y: 120 },
  { id: 5, x: 610, y: 122 },
  { id: 6, x: 700, y: 128 },
  { id: 7, x: 790, y: 135 },
];

function drawBuffetTraySlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x - 28, y - 18, 56, 36, 6, true);
  ctx.fillStyle = "#263238";
  roundRect(ctx, x - 24, y - 14, 48, 28, 4, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x - 28, y - 18, 56, 36, 6, false);
}

function drawFlourBowl(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 36, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5d4037";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 22, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 18, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe0b2";
  ctx.beginPath();
  ctx.ellipse(x + 18, y + 16, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 22, 22, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPepperCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x, y + 16, 50, 28, 5, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 2, y + 18, 46, 24, 4, true);
  for (const [px, py, col] of [
    [16, 28, "#43a047"],
    [30, 26, "#e53935"],
    [22, 34, "#fdd835"],
    [34, 34, "#43a047"],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x + px, y + py, 8, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 16, 50, 28, 5, false);
}

function drawChickenCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x, y + 14, 52, 30, 5, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 2, y + 16, 48, 26, 4, true);
  ctx.fillStyle = "#ffcc80";
  for (const [cx, cy] of [
    [16, 28],
    [30, 26],
    [22, 36],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + cx, y + cy, 9, 6, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 14, 52, 30, 5, false);
}

function drawShrimpBowl(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#1565c0";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 28, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8a65";
  for (const [sx, sy] of [
    [14, 24],
    [24, 22],
    [30, 28],
    [18, 30],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + sx, y + sy, 6, 3.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 28, 20, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Warm wood floor
    drawWoodFloor(ctx, 0, 0, MAP_W, MAP_H, "#c4a574");

    // Water / bay window band
    ctx.fillStyle = "#4fc3f7";
    ctx.fillRect(0, 0, MAP_W, 56);
    ctx.fillStyle = "#29b6f6";
    for (let x = 0; x < MAP_W; x += 36) {
      ctx.beginPath();
      ctx.ellipse(x + 18, 50, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff8e1";
    ctx.font = "bold 13px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BUFFET HALL  ·  harbor view", 480, 28);

    // Dining counter under window
    ctx.fillStyle = "#6d4c41";
    roundRect(ctx, 100, 70, 760, 55, 12, true);
    ctx.fillStyle = "#a1887f";
    roundRect(ctx, 108, 76, 744, 28, 8, true);
    strokeInk(ctx, 4);
    roundRect(ctx, 100, 70, 760, 55, 12, false);
    // Place settings — 8 seats
    for (const sx of [160, 250, 340, 430, 520, 610, 700, 790]) {
      ctx.fillStyle = "#fafafa";
      roundRect(ctx, sx - 12, 82, 24, 16, 3, true);
      ctx.fillStyle = "#e53935";
      ctx.beginPath();
      ctx.arc(sx, 118, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Customer self-serve floor arc
    ctx.strokeStyle = "rgba(229,57,53,0.55)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(500, 300, 220, 70, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // U-shaped buffet counter
    ctx.fillStyle = "#eceff1";
    roundRect(ctx, 280, 210, 440, 55, 16, true);
    roundRect(ctx, 270, 220, 50, 140, 12, true);
    roundRect(ctx, 680, 220, 50, 140, 12, true);
    strokeInk(ctx, 4);
    roundRect(ctx, 280, 210, 440, 55, 16, false);
    roundRect(ctx, 270, 220, 50, 140, 12, false);
    roundRect(ctx, 680, 220, 50, 140, 12, false);

    for (const t of TRAYS) {
      drawBuffetTraySlot(ctx, t.x, t.y);
    }

    // Prep island
    drawSteelCounter(ctx, 410, 310, 160, 55);
    drawCuttingBoard(ctx, 420, 318);
    drawCuttingBoard(ctx, 500, 318);

    // Bottom cook line
    drawSteelCounter(ctx, 60, 420, 840, 70);
    drawChickenCrate(ctx, 55, 430);
    drawShrimpBowl(ctx, 115, 432);
    drawPotatoCrate(ctx, 130, 360);
    drawFryer(ctx, 190, 400);
    drawFryer(ctx, 290, 400);
    drawFlourBowl(ctx, 385, 430);
    // ONE grill with two pan places
    drawGrill(ctx, 500, 400);
    drawSink(ctx, 640, 425);
    drawPlateStack(ctx, 730, 370);
    drawTomatoCrate(ctx, 790, 432);
    drawPepperCrate(ctx, 850, 430);

    // Juice + trash left
    drawJuiceMachine(ctx, 55, 250);
    drawTrash(ctx, 55, 330);

    drawDoor(ctx, 880, 200);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 16, false);
  });
}

export const BUFFET_1: MapDef = {
  id: "buffet-1",
  env: "buffet",
  mode: "buffet",
  name: "Harbor Buffet",
  slot: 1,
  unlocked: true,
  /**
   * Stock cook chains + hand plates + eat + dirty wash + crowded groups.
   * Longer clocks for cook/wash/walk + mistake buffer.
   */
  matchSeconds: 320,
  customerSpawnMs: [5500, 8000],
  spawn: { x: 480, y: 380 },
  door: { x: 900, y: 220 },
  menu: [],
  plateStock: 9,
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  buffetTrays: TRAYS,
  bgKey: BG,
  paint,
};
