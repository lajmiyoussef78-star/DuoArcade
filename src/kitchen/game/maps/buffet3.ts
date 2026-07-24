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
  drawCuttingBoardVertical,
  drawDoor,
  drawFryer,
  drawGrill,
  drawJuiceMachine,
  drawPlateStack,
  drawPotatoCrate,
  drawSinkFacingEast,
  drawSteelCounter,
  drawTomatoCrate,
  drawTrash,
  drawWoodFloor,
  ensureCanvas,
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-buffet-3-lantern-v2";

/**
 * BUFFET 3 — Lantern Pavilion
 *
 * Window dining TOP · courtyard tray arc CENTER · west cook facing EAST
 * Plates / veg pass at foot of cook · juice/trash east · door NW clear
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  { x: 480, y: 100, w: 760, h: 40 },
  { x: 480, y: 250, w: 380, h: 40 },
  { x: 340, y: 300, w: 40, h: 90 },
  { x: 620, y: 300, w: 40, h: 90 },
  { x: 130, y: 340, w: 140, h: 300 },
  { x: 240, y: 470, w: 50, h: 40 },
  { x: 860, y: 300, w: 70, h: 100 },
];

const TRAYS: BuffetTrayDef[] = [
  { id: "chicken", x: 360, y: 255, label: "Chicken", accepts: "chicken_fried", max: 6, addPerStock: 2 },
  { id: "shrimp", x: 420, y: 238, label: "Shrimp", accepts: "shrimp_fried", max: 4, addPerStock: 2 },
  { id: "fries", x: 480, y: 230, label: "Fries", accepts: "fries", max: 10, addPerStock: 5 },
  { id: "tomato", x: 540, y: 238, label: "Tomatoes", accepts: "tomato_grilled", max: 2, addPerStock: 2 },
  { id: "pepper", x: 600, y: 255, label: "Peppers", accepts: "pepper_grilled", max: 2, addPerStock: 2 },
];

const APPLIANCES: ApplianceDef[] = [
  { id: "pantry_chicken", x: 70, y: 200, kind: "pantry", label: "Chicken", dispenses: "chicken_raw" },
  { id: "pantry_shrimp", x: 70, y: 255, kind: "pantry", label: "Shrimp", dispenses: "shrimp_raw" },
  { id: "pantry_fries", x: 70, y: 310, kind: "pantry", label: "Raw fries", dispenses: "fries_raw" },
  { id: "fryer_a", x: 145, y: 220, kind: "fryer", label: "Fryer" },
  { id: "fryer_b", x: 145, y: 290, kind: "fryer", label: "Fryer" },
  { id: "hold_fryer_l", x: 210, y: 220, kind: "counter", label: "Hold" },
  { id: "hold_fryer_r", x: 210, y: 290, kind: "counter", label: "Hold" },
  { id: "flour_a", x: 145, y: 350, kind: "flour", label: "Flour" },
  { id: "grill_panel_a", x: 130, y: 405, kind: "grill_panel", label: "Pan L" },
  { id: "grill_panel_b", x: 175, y: 405, kind: "grill_panel", label: "Pan R" },
  { id: "prep_a", x: 145, y: 455, kind: "prep", label: "Chop" },
  { id: "prep_b", x: 190, y: 455, kind: "prep", label: "Chop" },
  { id: "pantry_tomato", x: 70, y: 420, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_pepper", x: 70, y: 470, kind: "pantry", label: "Peppers", dispenses: "pepper" },
  { id: "sink_a", x: 145, y: 490, kind: "sink", label: "Sink" },
  { id: "plates", x: 240, y: 470, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "juice_a", x: 860, y: 260, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "trash_a", x: 860, y: 340, kind: "trash", label: "Trash" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 160, y: 130 },
  { id: 1, x: 250, y: 130 },
  { id: 2, x: 340, y: 130 },
  { id: 3, x: 430, y: 130 },
  { id: 4, x: 520, y: 130 },
  { id: 5, x: 610, y: 130 },
  { id: 6, x: 700, y: 130 },
  { id: 7, x: 790, y: 130 },
];

function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = color;
  roundRect(ctx, x - 10, y, 20, 24, 4, true);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  roundRect(ctx, x - 6, y + 4, 12, 10, 2, true);
  const glow = ctx.createRadialGradient(x, y + 12, 2, x, y + 12, 28);
  glow.addColorStop(0, `${color}55`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y + 12, 28, 0, Math.PI * 2);
  ctx.fill();
}

function drawBambooPost(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  ctx.fillStyle = "#558b2f";
  roundRect(ctx, x, y, 10, h, 3, true);
  ctx.fillStyle = "#7cb342";
  roundRect(ctx, x + 1, y + 1, 8, h - 2, 2, true);
  for (let i = 0; i < h; i += 22) {
    ctx.fillStyle = "#33691e";
    ctx.fillRect(x, y + i, 10, 3);
  }
}

function drawRotatedScaled(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  deg: number,
  scale: number,
  paintFn: () => void,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  paintFn();
  ctx.restore();
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawWoodFloor(ctx, 0, 0, MAP_W, MAP_H, "#d7ccc8");

    const sunset = ctx.createLinearGradient(0, 0, 0, 72);
    sunset.addColorStop(0, "#ff8a65");
    sunset.addColorStop(0.5, "#ffb74d");
    sunset.addColorStop(1, "#ffe0b2");
    ctx.fillStyle = sunset;
    ctx.fillRect(0, 0, MAP_W, 72);
    drawBanner(ctx, "LANTERN PAVILION", "#e65100", "sunset window · courtyard trays");

    for (const lx of [140, 300, 460, 620, 780]) drawLantern(ctx, lx, 68, "#ff7043");
    drawBambooPost(ctx, 40, 100, 380);
    drawBambooPost(ctx, 910, 100, 380);

    // Top dining — even seat spacing
    ctx.fillStyle = "#5d4037";
    roundRect(ctx, 100, 70, 760, 55, 12, true);
    ctx.fillStyle = "#8d6e63";
    roundRect(ctx, 108, 76, 744, 28, 8, true);
    strokeInk(ctx, 4);
    roundRect(ctx, 100, 70, 760, 55, 12, false);
    for (const s of SEATS) drawPlaceSetting(ctx, s.x, 82);

    // Courtyard tray U
    ctx.fillStyle = "#eceff1";
    roundRect(ctx, 300, 200, 360, 55, 16, true);
    roundRect(ctx, 300, 210, 48, 120, 12, true);
    roundRect(ctx, 612, 210, 48, 120, 12, true);
    ctx.strokeStyle = "rgba(230,81,0,0.45)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(480, 275, 170, 48, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    strokeInk(ctx, 3);
    roundRect(ctx, 300, 200, 360, 55, 16, false);
    for (const t of TRAYS) drawBuffetTraySlot(ctx, t.x, t.y);

    // West cook — faces east into courtyard
    drawSteelCounter(ctx, 55, 170, 155, 340);
    drawChickenCrate(ctx, 48, 175);
    drawShrimpBowl(ctx, 48, 230);
    drawPotatoCrate(ctx, 45, 285);
    drawFryer(ctx, 95, 185, -90);
    drawFryer(ctx, 95, 255, -90);
    drawRotatedScaled(ctx, 145, 360, -90, 1, () => drawFlourBowl(ctx, 130, 325));
    drawRotatedScaled(ctx, 150, 415, -90, 0.9, () => drawGrill(ctx, 100, 370));
    drawTomatoCrate(ctx, 48, 400);
    drawPepperCrate(ctx, 48, 450);
    drawCuttingBoardVertical(ctx, 125, 430);
    drawCuttingBoardVertical(ctx, 165, 430);
    drawSinkFacingEast(ctx, 115, 460);
    drawPlateStack(ctx, 215, 440);

    drawJuiceMachine(ctx, 825, 230);
    drawTrash(ctx, 825, 310);
    drawDoor(ctx, 40, 42);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 16, false);
  });
}

export const BUFFET_3: MapDef = {
  id: "buffet-3",
  env: "buffet",
  mode: "buffet",
  name: "Lantern Pavilion",
  slot: 3,
  unlocked: true,
  matchSeconds: 320,
  customerSpawnMs: [5500, 8000],
  spawn: { x: 480, y: 400 },
  door: { x: 70, y: 55 },
  menu: [],
  plateStock: 9,
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  buffetTrays: TRAYS,
  bgKey: BG,
  paint,
};
