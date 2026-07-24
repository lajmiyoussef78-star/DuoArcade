import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawBunCrate,
  drawCuttingBoard,
  drawDiningSet,
  drawDoor,
  drawDoughCrate,
  drawFryer,
  drawGrill,
  drawIceCreamMachine,
  drawJuiceMachine,
  drawMozzarellaBowl,
  drawOven,
  drawPattyTray,
  drawPlateStack,
  drawPotatoCrate,
  drawSink,
  drawSteelCounter,
  drawTableCondiments,
  drawTomatoCrate,
  drawTrash,
  ensureCanvas,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-mall-15";

/**
 * MALL FOOD COURT — central cook island, dining on BOTH sides,
 * dessert kiosk (juice + ice cream) at the front.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Central kitchen island
  { x: 480, y: 220, w: 320, h: 140 },
  // Dessert kiosk bottom
  { x: 480, y: 420, w: 220, h: 55 },
  // Side dining tables
  { x: 160, y: 180, w: 40, h: 28 },
  { x: 160, y: 300, w: 40, h: 28 },
  { x: 800, y: 180, w: 40, h: 28 },
  { x: 800, y: 300, w: 40, h: 28 },
];

const APPLIANCES: ApplianceDef[] = [
  { id: "oven_a", x: 380, y: 200, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 480, y: 200, kind: "grill", label: "Grill" },
  // Left of cook island, beside the oven / grill
  { id: "trash_a", x: 300, y: 200, kind: "trash", label: "Trash" },
  { id: "prep_a", x: 580, y: 200, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 380, y: 280, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 480, y: 280, kind: "fryer", label: "Fryer" },
  { id: "pass_a", x: 580, y: 280, kind: "pass", label: "Pass · hold" },
  // Free hold spots on the cook island edges
  { id: "hold_island_l", x: 420, y: 320, kind: "counter", label: "Hold" },
  { id: "hold_island_r", x: 540, y: 320, kind: "counter", label: "Hold" },
  { id: "juice_a", x: 400, y: 470, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "icecream_a", x: 500, y: 470, kind: "icecream", label: "Ice cream", dispenses: "ice_cream" },
  { id: "pantry_tomato", x: 80, y: 448, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 145, y: 448, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 210, y: 448, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 275, y: 448, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 680, y: 448, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 745, y: 448, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  { id: "plates", x: 820, y: 448, kind: "plates", label: "Plates", dispenses: "plate" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 130, y: 185 },
  { id: 1, x: 130, y: 305 },
  { id: 2, x: 830, y: 185 },
  { id: 3, x: 830, y: 305 },
];

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Mall tile floor
    ctx.fillStyle = "#cfd8dc";
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    const step = 26;
    for (let y = 0; y < MAP_H; y += step) {
      for (let x = 0; x < MAP_W; x += step) {
        ctx.fillStyle = (x / step + y / step) % 2 === 0 ? "#eceff1" : "#b0bec5";
        ctx.fillRect(x, y, step - 1, step - 1);
      }
    }

    // Banner
    ctx.fillStyle = "#ff7043";
    roundRect(ctx, 260, 8, 440, 30, 8, true);
    strokeInk(ctx, 3);
    roundRect(ctx, 260, 8, 440, 30, 8, false);
    ctx.fillStyle = "#fff8e1";
    ctx.font = "bold 14px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FOOD COURT  ·  CENTER ISLAND", 480, 28);

    // Side dining rugs
    ctx.fillStyle = "#efebe9";
    roundRect(ctx, 50, 90, 200, 280, 14, true);
    roundRect(ctx, 710, 90, 200, 280, 14, true);
    strokeInk(ctx, 3);
    roundRect(ctx, 50, 90, 200, 280, 14, false);
    roundRect(ctx, 710, 90, 200, 280, 14, false);
    ctx.fillStyle = "#e64a19";
    ctx.font = "bold 10px Sora, sans-serif";
    ctx.fillText("SEATING", 150, 110);
    ctx.fillText("SEATING", 810, 110);

    // Central cook island
    ctx.fillStyle = "#90a4ae";
    roundRect(ctx, 300, 120, 360, 200, 16, true);
    strokeInk(ctx, 4);
    roundRect(ctx, 300, 120, 360, 200, 16, false);
    ctx.fillStyle = "#37474f";
    ctx.font = "bold 11px Sora, sans-serif";
    ctx.fillText("COOK ISLAND", 480, 140);

    drawSteelCounter(ctx, 320, 150, 320, 60);
    drawOven(ctx, 340, 125);
    drawGrill(ctx, 440, 125);
    drawTrash(ctx, 278, 155);
    drawCuttingBoard(ctx, 560, 160);

    drawSteelCounter(ctx, 320, 240, 320, 55);
    drawSink(ctx, 340, 245);
    drawFryer(ctx, 430, 220);
    ctx.strokeStyle = "rgba(255,152,0,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(560, 260, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#e65100";
    ctx.font = "bold 9px Sora, sans-serif";
    ctx.fillText("PASS", 560, 248);

    // Side tables
    drawDiningSet(ctx, 160, 175);
    drawDiningSet(ctx, 160, 295);
    drawDiningSet(ctx, 800, 175);
    drawDiningSet(ctx, 800, 295);
    drawTableCondiments(ctx, 160, 173);
    drawTableCondiments(ctx, 160, 293);
    drawTableCondiments(ctx, 800, 173);
    drawTableCondiments(ctx, 800, 293);

    // Dessert kiosk
    drawSteelCounter(ctx, 360, 385, 240, 60);
    ctx.fillStyle = "#ad1457";
    ctx.font = "bold 10px Sora, sans-serif";
    ctx.fillText("DESSERT KIOSK", 480, 380);
    drawJuiceMachine(ctx, 370, 360);
    drawIceCreamMachine(ctx, 460, 355);

    // Ingredient wings
    drawSteelCounter(ctx, 40, 420, 260, 55);
    drawTomatoCrate(ctx, 50, 412);
    drawMozzarellaBowl(ctx, 110, 414);
    drawBunCrate(ctx, 170, 416);
    drawPattyTray(ctx, 230, 422);

    drawSteelCounter(ctx, 660, 420, 280, 55);
    drawPotatoCrate(ctx, 670, 412);
    drawDoughCrate(ctx, 735, 414);
    drawPlateStack(ctx, 800, 405);

    // Door top-center under banner
    drawDoor(ctx, 452, 45);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 14, false);
  });
}

export const MALL_1: MapDef = {
  id: "mall-1",
  env: "mall",
  name: "Food Court Frenzy",
  slot: 1,
  unlocked: true,
  /** Full menu + wash loops + crowded lanes. */
  matchSeconds: 255,
  customerSpawnMs: [3200, 4800],
  spawn: { x: 480, y: 360 },
  door: { x: 480, y: 90 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice", "ice_cream"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
