import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawCounterIsland,
  drawCuttingBoard,
  drawDarkCookCounter,
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
  drawSink,
  drawTomatoCrate,
  drawTrash,
  ensureCanvas,
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-diner-4-lastcall-v15";

/** Kitchen tile pad — rows centered on this area. */
const KITCHEN_X = 540;
const KITCHEN_W = 390;
const KITCHEN_CX = KITCHEN_X + KITCHEN_W / 2;

const TOP_ROW_W = 365;
const MID_ROW_W = 260;
const BOT_ROW_W = 260;

const TOP_ROW_X = Math.round(KITCHEN_CX - TOP_ROW_W / 2);
const MID_ROW_X = Math.round(KITCHEN_CX - MID_ROW_W / 2);
const BOT_ROW_X = Math.round(KITCHEN_CX - BOT_ROW_W / 2);

/** Stand south of each counter (outside collider), in the walk aisle. */
const TOP_STAND_Y = 140;
const MID_STAND_Y = 290;
const BOT_STAND_Y = 450;

/**
 * DINER MAP 4 — Last Call
 *
 * Late-night neon diner (mirror of Morning Rush):
 *   • Kitchen stacked on the RIGHT
 *   • Vertical PASS as the divider
 *   • Dining lounge on the LEFT
 *
 * Same stations / menu / controls as the other diner maps.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Right kitchen — colliders match counter bodies (stands sit south in aisles)
  { x: KITCHEN_CX, y: 97, w: TOP_ROW_W, h: 50 },
  { x: KITCHEN_CX, y: 245, w: MID_ROW_W, h: 46 },
  { x: KITCHEN_CX, y: 397, w: BOT_ROW_W, h: 50 },
  // Vertical pass
  { x: 500, y: 270, w: 48, h: 240 },
  // Dining furniture
  { x: 130, y: 165, w: 78, h: 48 },
  { x: 300, y: 165, w: 78, h: 48 },
  { x: 130, y: 330, w: 56, h: 56 },
  { x: 300, y: 330, w: 56, h: 56 },
  { x: 210, y: 450, w: 78, h: 48 },
];

const APPLIANCES: ApplianceDef[] = [
  // Top cook — stand centers match painted sprites
  { id: "prep_a", x: TOP_ROW_X + 31, y: TOP_STAND_Y, kind: "prep", label: "Chop" },
  { id: "sink_a", x: TOP_ROW_X + 112, y: TOP_STAND_Y, kind: "sink", label: "Sink" },
  { id: "oven_a", x: TOP_ROW_X + 206, y: TOP_STAND_Y, kind: "oven", label: "Oven" },
  { id: "grill_a", x: TOP_ROW_X + 306, y: TOP_STAND_Y, kind: "grill", label: "Grill" },
  // Mid pantry — crate centers
  { id: "pantry_tomato", x: MID_ROW_X + 33, y: MID_STAND_Y, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: MID_ROW_X + 103, y: MID_STAND_Y, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_potato", x: MID_ROW_X + 173, y: MID_STAND_Y, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: MID_ROW_X + 243, y: MID_STAND_Y, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // Bottom — trash · hold · plates · fryer
  { id: "trash_a", x: BOT_ROW_X + 30, y: BOT_STAND_Y, kind: "trash", label: "Trash" },
  { id: "hold_plates", x: BOT_ROW_X + 81, y: BOT_STAND_Y, kind: "counter", label: "Hold" },
  { id: "plates", x: BOT_ROW_X + 132, y: BOT_STAND_Y, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "fryer_a", x: BOT_ROW_X + 211, y: BOT_STAND_Y, kind: "fryer", label: "Fryer" },
  // Pass — center of vertical service counter
  { id: "pass_a", x: 500, y: 270, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 130, y: 170 },
  { id: 1, x: 300, y: 170 },
  { id: 2, x: 130, y: 335 },
  { id: 3, x: 300, y: 335 },
  { id: 4, x: 210, y: 455 },
];

function drawNightFloor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#0d1117";
  roundRect(ctx, x, y, w, h, 14, true);
  const step = 22;
  for (let yy = y + 6; yy < y + h - 6; yy += step) {
    for (let xx = x + 6; xx < x + w - 6; xx += step) {
      const dark = ((xx + yy) / step) % 2 < 1;
      ctx.fillStyle = dark ? "#151a22" : "#1c2430";
      ctx.fillRect(xx, yy, step - 1, step - 1);
    }
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
}

function drawKitchenTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#1a1a1a";
  roundRect(ctx, x, y, w, h, 14, true);
  const step = 20;
  for (let yy = y + 6; yy < y + h - 6; yy += step) {
    for (let xx = x + 6; xx < x + w - 6; xx += step) {
      const dark = ((xx + yy) / step) % 2 < 1;
      ctx.fillStyle = dark ? "#262626" : "#f5f5f5";
      ctx.fillRect(xx, yy, step - 1, step - 1);
    }
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
}

function drawNeonCarpet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const rug = ctx.createLinearGradient(x, y, x + w, y + h);
  rug.addColorStop(0, "#1a0a2e");
  rug.addColorStop(0.5, "#2d1b4e");
  rug.addColorStop(1, "#12081f");
  ctx.fillStyle = rug;
  roundRect(ctx, x, y, w, h, 18, true);
  ctx.strokeStyle = "#e040fb";
  ctx.lineWidth = 2.5;
  roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 12, false);
  ctx.strokeStyle = "rgba(0,229,255,0.35)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 22, y + 22, w - 44, h - 44, 8, false);
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, w, h, 18, false);
}

function drawNightWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w = 64, h = 32) {
  const night = ctx.createLinearGradient(x, y, x, y + h);
  night.addColorStop(0, "#1a237e");
  night.addColorStop(0.5, "#311b92");
  night.addColorStop(1, "#4a148c");
  ctx.fillStyle = night;
  roundRect(ctx, x, y, w, h, 4, true);
  // City lights
  ctx.fillStyle = "#ffeb3b";
  ctx.fillRect(x + 10, y + 18, 3, 3);
  ctx.fillStyle = "#ff4081";
  ctx.fillRect(x + 28, y + 14, 3, 3);
  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(x + 44, y + 20, 3, 3);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundRect(ctx, x + 4, y + 3, w * 0.35, h * 0.3, 2, true);
  ctx.fillStyle = "#263238";
  roundRect(ctx, x - 3, y - 2, 7, h + 4, 2, true);
  roundRect(ctx, x + w - 4, y - 2, 7, h + 4, 2, true);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, w, h, 4, false);
}

function drawLastCallSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#12081f";
  roundRect(ctx, x, y, 120, 30, 6, true);
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 3, y + 3, 114, 24, 4, false);
  ctx.fillStyle = "#e040fb";
  ctx.font = "bold 11px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LAST CALL", x + 60, y + 20);
  strokeInk(ctx, 2.5);
  roundRect(ctx, x, y, 120, 30, 6, false);
}

function drawNeonStool(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 16, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7c4dff";
  ctx.beginPath();
  ctx.ellipse(x, y, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#90a4ae";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** High-back booth in plum + neon trim. */
