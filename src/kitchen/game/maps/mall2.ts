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
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-mall-2-atrium-v3";

/**
 * MALL MAP 2 — Atrium Express
 *
 * Distinct from Food Court Frenzy (center island + side seating):
 *   • Cook storefront along the TOP
 *   • Pantry column on the LEFT (clears dining below)
 *   • Dessert kiosk + plates / holds on the RIGHT
 *   • Vertical PASS dividing kitchen from atrium
 *   • Dining along the BOTTOM atrium (centered, clear of stock)
 *
 * Same full mall menu / timing as map 1.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Top cook storefront
  { x: 480, y: 115, w: 720, h: 55 },
  // Left stock — matches painted counter (stops above dining)
  { x: 100, y: 320, w: 100, h: 260 },
  // Vertical pass
  { x: 480, y: 280, w: 52, h: 150 },
  // Right dessert kiosk
  { x: 850, y: 240, w: 110, h: 90 },
  // Right plates / holds
  { x: 850, y: 380, w: 110, h: 90 },
  // Bottom atrium dining (centered — clear of stock & sweets)
  { x: 280, y: 465, w: 70, h: 48 },
  { x: 420, y: 465, w: 70, h: 48 },
  { x: 560, y: 465, w: 70, h: 48 },
  { x: 700, y: 465, w: 70, h: 48 },
];

const APPLIANCES: ApplianceDef[] = [
  // Top cook — stand south of storefront
  { id: "oven_a", x: 200, y: 170, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 300, y: 170, kind: "grill", label: "Grill" },
  { id: "trash_a", x: 390, y: 170, kind: "trash", label: "Trash" },
  { id: "prep_a", x: 480, y: 170, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 570, y: 170, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 680, y: 170, kind: "fryer", label: "Fryer" },
  // Left stock — stand east of crates (even spacing on counter)
  { id: "pantry_tomato", x: 180, y: 220, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 180, y: 265, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 180, y: 310, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 180, y: 355, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 180, y: 400, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 180, y: 440, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // Pass
  { id: "pass_a", x: 480, y: 280, kind: "pass", label: "Pass · hold" },
  // Right dessert — stand west
  { id: "juice_a", x: 770, y: 220, kind: "juice", label: "Juice", dispenses: "juice" },
  { id: "icecream_a", x: 770, y: 280, kind: "icecream", label: "Ice cream", dispenses: "ice_cream" },
  // Right plates / holds — stand west (above dining)
  { id: "plates", x: 770, y: 350, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_bar_l", x: 770, y: 395, kind: "counter", label: "Hold" },
  { id: "hold_bar_r", x: 770, y: 435, kind: "counter", label: "Hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 280, y: 470 },
  { id: 1, x: 420, y: 470 },
  { id: 2, x: 560, y: 470 },
  { id: 3, x: 700, y: 470 },
];

function drawAtriumFloor(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#d7ccc8";
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  const step = 28;
  for (let y = 0; y < MAP_H; y += step) {
    for (let x = 0; x < MAP_W; x += step) {
      ctx.fillStyle = (x / step + y / step) % 2 === 0 ? "#efebe9" : "#bcaaa4";
      ctx.fillRect(x, y, step - 1, step - 1);
    }
  }
}

function drawSkylight(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#e3f2fd");
  g.addColorStop(0.5, "#bbdefb");
  g.addColorStop(1, "#90caf9");
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, 10, true);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 4, y + 4);
    ctx.lineTo(x + (w * i) / 4, y + h - 4);
    ctx.stroke();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, w, h, 10, false);
}

function drawEscalator(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  roundRect(ctx, x, y, 70, 100, 6, true);
  ctx.fillStyle = "#78909c";
  roundRect(ctx, x + 8, y + 8, 54, 84, 4, true);
  ctx.fillStyle = "#546e7a";
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(x + 12, y + 14 + i * 12, 46, 6);
  }
  ctx.strokeStyle = "#cfd8dc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 90);
  ctx.lineTo(x + 60, y + 10);
  ctx.stroke();
  strokeInk(ctx, 2.5);
  roundRect(ctx, x + 8, y + 8, 54, 84, 4, false);
}

function drawPlanter(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 36, 22, 4, true);
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x + 2, y + 2, 32, 18, 3, true);
  ctx.fillStyle = "#43a047";
  ctx.beginPath();
  ctx.ellipse(x + 18, y - 2, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#66bb6a";
  ctx.beginPath();
  ctx.ellipse(x + 12, y - 6, 8, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 24, y - 5, 7, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawNeonSign(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  color: string,
) {
  ctx.fillStyle = "#212121";
  roundRect(ctx, x, y, w, 22, 4, true);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 2, y + 2, w - 4, 18, 3, false);
  ctx.fillStyle = color;
  ctx.font = "bold 9px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + 15);
}

function drawServiceSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#1a237e";
  roundRect(ctx, x - 28, y, 56, 16, 4, true);
  ctx.fillStyle = "#ea80fc";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS", x, y + 12);
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    drawAtriumFloor(ctx);

    // Banner
    ctx.fillStyle = "#7b1fa2";
    roundRect(ctx, 240, 6, 480, 32, 8, true);
    strokeInk(ctx, 3);
    roundRect(ctx, 240, 6, 480, 32, 8, false);
    ctx.fillStyle = "#f3e5f5";
    ctx.font = "bold 14px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ATRIUM EXPRESS  ·  storefront kitchen", 480, 28);

    // Atrium skylight (mid court — above dining)
    drawSkylight(ctx, 250, 290, 460, 80);
    drawEscalator(ctx, 310, 292);
    drawEscalator(ctx, 580, 292);
    drawPlanter(ctx, 420, 345);
    drawPlanter(ctx, 500, 345);

    // —— Top cook storefront ——
    drawSteelCounter(ctx, 120, 80, 720, 60);
    drawNeonSign(ctx, 140, 58, 100, "GRILL ROW", "#ff80ab");
    drawOven(ctx, 150, 55);
    drawGrill(ctx, 250, 55);
    drawTrash(ctx, 355, 80);
    drawCuttingBoard(ctx, 450, 95);
    drawSink(ctx, 530, 88);
    drawFryer(ctx, 630, 65);

    // —— Left stock (aligned with stands; clears dining) ——
    drawSteelCounter(ctx, 50, 190, 100, 260);
    drawNeonSign(ctx, 53, 172, 94, "STOCK", "#80cbc4");
    drawTomatoCrate(ctx, 68, 200);
    drawMozzarellaBowl(ctx, 68, 245);
    drawBunCrate(ctx, 68, 290);
    drawPattyTray(ctx, 68, 335);
    drawPotatoCrate(ctx, 68, 380);
    drawDoughCrate(ctx, 68, 420);

    // —— Vertical pass ——
    drawSteelCounter(ctx, 454, 205, 52, 150);
    drawServiceSign(ctx, 480, 198);
    ctx.strokeStyle = "rgba(234,128,252,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(480, 275, 14, 0, Math.PI * 2);
    ctx.stroke();

    // —— Right dessert + plates ——
    drawSteelCounter(ctx, 795, 195, 110, 95);
    drawNeonSign(ctx, 800, 178, 100, "SWEETS", "#f48fb1");
    drawJuiceMachine(ctx, 810, 195);
    drawIceCreamMachine(ctx, 810, 245);

    drawSteelCounter(ctx, 795, 335, 110, 100);
    drawPlateStack(ctx, 820, 330);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(850, 390, 11, 0, Math.PI * 2);
    ctx.arc(850, 430, 11, 0, Math.PI * 2);
    ctx.fill();

    // —— Bottom atrium dining (centered) ——
    ctx.fillStyle = "#5e35b1";
    ctx.font = "bold 10px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ATRIUM SEATING", 490, 430);

    drawDiningSet(ctx, 280, 460);
    drawDiningSet(ctx, 420, 460);
    drawDiningSet(ctx, 560, 460);
    drawDiningSet(ctx, 700, 460);
    drawTableCondiments(ctx, 280, 458);
    drawTableCondiments(ctx, 420, 458);
    drawTableCondiments(ctx, 560, 458);
    drawTableCondiments(ctx, 700, 458);

    drawDoor(ctx, 870, 42);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 14, false);
  });
}

export const MALL_2: MapDef = {
  id: "mall-2",
  env: "mall",
  name: "Atrium Express",
  slot: 2,
  unlocked: true,
  matchSeconds: 255,
  customerSpawnMs: [3200, 4800],
  spawn: { x: 400, y: 250 },
  door: { x: 900, y: 55 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice", "ice_cream"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
