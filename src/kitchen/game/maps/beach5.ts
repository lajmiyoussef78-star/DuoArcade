import type Phaser from "phaser";
import type { ApplianceDef } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";
import type { Collider, MapDef } from "./types";
import { MAP_H, MAP_W } from "./types";
import {
  drawBunCrate,
  drawCounterIsland,
  drawCuttingBoardVertical,
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
  drawSinkFacingEast,
  drawTableCondiments,
  drawTomatoCrate,
  drawTrash,
  ensureCanvas,
  INK,
  roundRect,
  strokeInk,
} from "./paintShared";

const BG = "bg-beach-5-lighthouse-v12";

/**
 * BEACH MAP 5 — Lighthouse Landing
 *
 * Distinct from maps 1–4:
 *   • Central lighthouse island as the PASS
 *   • Vertical COOK column on the LEFT (ends above bottom strip — walk gap)
 *   • Vertical PANTRY on the RIGHT
 *   • Bottom service strip (fryer · plates · holds · juice)
 *   • Ocean dining along the TOP boardwalk
 *
 * Same stations / menu / timing as the other Beach House maps.
 */
const COLLIDERS: Collider[] = [
  { x: 480, y: 16, w: 960, h: 32 },
  { x: 480, y: 524, w: 960, h: 32 },
  { x: 16, y: 270, w: 32, h: 540 },
  { x: 944, y: 270, w: 32, h: 540 },
  // Dining tables (top boardwalk)
  { x: 220, y: 105, w: 70, h: 48 },
  { x: 400, y: 105, w: 70, h: 48 },
  { x: 580, y: 105, w: 70, h: 48 },
  { x: 760, y: 105, w: 70, h: 48 },
  // Left cook column — shortened so a walk gap sits above the bottom strip
  { x: 120, y: 265, w: 110, h: 200 },
  // Right pantry — compact column
  { x: 800, y: 300, w: 90, h: 270 },
  // Lighthouse pass (center island)
  { x: 480, y: 300, w: 110, h: 110 },
  // Bottom service — fryer/plates + short yellow hold/juice flush beside plates
  { x: 365, y: 400, w: 280, h: 52 },
  { x: 575, y: 400, w: 150, h: 52 },
];

const APPLIANCES: ApplianceDef[] = [
  // Left cook — stand east; cook → chop → sink, trash at foot
  { id: "oven_a", x: 205, y: 195, kind: "oven", label: "Oven" },
  { id: "grill_a", x: 205, y: 255, kind: "grill", label: "Grill" },
  { id: "prep_a", x: 205, y: 310, kind: "prep", label: "Chop" },
  { id: "sink_a", x: 205, y: 355, kind: "sink", label: "Sink" },
  { id: "trash_a", x: 205, y: 400, kind: "trash", label: "Trash" },
  // Right pantry — compact; stand west of each crate
  { id: "pantry_tomato", x: 770, y: 195, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_cheese", x: 770, y: 235, kind: "pantry", label: "Mozzarella", dispenses: "lettuce" },
  { id: "pantry_bun", x: 770, y: 275, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_patty", x: 770, y: 315, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_potato", x: 770, y: 355, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "pantry_dough", x: 770, y: 395, kind: "pantry", label: "Dough", dispenses: "pizza_dough" },
  // Service — fryer + plates, then short yellow hold/juice flush against plates
  { id: "fryer_a", x: 290, y: 365, kind: "fryer", label: "Fryer" },
  { id: "plates", x: 420, y: 365, kind: "plates", label: "Plates", dispenses: "plate" },
  { id: "hold_bar_l", x: 520, y: 365, kind: "counter", label: "Hold" },
  { id: "hold_bar_r", x: 560, y: 365, kind: "counter", label: "Hold" },
  { id: "juice_a", x: 615, y: 365, kind: "juice", label: "Juice", dispenses: "juice" },
  // Lighthouse pass
  { id: "pass_a", x: 480, y: 300, kind: "pass", label: "Pass · hold" },
];

const SEATS: CustomerSeat[] = [
  { id: 0, x: 220, y: 110 },
  { id: 1, x: 400, y: 110 },
  { id: 2, x: 580, y: 110 },
  { id: 3, x: 760, y: 110 },
];

function drawSand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#f0d9a8";
  roundRect(ctx, x, y, w, h, 14, true);
  for (let i = 0; i < 100; i++) {
    const px = x + 8 + ((i * 53) % Math.max(1, w - 16));
    const py = y + 8 + ((i * 37) % Math.max(1, h - 16));
    ctx.fillStyle = i % 3 === 0 ? "rgba(210,180,120,0.35)" : "rgba(255,248,225,0.4)";
    ctx.beginPath();
    ctx.ellipse(px, py, 6 + (i % 5), 2 + (i % 3), (i % 7) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 4);
  roundRect(ctx, x, y, w, h, 14, false);
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

function drawBoardwalk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x, y, w, h, 8, true);
  ctx.fillStyle = "#a1887f";
  for (let i = 0; i < Math.floor(w / 28); i++) {
    ctx.fillRect(x + 6 + i * 28, y + 4, 22, h - 8);
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y, w, h, 8, false);
}

