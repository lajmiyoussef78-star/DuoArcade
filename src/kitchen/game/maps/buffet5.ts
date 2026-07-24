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
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-buffet-5-loft-v2";

/**
 * BUFFET 5 — Market Loft
 *
 * Mezzanine dining TOP-LEFT · east conveyor trays · kitchen BOTTOM
 * Prep bridge center · plates at pass to belt · door SE clear
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  { x: 220, y: 150, w: 320, h: 120 },
  { x: 800, y: 300, w: 100, h: 280 },
  { x: 300, y: 450, w: 420, h: 70 },
  { x: 480, y: 300, w: 140, h: 50 },
  { x: 680, y: 400, w: 50, h: 40 },
  { x: 80, y: 300, w: 60, h: 90 },
];

const TRAYS: BuffetTrayDef[] = [
  { id: "chicken", x: 800, y: 200, label: "Chicken", accepts: "chicken_fried", max: 6, addPerStock: 2 },
  { id: "shrimp", x: 800, y: 260, label: "Shrimp", accepts: "shrimp_fried", max: 4, addPerStock: 2 },
  { id: "fries", x: 800, y: 320, label: "Fries", accepts: "fries", max: 10, addPerStock: 5 },
  { id: "tomato", x: 800, y: 380, label: "Tomatoes", accepts: "tomato_grilled", max: 2, addPerStock: 2 },
  { id: "pepper", x: 800, y: 440, label: "Peppers", accepts: "pepper_grilled", max: 2, addPerStock: 2 },
];

const APPLIANCES: ApplianceDef[] = [
  { id: "pantry_chicken", x: 100, y: 470, kind: "pantry", label: "Chicken", dispenses: "chicken_raw" },
  { id: "pantry_shrimp", x: 160, y: 470, kind: "pantry", label: "Shrimp", dispenses: "shrimp_raw" },
  { id: "pantry_fries", x: 180, y: 410, kind: "pantry", label: "Raw fries", dispenses: "fries_raw" },
  { id: "fryer_a", x: 240, y: 470, kind: "fryer", label: "Fryer" },
  { id: "fryer_b", x: 320, y: 470, kind: "fryer", label: "Fryer" },
  { id: "hold_fryer_l", x: 240, y: 410, kind: "counter", label: "Hold" },
  { id: "hold_fryer_r", x: 320, y: 410, kind: "counter", label: "Hold" },
  { id: "flour_a", x: 400, y: 470, kind: "flour", label: "Flour" },
  { id: "grill_panel_a", x: 470, y: 455, kind: "grill_panel", label: "Pan L" },
  { id: "grill_panel_b", x: 520, y: 455, kind: "grill_panel", label: "Pan R" },
  { id: "sink_a", x: 580, y: 470, kind: "sink", label: "Sink" },
  { id: "plates", x: 680, y: 400, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "pantry_tomato", x: 640, y: 470, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_pepper", x: 700, y: 470, kind: "pantry", label: "Peppers", dispenses: "pepper" },
  { id: "prep_a", x: 440, y: 300, kind: "prep", label: "Chop" },
  { id: "prep_b", x: 520, y: 300, kind: "prep", label: "Chop" },
  { id: "juice_a", x: 80, y: 260, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "trash_a", x: 80, y: 340, kind: "trash", label: "Trash" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 100, y: 130 },
  { id: 1, x: 180, y: 130 },
  { id: 2, x: 260, y: 130 },
  { id: 3, x: 340, y: 130 },
  { id: 4, x: 100, y: 200 },
  { id: 5, x: 180, y: 200 },
  { id: 6, x: 260, y: 200 },
  { id: 7, x: 340, y: 200 },
];

function drawBrickWall(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#4e342e";
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  for (let y = 0; y < MAP_H; y += 18) {
    for (let x = 0; x < MAP_W; x += 36) {
      const off = (y / 18) % 2 === 0 ? 0 : 18;
      ctx.fillStyle = (x + y) % 72 === 0 ? "#6d4c41" : "#5d4037";
      ctx.fillRect(x + off, y, 34, 16);
    }
  }
}

function drawPipeRail(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.strokeStyle = "#78909c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = "#cfd8dc";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawHangingLamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 30);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = "#ff8f00";
  roundRect(ctx, x - 12, y, 24, 16, 4, true);
  const glow = ctx.createRadialGradient(x, y + 8, 4, x, y + 8, 50);
  glow.addColorStop(0, "rgba(255,183,77,0.4)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y + 8, 50, 0, Math.PI * 2);
  ctx.fill();
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawBrickWall(ctx);
    drawWoodFloor(ctx, 60, 60, 840, 460, "#8d6e63");

    drawBanner(ctx, "MARKET LOFT", "#455a64", "mezzanine · conveyor belt");
    drawPipeRail(ctx, 740, 80, 740, 480);
    for (const lx of [200, 400, 560]) drawHangingLamp(ctx, lx, 95);

    // Mezzanine dining — even 2×4 grid
    ctx.fillStyle = "#37474f";
    roundRect(ctx, 60, 100, 320, 130, 10, true);
    ctx.fillStyle = "#546e7a";
    roundRect(ctx, 68, 108, 304, 114, 8, true);
    strokeInk(ctx, 3);
    roundRect(ctx, 60, 100, 320, 130, 10, false);
    for (const s of SEATS) drawPlaceSetting(ctx, s.x, s.y - 6);

    // East conveyor belt
    ctx.fillStyle = "#455a64";
    roundRect(ctx, 750, 170, 100, 300, 8, true);
    ctx.fillStyle = "#607d8b";
    for (let y = 180; y < 460; y += 28) ctx.fillRect(758, y, 84, 8);
    ctx.fillStyle = "#ffc107";
    ctx.fillRect(750, 170, 6, 300);
    ctx.fillRect(844, 170, 6, 300);
    for (const t of TRAYS) drawBuffetTraySlot(ctx, t.x, t.y);

    // Prep bridge — kitchen to belt
    drawSteelCounter(ctx, 410, 270, 160, 55);
    drawCuttingBoard(ctx, 420, 278);
    drawCuttingBoard(ctx, 500, 278);
    drawPotatoCrate(ctx, 360, 275);

    // Bottom cook line — even spacing, faces north
    drawSteelCounter(ctx, 80, 420, 640, 70);
    drawChickenCrate(ctx, 90, 432);
    drawShrimpBowl(ctx, 150, 432);
    drawFryer(ctx, 200, 400);
    drawFryer(ctx, 280, 400);
    drawFlourBowl(ctx, 370, 430);
    drawGrill(ctx, 440, 400);
    drawSink(ctx, 540, 425);
    drawPlateStack(ctx, 650, 370);
    drawTomatoCrate(ctx, 610, 432);
    drawPepperCrate(ctx, 670, 430);

    drawJuiceMachine(ctx, 45, 230);
    drawTrash(ctx, 45, 310);
    drawDoor(ctx, 870, 480);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 16, false);
  });
}

export const BUFFET_5: MapDef = {
  id: "buffet-5",
  env: "buffet",
  mode: "buffet",
  name: "Market Loft",
  slot: 5,
  unlocked: true,
  matchSeconds: 320,
  customerSpawnMs: [5500, 8000],
  spawn: { x: 480, y: 360 },
  door: { x: 900, y: 490 },
  menu: [],
  plateStock: 9,
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  buffetTrays: TRAYS,
  bgKey: BG,
  paint,
};
