import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawCheckerPad,
  drawCounterIsland,
  drawCuttingBoard,
  drawDarkCookCounter,
  drawDiningSet,
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
  drawRestaurantLogo,
  drawSink,
  drawTableCondiments,
  drawTomatoCrate,
  drawTrash,
  drawWallPicture,
  drawWallWindow,
  drawWoodFloor,
  ensureCanvas,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-diner-15";

/**
 * DINER — kitchen stacked on the LEFT wall, dining on the RIGHT.
 * Classic cozy restaurant (not a copy of the beach/mall plans).
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Left kitchen stack
  { x: 160, y: 120, w: 200, h: 70 },
  { x: 150, y: 230, w: 180, h: 55 },
  { x: 150, y: 340, w: 180, h: 55 },
  { x: 200, y: 450, w: 320, h: 50 },
  // Pass near center-left
  { x: 360, y: 200, w: 50, h: 120 },
  // Dining tables (right)
  { x: 560, y: 200, w: 40, h: 28 },
  { x: 720, y: 200, w: 40, h: 28 },
  { x: 560, y: 320, w: 40, h: 28 },
  { x: 720, y: 320, w: 40, h: 28 },
];

const APPLIANCES: ApplianceDef[] = [
  // Match painted stations: oven left, grill right
  { id: "oven_a", x: 140, y: 175, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 220, y: 175, kind: "grill", label: "Grill" },
  // Right of the grill / oven counter
  { id: "trash_a", x: 290, y: 175, kind: "trash", label: "Trash" },
  { id: "prep_a", x: 140, y: 280, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 220, y: 280, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 180, y: 390, kind: "fryer", label: "Fryer" },
  // Free hold spots on either side of the fryer counter — park any item
  { id: "hold_fryer_l", x: 95, y: 340, kind: "counter", label: "Hold" },
  { id: "hold_fryer_r", x: 255, y: 340, kind: "counter", label: "Hold" },
  { id: "pass_a", x: 340, y: 250, kind: "pass", label: "Pass · hold" },
  // Diner meals: pizza, mozzarella, fries — dough / tomato / moz / potato
  { id: "pantry_tomato", x: 80, y: 448, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 145, y: 448, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_potato", x: 210, y: 448, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 275, y: 448, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  { id: "plates", x: 350, y: 448, kind: "plates", label: "Plates", dispenses: "plate" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 520, y: 205 },
  { id: 1, x: 760, y: 205 },
  { id: 2, x: 520, y: 325 },
  { id: 3, x: 760, y: 325 },
];

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawWoodFloor(ctx, 0, 0, MAP_W, MAP_H, "#a67848");

    // Kitchen left — bright check
    drawCheckerPad(ctx, 40, 55, 280, 420, "#f5fbff", "#4fc3f7");
    drawFloorDirt(ctx, 60, 140, 200, 100);

    // Dining right — darker rug
    ctx.fillStyle = "rgba(60,40,25,0.2)";
    roundRect(ctx, 430, 70, 480, 360, 20, true);
    ctx.fillStyle = "#d7ccc8";
    roundRect(ctx, 440, 80, 460, 340, 18, true);
    strokeInk(ctx, 3);
    roundRect(ctx, 440, 80, 460, 340, 18, false);
    drawRestaurantLogo(ctx, 670, 140);
    ctx.fillStyle = "#5d4037";
    ctx.font = "bold 12px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DINING ROOM", 670, 100);

    // Walls
    ctx.fillStyle = "#2f7a7a";
    ctx.fillRect(0, 0, MAP_W, 44);
    drawWallWindow(ctx, 480, 8);
    drawWallWindow(ctx, 620, 8);
    drawWallWindow(ctx, 760, 8);
    drawWallPicture(ctx, 100, 10);
    drawWallPicture(ctx, 250, 10);
    strokeInk(ctx, 4);
    ctx.strokeRect(2, 2, MAP_W - 4, 42);
    ctx.fillStyle = "#2f7a7a";
    ctx.fillRect(0, 0, 36, MAP_H);
    ctx.fillRect(MAP_W - 36, 0, 36, MAP_H);

    // Left kitchen stations
    drawDarkCookCounter(ctx, 60, 80, 220, 70);
    drawOven(ctx, 70, 55);
    drawGrill(ctx, 165, 55);
    drawTrash(ctx, 268, 90);

    drawMarbleCounter(ctx, 60, 200, 200, 55);
    drawCuttingBoard(ctx, 75, 210);
    drawSink(ctx, 160, 205);

    drawCounterIsland(ctx, 60, 310, 200, 60, "#e8c9a0", "#66bb6a");
    drawFryer(ctx, 120, 295);

    // Pass column
    drawCounterIsland(ctx, 300, 150, 70, 160, "#ffe0b2", "#ff9800");
    ctx.fillStyle = "#e65100";
    ctx.font = "bold 9px Sora, sans-serif";
    ctx.fillText("PASS", 335, 145);

    // Ingredient bar bottom-left (diner: tomato, moz, potato, dough, plates)
    drawCounterIsland(ctx, 50, 420, 340, 55, "#d7a86e", "#8d6e63");
    drawTomatoCrate(ctx, 55, 412);
    drawMozzarellaBowl(ctx, 120, 414);
    drawPotatoCrate(ctx, 185, 412);
    drawDoughCrate(ctx, 250, 414);
    drawPlateStack(ctx, 310, 405);

    // Dining tables on the right
    drawDiningSet(ctx, 560, 195);
    drawDiningSet(ctx, 720, 195);
    drawDiningSet(ctx, 560, 315);
    drawDiningSet(ctx, 720, 315);
    drawTableCondiments(ctx, 560, 193);
    drawTableCondiments(ctx, 720, 193);
    drawTableCondiments(ctx, 560, 313);
    drawTableCondiments(ctx, 720, 313);

    // Door bottom-center of dining
    drawDoor(ctx, 640, 430);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const DINER_1: MapDef = {
  id: "diner-1",
  env: "diner",
  name: "Morning Rush",
  slot: 1,
  unlocked: true,
  /** Solo-friendly with wash/walk/pick/crowd overhead baked into patience. */
  matchSeconds: 210,
  customerSpawnMs: [4200, 6400],
  spawn: { x: 400, y: 280 },
  door: { x: 668, y: 500 },
  menu: ["pizza", "salad", "fries_meal"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