function drawLighthouse(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Base ring (pass island)
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 42, 58, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#eceff1";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 28, 52, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(cx, cy + 28, 52, 22, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Tower
  ctx.fillStyle = INK;
  roundRect(ctx, cx - 18, cy - 70, 36, 90, 4, true);
  ctx.fillStyle = "#fafafa";
  roundRect(ctx, cx - 16, cy - 68, 32, 86, 3, true);
  // Red stripes
  ctx.fillStyle = "#e53935";
  roundRect(ctx, cx - 16, cy - 50, 32, 14, 2, true);
  roundRect(ctx, cx - 16, cy - 18, 32, 14, 2, true);

  // Lantern room
  ctx.fillStyle = INK;
  roundRect(ctx, cx - 22, cy - 88, 44, 22, 4, true);
  ctx.fillStyle = "#fff59d";
  roundRect(ctx, cx - 18, cy - 84, 36, 14, 3, true);
  ctx.fillStyle = "#ffecb3";
  roundRect(ctx, cx - 12, cy - 80, 14, 8, 2, true);

  // Cap
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy - 88);
  ctx.lineTo(cx, cy - 108);
  ctx.lineTo(cx + 26, cy - 88);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c62828";
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy - 88);
  ctx.lineTo(cx, cy - 104);
  ctx.lineTo(cx + 22, cy - 88);
  ctx.closePath();
  ctx.fill();

  // Light beam
  const beam = ctx.createLinearGradient(cx, cy - 90, cx + 120, cy - 40);
  beam.addColorStop(0, "rgba(255,236,179,0.45)");
  beam.addColorStop(1, "rgba(255,236,179,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(cx + 8, cy - 78);
  ctx.lineTo(cx + 130, cy - 30);
  ctx.lineTo(cx + 130, cy - 70);
  ctx.closePath();
  ctx.fill();

  // Pass label pad
  ctx.fillStyle = "#004d40";
  roundRect(ctx, cx - 28, cy + 18, 56, 16, 4, true);
  ctx.fillStyle = "#b2ff59";
  ctx.font = "bold 8px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PASS", cx, cy + 30);
}