function drawNeonBooth(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + 42, 48, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  roundRect(ctx, x - 52, y - 8, 28, 48, 8, true);
  ctx.fillStyle = "#4a148c";
  roundRect(ctx, x - 50, y - 6, 24, 44, 7, true);
  ctx.fillStyle = "#7b1fa2";
  roundRect(ctx, x - 48, y, 20, 18, 5, true);

  ctx.fillStyle = INK;
  roundRect(ctx, x + 24, y - 8, 28, 48, 8, true);
  ctx.fillStyle = "#4a148c";
  roundRect(ctx, x + 26, y - 6, 24, 44, 7, true);
  ctx.fillStyle = "#7b1fa2";
  roundRect(ctx, x + 28, y, 20, 18, 5, true);

  ctx.fillStyle = INK;
  roundRect(ctx, x - 22, y + 4, 44, 30, 6, true);
  ctx.fillStyle = "#1a237e";
  roundRect(ctx, x - 20, y + 6, 40, 26, 5, true);
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x - 18, y + 8, 36, 22, 4, false);

  strokeInk(ctx, 2.5);
  roundRect(ctx, x - 52, y - 8, 28, 48, 8, false);
  roundRect(ctx, x + 24, y - 8, 28, 48, 8, false);
  roundRect(ctx, x - 22, y + 4, 44, 30, 6, false);
}

