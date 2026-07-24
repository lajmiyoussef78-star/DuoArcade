import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { BuffetTrayDef, Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawBanner,
  drawBuffetTraySlot,
  drawChickenCrate,
  drawFlourBowl,
  drawPepperCrate,
  drawPlaceSetting,
  drawShrimpBowl,
} from "./buffetShared";
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

const BG = "bg-buffet-2-garden-v12";

/**
 * BUFFET 2 — Garden Terrace
 *
 * Professional L flow:
 *   trays (top center) → prep island (mid) → cook rail (bottom)
 *   booth dining SE · juice/trash on east pass · door NE clear
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  { x: 500, y: 140, w: 440, h: 44 },
  { x: 400, y: 280, w: 280, h: 50 },
  { x: 300, y: 455, w: 420, h: 55 },
  { x: 760, y: 400, w: 280, h: 150 },
  { x: 880, y: 260, w: 60, h: 100 },
  { x: 700, y: 220, w: 50, h: 40 },
];

const TRAYS: BuffetTrayDef[] = [
  { id: "chicken", x: 340, y: 140, label: "Chicken", accepts: "chicken_fried", max: 6, addPerStock: 2 },
  { id: "shrimp", x: 420, y: 140, label: "Shrimp", accepts: "shrimp_fried", max: 4, addPerStock: 2 },
  { id: "fries", x: 500, y: 140, label: "Fries", accepts: "fries", max: 10, addPerStock: 5 },
  { id: "tomato", x: 580, y: 140, label: "Tomatoes", accepts: "tomato_grilled", max: 2, addPerStock: 2 },
  { id: "pepper", x: 660, y: 140, label: "Peppers", accepts: "pepper_grilled", max: 2, addPerStock: 2 },
];

const APPLIANCES: ApplianceDef[] = [
  { id: "pantry_chicken", x: 100, y: 470, kind: "pantry", label: "Chicken", dispenses: "chicken_raw" },
  { id: "pantry_shrimp", x: 160, y: 470, kind: "pantry", label: "Shrimp", dispenses: "shrimp_raw" },
  { id: "pantry_fries", x: 200, y: 410, kind: "pantry", label: "Raw fries", dispenses: "fries_raw" },
  { id: "fryer_a", x: 260, y: 470, kind: "fryer", label: "Fryer" },
  { id: "fryer_b", x: 340, y: 470, kind: "fryer", label: "Fryer" },
  { id: "hold_fryer_l", x: 260, y: 410, kind: "counter", label: "Hold" },
  { id: "hold_fryer_r", x: 340, y: 410, kind: "counter", label: "Hold" },
  { id: "flour_a", x: 420, y: 470, kind: "flour", label: "Flour" },
  { id: "grill_panel_a", x: 490, y: 455, kind: "grill_panel", label: "Pan L" },
  { id: "grill_panel_b", x: 540, y: 455, kind: "grill_panel", label: "Pan R" },
  { id: "sink_a", x: 600, y: 470, kind: "sink", label: "Sink" },
  { id: "plates", x: 700, y: 220, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "pantry_tomato", x: 520, y: 280, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_pepper", x: 580, y: 280, kind: "pantry", label: "Peppers", dispenses: "pepper" },
  { id: "prep_a", x: 360, y: 280, kind: "prep", label: "Chop" },
  { id: "prep_b", x: 440, y: 280, kind: "prep", label: "Chop" },
  { id: "juice_a", x: 880, y: 230, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "trash_a", x: 880, y: 310, kind: "trash", label: "Trash" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 660, y: 360 },
  { id: 1, x: 740, y: 360 },
  { id: 2, x: 820, y: 360 },
  { id: 3, x: 900, y: 360 },
  { id: 4, x: 660, y: 440 },
  { id: 5, x: 740, y: 440 },
  { id: 6, x: 820, y: 440 },
  { id: 7, x: 900, y: 440 },
];

function drawIvyTrellis(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.fillStyle = "#5d4037";
  for (let i = 0; i < h; i += 28) {
    ctx.fillRect(x, y + i, 6, 22);
    ctx.fillRect(x + 18, y + i + 10, 6, 22);
  }
  ctx.strokeStyle = "#2e7d32";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + 12, y + 24 + i * 48, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(76,175,80,0.35)";
    ctx.fill();
  }
}

function drawFlowerPot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x, y + 14, 22, 16, 3, true);
  ctx.fillStyle = color;
  for (const [px, py] of [
    [6, 8],
    [14, 6],
    [10, 12],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + px, y + py, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawWoodFloor(ctx, 0, 0, MAP_W, MAP_H, "#b8c9a0");

    const sky = ctx.createLinearGradient(0, 0, 0, 64);
    sky.addColorStop(0, "#81c784");
    sky.addColorStop(1, "#c8e6c9");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, MAP_W, 64);
    drawBanner(ctx, "GARDEN TERRACE", "#00897b", "fresh air · booth plaza");

    drawIvyTrellis(ctx, 28, 80, 300);
    drawFlowerPot(ctx, 240, 48, "#e91e63");
    drawFlowerPot(ctx, 700, 48, "#ff9800");
    drawFlowerPot(ctx, 500, 300, "#9c27b0");

    // Buffet rail — centered, even tray spacing
    ctx.fillStyle = "#eceff1";
    roundRect(ctx, 280, 110, 440, 58, 14, true);
    ctx.fillStyle = "#00897b";
    ctx.fillRect(280, 158, 440, 4);
    strokeInk(ctx, 3);
    roundRect(ctx, 280, 110, 440, 58, 14, false);
    for (const t of TRAYS) drawBuffetTraySlot(ctx, t.x, t.y);

    // Prep island — chop + veg crates (tomato/pepper next to boards)
    drawSteelCounter(ctx, 320, 250, 300, 55);
    drawCuttingBoard(ctx, 330, 258);
    drawCuttingBoard(ctx, 410, 258);
    drawPotatoCrate(ctx, 260, 255);
    drawTomatoCrate(ctx, 490, 258);
    drawPepperCrate(ctx, 550, 255);

    // Cook rail — raw → fry → flour → grill → sink
    drawSteelCounter(ctx, 60, 420, 560, 70);
    drawChickenCrate(ctx, 70, 432);
    drawShrimpBowl(ctx, 130, 432);
    drawFryer(ctx, 210, 400);
    drawFryer(ctx, 290, 400);
    drawFlourBowl(ctx, 385, 430);
    drawGrill(ctx, 455, 400);
    drawSink(ctx, 560, 425);

    // Plates at the pass — between trays and booths
    drawPlateStack(ctx, 675, 190);

    // SE booth dining
    ctx.fillStyle = "#6d4c41";
    roundRect(ctx, 620, 320, 300, 180, 14, true);
    ctx.fillStyle = "#a1887f";
    roundRect(ctx, 628, 328, 284, 164, 10, true);
    strokeInk(ctx, 4);
    roundRect(ctx, 620, 320, 300, 180, 14, false);
    for (const s of SEATS) drawPlaceSetting(ctx, s.x, s.y - 12);

    drawJuiceMachine(ctx, 850, 200);
    drawTrash(ctx, 850, 280);
    drawDoor(ctx, 870, 42);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 16, false);
  });
}

export const BUFFET_2: MapDef = {
  id: "buffet-2",
  env: "buffet",
  mode: "buffet",
  name: "Garden Terrace",
  slot: 2,
  unlocked: true,
  matchSeconds: 320,
  customerSpawnMs: [5500, 8000],
  spawn: { x: 400, y: 300 },
  door: { x: 900, y: 55 },
  menu: [],
  plateStock: 9,
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  buffetTrays: TRAYS,
  bgKey: BG,
  paint,
};
