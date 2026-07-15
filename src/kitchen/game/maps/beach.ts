import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawBunCrate,
  drawCheckerPad,
  drawCounterIsland,
  drawCuttingBoard,
  drawDiningSet,
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
  drawWoodFloor,
  ensureCanvas,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-beach-15";

/**
 * BEACH HOUSE — long TOP bar kitchen facing the ocean view,
 * open patio dining BELOW, juice machine on the bar end.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Top bar kitchen
  { x: 480, y: 115, w: 700, h: 60 },
  // Side prep / juice
  { x: 100, y: 250, w: 100, h: 50 },
  { x: 860, y: 250, w: 100, h: 50 },
  // Bottom pantry strip
  { x: 300, y: 460, w: 480, h: 45 },
  // Patio tables
  { x: 280, y: 320, w: 40, h: 28 },
  { x: 420, y: 320, w: 40, h: 28 },
  { x: 560, y: 320, w: 40, h: 28 },
  { x: 700, y: 320, w: 40, h: 28 },
];

const APPLIANCES: ApplianceDef[] = [
  { id: "oven_a", x: 200, y: 170, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 320, y: 170, kind: "grill", label: "Grill" },
  // Between grills and prep — right next to the grill line
  { id: "trash_a", x: 380, y: 170, kind: "trash", label: "Trash" },
  { id: "prep_a", x: 460, y: 170, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 560, y: 170, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 680, y: 170, kind: "fryer", label: "Fryer" },
  { id: "pass_a", x: 800, y: 170, kind: "pass", label: "Pass · hold" },
  { id: "juice_a", x: 100, y: 300, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "pantry_tomato", x: 100, y: 458, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 165, y: 458, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 230, y: 458, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 295, y: 458, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 360, y: 458, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 425, y: 458, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  { id: "plates", x: 510, y: 458, kind: "plates", label: "Plates", dispenses: "plate" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 250, y: 325 },
  { id: 1, x: 390, y: 325 },
  { id: 2, x: 530, y: 325 },
  { id: 3, x: 670, y: 325 },
];

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Sand + wood deck
    ctx.fillStyle = "#f0d9a8";
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    drawWoodFloor(ctx, 50, 200, MAP_W - 100, MAP_H - 230, "#d4a574");

    // Ocean band at top
    ctx.fillStyle = "#4fc3f7";
    ctx.fillRect(0, 0, MAP_W, 52);
    ctx.fillStyle = "#29b6f6";
    for (let x = 0; x < MAP_W; x += 40) {
      ctx.beginPath();
      ctx.ellipse(x + 20, 48, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff8e1";
    ctx.font = "bold 14px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BEACH BAR  ·  ocean view", 480, 28);

    // Top kitchen bar pad
    drawCheckerPad(ctx, 80, 60, 800, 130, "#e3f2fd", "#4fc3f7");

    drawCounterIsland(ctx, 120, 85, 720, 70, "#e8c9a0", "#81d4fa");
    drawOven(ctx, 140, 58);
    drawGrill(ctx, 260, 58);
    drawTrash(ctx, 358, 75);
    drawCuttingBoard(ctx, 420, 95);
    drawSink(ctx, 500, 90);
    drawFryer(ctx, 600, 70);
    // Pass ring
    ctx.strokeStyle = "rgba(105,240,174,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(780, 110, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#2e7d32";
    ctx.font = "bold 9px Sora, sans-serif";
    ctx.fillText("PASS", 780, 95);

    // Juice station left
    drawCounterIsland(ctx, 50, 220, 120, 60, "#fff3e0", "#ffb74d");
    drawJuiceMachine(ctx, 70, 200);

    // Patio dining row
    ctx.fillStyle = "#efebe9";
    roundRect(ctx, 180, 270, 600, 120, 16, true);
    strokeInk(ctx, 3);
    roundRect(ctx, 180, 270, 600, 120, 16, false);
    ctx.fillStyle = "#0277bd";
    ctx.font = "bold 11px Sora, sans-serif";
    ctx.fillText("PATIO DINING", 480, 288);

    drawDiningSet(ctx, 280, 315);
    drawDiningSet(ctx, 420, 315);
    drawDiningSet(ctx, 560, 315);
    drawDiningSet(ctx, 700, 315);
    drawTableCondiments(ctx, 280, 313);
    drawTableCondiments(ctx, 420, 313);
    drawTableCondiments(ctx, 560, 313);
    drawTableCondiments(ctx, 700, 313);

    // Ingredient strip bottom
    drawCounterIsland(ctx, 70, 430, 520, 55, "#e8c9a0", "#81d4fa");
    drawTomatoCrate(ctx, 80, 422);
    drawMozzarellaBowl(ctx, 145, 424);
    drawBunCrate(ctx, 210, 426);
    drawPattyTray(ctx, 270, 432);
    drawPotatoCrate(ctx, 330, 422);
    drawDoughCrate(ctx, 395, 424);
    drawPlateStack(ctx, 470, 415);

    drawDoor(ctx, 700, 430);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const BEACH_1: MapDef = {
  id: "beach-1",
  env: "beach",
  name: "Sunset Grill",
  slot: 1,
  unlocked: true,
  /** Burger + pizza + juice + plate-wash + crowding. */
  matchSeconds: 235,
  customerSpawnMs: [3800, 5800],
  spawn: { x: 480, y: 380 },
  door: { x: 728, y: 500 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