/** Hex / octagon lounge table with neon ring. */
function drawHexTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  drawNeonStool(ctx, x - 30, y + 10);
  drawNeonStool(ctx, x + 30, y + 10);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const r = 22;
  ctx.fillStyle = INK;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r * 0.7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#263238";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * (r - 3);
    const py = y + Math.sin(a) * (r - 3) * 0.7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#e040fb";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * (r - 5);
    const py = y + Math.sin(a) * (r - 5) * 0.7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "#546e7a";
  roundRect(ctx, x - 4, y + 10, 8, 10, 2, true);

  strokeInk(ctx, 2.5);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r * 0.7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawNeonTube(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 1);
  ctx.lineTo(x + w - 4, y - 1);
  ctx.stroke();
}

function drawServiceSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#12081f";
  roundRect(ctx, x - 36, y - 14, 72, 20, 4, true);
  ctx.fillStyle = "#00e5ff";
  ctx.font = "bold 10px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS", x, y);
  strokeInk(ctx, 2);
  roundRect(ctx, x - 36, y - 14, 72, 20, 4, false);
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Outer room wash
    const wash = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    wash.addColorStop(0, "#0a0612");
    wash.addColorStop(0.45, "#140a24");
    wash.addColorStop(1, "#0d1117");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Dining (left)
    drawNightFloor(ctx, 28, 28, 440, 484);
    drawNeonCarpet(ctx, 50, 70, 380, 400);

    // Kitchen (right)
    drawKitchenTile(ctx, KITCHEN_X, 28, 390, 484);

    drawFloorDirt(ctx, 80, 100, 40, 30);
    drawFloorDirt(ctx, 700, 280, 50, 35);

    // Neon tubes along kitchen / dining edges
    drawNeonTube(ctx, 60, 48, 160, "#e040fb");
    drawNeonTube(ctx, 240, 48, 160, "#00e5ff");
    drawNeonTube(ctx, 560, 48, 180, "#ff4081");
    drawNeonTube(ctx, 760, 48, 140, "#00e5ff");

    drawNightWindow(ctx, 70, 55);
    drawNightWindow(ctx, 160, 55);
    drawNightWindow(ctx, 250, 55);
    drawLastCallSign(ctx, 340, 52);

    // —— Right kitchen — three rows centered on kitchen floor ——
    drawDarkCookCounter(ctx, TOP_ROW_X, 70, 165, 55);
    drawDarkCookCounter(ctx, TOP_ROW_X + 165, 70, 200, 55);
    drawCuttingBoard(ctx, TOP_ROW_X + 5, 82);
    drawSink(ctx, TOP_ROW_X + 83, 78);
    drawOven(ctx, TOP_ROW_X + 160, 65);
    drawGrill(ctx, TOP_ROW_X + 260, 65);

    drawMarbleCounter(ctx, MID_ROW_X, 220, MID_ROW_W, 50);
    drawTomatoCrate(ctx, MID_ROW_X + 5, 212);
    drawMozzarellaBowl(ctx, MID_ROW_X + 75, 214);
    drawPotatoCrate(ctx, MID_ROW_X + 145, 212);
    drawDoughCrate(ctx, MID_ROW_X + 215, 214);

    drawDarkCookCounter(ctx, BOT_ROW_X, 370, BOT_ROW_W, 55);
    drawTrash(ctx, BOT_ROW_X + 8, 378);
    drawPlateStack(ctx, BOT_ROW_X + 100, 372);
    drawFryer(ctx, BOT_ROW_X + 165, 375);

    // Vertical pass
    drawCounterIsland(ctx, 476, 150, 48, 240, "#1a237e", "#00e5ff");
    drawServiceSign(ctx, 500, 145);
    drawNeonStool(ctx, 455, 200);
    drawNeonStool(ctx, 455, 270);
    drawNeonStool(ctx, 455, 340);
    drawNeonStool(ctx, 545, 200);
    drawNeonStool(ctx, 545, 270);
    drawNeonStool(ctx, 545, 340);

    // —— Dining ——
    drawNeonBooth(ctx, 130, 140);
    drawNeonBooth(ctx, 300, 140);
    drawHexTable(ctx, 130, 310);
    drawHexTable(ctx, 300, 310);
    drawNeonBooth(ctx, 210, 425);

    drawDoor(ctx, 100, 470);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const DINER_4: MapDef = {
  id: "diner-4",
  env: "diner",
  name: "Last Call",
  slot: 4,
  unlocked: true,
  matchSeconds: 210,
  customerSpawnMs: [4200, 6400],
  spawn: { x: 720, y: 360 },
  door: { x: 100, y: 500 },
  menu: ["pizza", "salad", "fries_meal"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
