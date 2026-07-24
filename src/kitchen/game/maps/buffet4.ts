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

const BG = "bg-buffet-4-banquet-v2";

/**
 * BUFFET 4 — Grand Banquet
 *
 * Stage trays TOP · cook mid-LEFT (clear of dining) · banquet tables BOTTOM
 * Prep pass center · juice/trash west · door NE clear
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  { x: 480, y: 160, w: 560, h: 44 },
  { x: 220, y: 330, w: 300, h: 100 },
  { x: 480, y: 280, w: 140, h: 50 },
  { x: 480, y: 470, w: 760, h: 44 },
  { x: 80, y: 280, w: 60, h: 90 },
  { x: 400, y: 380, w: 50, h: 40 },
];

const TRAYS: BuffetTrayDef[] = [
  { id: "chicken", x: 300, y: 160, label: "Chicken", accepts: "chicken_fried", max: 6, addPerStock: 2 },
  { id: "shrimp", x: 380, y: 160, label: "Shrimp", accepts: "shrimp_fried", max: 4, addPerStock: 2 },
  { id: "fries", x: 460, y: 160, label: "Fries", accepts: "fries", max: 10, addPerStock: 5 },
  { id: "tomato", x: 540, y: 160, label: "Tomatoes", accepts: "tomato_grilled", max: 2, addPerStock: 2 },
  { id: "pepper", x: 620, y: 160, label: "Peppers", accepts: "pepper_grilled", max: 2, addPerStock: 2 },
];

const APPLIANCES: ApplianceDef[] = [
  { id: "pantry_chicken", x: 90, y: 360, kind: "pantry", label: "Chicken", dispenses: "chicken_raw" },
  { id: "pantry_shrimp", x: 150, y: 360, kind: "pantry", label: "Shrimp", dispenses: "shrimp_raw" },
  { id: "pantry_fries", x: 140, y: 300, kind: "pantry", label: "Raw fries", dispenses: "fries_raw" },
  { id: "fryer_a", x: 210, y: 360, kind: "fryer", label: "Fryer" },
  { id: "fryer_b", x: 280, y: 360, kind: "fryer", label: "Fryer" },
  { id: "hold_fryer_l", x: 210, y: 300, kind: "counter", label: "Hold" },
  { id: "hold_fryer_r", x: 280, y: 300, kind: "counter", label: "Hold" },
  { id: "flour_a", x: 350, y: 360, kind: "flour", label: "Flour" },
  { id: "grill_panel_a", x: 300, y: 300, kind: "grill_panel", label: "Pan L" },
  { id: "grill_panel_b", x: 350, y: 300, kind: "grill_panel", label: "Pan R" },
  { id: "sink_a", x: 400, y: 360, kind: "sink", label: "Sink" },
  { id: "plates", x: 400, y: 300, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "pantry_tomato", x: 90, y: 420, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_pepper", x: 150, y: 420, kind: "pantry", label: "Peppers", dispenses: "pepper" },
  { id: "prep_a", x: 440, y: 280, kind: "prep", label: "Chop" },
  { id: "prep_b", x: 520, y: 280, kind: "prep", label: "Chop" },
  { id: "juice_a", x: 80, y: 240, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "trash_a", x: 80, y: 310, kind: "trash", label: "Trash" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 160, y: 480 },
  { id: 1, x: 260, y: 480 },
  { id: 2, x: 360, y: 480 },
  { id: 3, x: 460, y: 480 },
  { id: 4, x: 560, y: 480 },
  { id: 5, x: 660, y: 480 },
  { id: 6, x: 760, y: 480 },
  { id: 7, x: 860, y: 480 },
];

function drawChandelier(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.strokeStyle = "#ffd54f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 40);
  ctx.lineTo(cx, cy);
  ctx.stroke();
  ctx.fillStyle = "#ffc107";
  for (const dx of [-40, -20, 0, 20, 40]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy);
    ctx.lineTo(cx + dx - 8, cy + 18);
    ctx.lineTo(cx + dx + 8, cy + 18);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(cx, cy + 10, 10, cx, cy + 10, 120);
  glow.addColorStop(0, "rgba(255,236,179,0.35)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy + 10, 120, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoldPillar(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + 16, y);
  g.addColorStop(0, "#b8860b");
  g.addColorStop(0.5, "#ffd54f");
  g.addColorStop(1, "#b8860b");
  ctx.fillStyle = g;
  roundRect(ctx, x, y, 16, h, 4, true);
  ctx.fillStyle = "#fff8e1";
  roundRect(ctx, x + 3, y + 8, 10, h - 16, 2, true);
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawWoodFloor(ctx, 0, 0, MAP_W, MAP_H, "#5d4037");

    ctx.fillStyle = "#b71c1c";
    roundRect(ctx, 280, 0, 400, MAP_H, 0, true);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let y = 0; y < MAP_H; y += 40) ctx.fillRect(280, y, 400, 2);

    drawBanner(ctx, "GRAND BANQUET", "#b71c1c", "stage service · long tables");
    drawChandelier(ctx, 480, 88);
    drawGoldPillar(ctx, 250, 110, 300);
    drawGoldPillar(ctx, 694, 110, 300);

    // Stage tray line
    ctx.fillStyle = "#37474f";
    roundRect(ctx, 220, 130, 520, 58, 10, true);
    ctx.fillStyle = "#ffd54f";
    ctx.fillRect(220, 178, 520, 4);
    strokeInk(ctx, 3);
    roundRect(ctx, 220, 130, 520, 58, 10, false);
    for (const t of TRAYS) drawBuffetTraySlot(ctx, t.x, t.y);

    // Prep pass under stage
    drawSteelCounter(ctx, 410, 250, 160, 55);
    drawCuttingBoard(ctx, 420, 258);
    drawCuttingBoard(ctx, 500, 258);
    drawPotatoCrate(ctx, 360, 255);

    // Cook block mid-left — above banquet, facing north into hall
    drawSteelCounter(ctx, 70, 290, 360, 120);
    drawChickenCrate(ctx, 80, 340);
    drawShrimpBowl(ctx, 140, 340);
    drawFryer(ctx, 185, 300);
    drawFryer(ctx, 255, 300);
    drawFlourBowl(ctx, 325, 330);
    drawGrill(ctx, 280, 250);
    drawSink(ctx, 370, 330);
    drawPlateStack(ctx, 375, 270);
    drawTomatoCrate(ctx, 80, 400);
    drawPepperCrate(ctx, 140, 400);

    // Banquet dining — clean table, no kitchen clutter
    ctx.fillStyle = "#4e342e";
    roundRect(ctx, 100, 440, 760, 60, 12, true);
    ctx.fillStyle = "#8d6e63";
    roundRect(ctx, 108, 446, 744, 28, 8, true);
    strokeInk(ctx, 4);
    roundRect(ctx, 100, 440, 760, 60, 12, false);
    for (const s of SEATS) drawPlaceSetting(ctx, s.x, 458);

    drawJuiceMachine(ctx, 45, 210);
    drawTrash(ctx, 45, 285);
    drawDoor(ctx, 870, 42);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 16, false);
  });
}

export const BUFFET_4: MapDef = {
  id: "buffet-4",
  env: "buffet",
  mode: "buffet",
  name: "Grand Banquet",
  slot: 4,
  unlocked: true,
  matchSeconds: 320,
  customerSpawnMs: [5500, 8000],
  spawn: { x: 520, y: 360 },
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