function drawPierPost(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = INK;
  roundRect(ctx, x, y, 10, 36, 2, true);
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x + 1, y + 1, 8, 34, 2, true);
  ctx.fillStyle = "#ff8a65";
  ctx.beginPath();
  ctx.arc(x + 5, y + 2, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSeagull(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.quadraticCurveTo(x - 4, y - 6, x, y);
  ctx.quadraticCurveTo(x + 4, y - 6, x + 10, y);
  ctx.stroke();
}

function drawUmbrellaTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.ellipse(x, y, 20, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Umbrella
  ctx.fillStyle = "#29b6f6";
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 8);
  ctx.quadraticCurveTo(x, y - 28, x + 22, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e3f2fd";
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 10);
  ctx.quadraticCurveTo(x, y - 22, x + 10, y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, y + 2);
  ctx.stroke();
  strokeInk(ctx, 2.5);
  ctx.beginPath();
  ctx.ellipse(x, y, 24, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function paint(scene: Phaser.Scene) {
  ensureCanvas(scene, BG, MAP_W, MAP_H, (ctx) => {
    // Sunset sky wash
    const wash = ctx.createLinearGradient(0, 0, 0, MAP_H);
    wash.addColorStop(0, "#ff8a65");
    wash.addColorStop(0.22, "#ffcc80");
    wash.addColorStop(0.45, "#ffe0b2");
    wash.addColorStop(1, "#f5e6c8");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Ocean band
    const ocean = ctx.createLinearGradient(0, 0, 0, 58);
    ocean.addColorStop(0, "#0277bd");
    ocean.addColorStop(1, "#4fc3f7");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, MAP_W, 58);
    ctx.fillStyle = "#81d4fa";
    for (let x = 0; x < MAP_W; x += 36) {
      ctx.beginPath();
      ctx.ellipse(x + 18, 54, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#e1f5fe";
    ctx.font = "bold 13px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LIGHTHOUSE LANDING  ·  sunset service", 480, 28);

    drawSand(ctx, 28, 62, MAP_W - 56, MAP_H - 82);
    drawBoardwalk(ctx, 60, 70, MAP_W - 120, 70);

    // Decor
    drawSeagull(ctx, 140, 48);
    drawSeagull(ctx, 320, 40);
    drawSeagull(ctx, 700, 46);
    drawPierPost(ctx, 90, 130);
    drawPierPost(ctx, 870, 130);
    drawPierPost(ctx, 90, 380);
    drawPierPost(ctx, 870, 380);

    // String lights across courtyard
    ctx.strokeStyle = "rgba(43,29,20,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(180, 160);
    ctx.quadraticCurveTo(480, 200, 780, 160);
    ctx.stroke();
    for (const lx of [240, 320, 400, 480, 560, 640, 720]) {
      const t = (lx - 180) / 600;
      const ly = 160 + Math.sin(t * Math.PI) * 40;
      ctx.fillStyle = "#ffe082";
      ctx.beginPath();
      ctx.arc(lx, ly + 8, 4, 0, Math.PI * 2);
      ctx.fill();
      strokeInk(ctx, 1.5);
      ctx.beginPath();
      ctx.arc(lx, ly + 8, 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Dining
    drawUmbrellaTable(ctx, 220, 95);
    drawUmbrellaTable(ctx, 400, 95);
    drawUmbrellaTable(ctx, 580, 95);
    drawUmbrellaTable(ctx, 760, 95);
    drawTableCondiments(ctx, 220, 93);
    drawTableCondiments(ctx, 400, 93);
    drawTableCondiments(ctx, 580, 93);
    drawTableCondiments(ctx, 760, 93);
    drawDoor(ctx, 480, 42);

    // —— Left cook (short column + walk gap above bottom strip) ——
    // Oven/grill face east (-90°). Chop next to cook, sink under chop, trash at foot.
    drawCounterIsland(ctx, 55, 155, 120, 250, "#e8c9a0", "#00897b");
    drawRotatedScaled(ctx, 115, 200, -90, 0.58, () => drawOven(ctx, 70, 155));
    drawRotatedScaled(ctx, 115, 265, -90, 0.58, () => drawGrill(ctx, 70, 220));
    drawCuttingBoardVertical(ctx, 95, 295);
    drawSinkFacingEast(ctx, 88, 340);
    drawTrash(ctx, 92, 385);

    // —— Right pantry — compact shelf, scaled crates ——
    // Full top surface (island paint only covers the upper half on tall columns)
    ctx.fillStyle = "#5d4037";
    roundRect(ctx, 762, 168, 92, 268, 12, true);
    ctx.fillStyle = "#d7a86e";
    roundRect(ctx, 758, 162, 100, 260, 14, true);
    ctx.fillStyle = "#fff3e0";
    roundRect(ctx, 768, 168, 80, 10, 4, true);
    strokeInk(ctx, 3.5);
    roundRect(ctx, 758, 162, 100, 260, 14, false);

    const pantryScale = 0.68;
    const pantryCx = 808;
    const drawPantry = (
      cy: number,
      paintFn: (ctx: CanvasRenderingContext2D, x: number, y: number) => void,
    ) => {
      drawRotatedScaled(ctx, pantryCx, cy, 0, pantryScale, () =>
        paintFn(ctx, pantryCx - 28, cy - 24),
      );
    };
    drawPantry(195, drawTomatoCrate);
    drawPantry(235, drawMozzarellaBowl);
    drawPantry(275, drawBunCrate);
    drawPantry(315, drawPattyTray);
    drawPantry(355, drawPotatoCrate);
    drawPantry(395, drawDoughCrate);

    // —— Lighthouse pass ——
    drawLighthouse(ctx, 480, 300);

    // —— Bottom service: fryer | plates | short yellow holds+juice ——
    drawCounterIsland(ctx, 230, 375, 270, 52, "#e8c9a0", "#26c6da");
    drawFryer(ctx, 240, 360);
    drawPlateStack(ctx, 385, 370);

    // Yellow counter flush against plates, shorter (holds + juice only)
    drawCounterIsland(ctx, 500, 375, 155, 52, "#fff3e0", "#ffb74d");
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(520, 398, 11, 0, Math.PI * 2);
    ctx.arc(560, 398, 11, 0, Math.PI * 2);
    ctx.fill();
    drawJuiceMachine(ctx, 585, 368);

    strokeInk(ctx, 6);
    roundRect(ctx, 6, 6, MAP_W - 12, MAP_H - 12, 18, false);
  });
}

export const BEACH_5: MapDef = {
  id: "beach-5",
  env: "beach",
  name: "Lighthouse Landing",
  slot: 5,
  unlocked: true,
  matchSeconds: 235,
  customerSpawnMs: [3800, 5800],
  spawn: { x: 480, y: 330 },
  door: { x: 480, y: 50 },
  menu: ["pizza", "salad", "fries_meal", "burger", "juice"],
  plateStock: 7,
  mode: "classic",
  colliders: COLLIDERS,
  appliances: APPLIANCES,
  seats: SEATS,
  bgKey: BG,
  paint,
};
