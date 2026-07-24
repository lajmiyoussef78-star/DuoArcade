import { INK, roundRect, strokeInk } from "./paintShared";

/** Shared buffet décor painters used by buffet-2…5. */

export function drawBuffetTraySlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = "#37474f";
  roundRect(ctx, x - 28, y - 18, 56, 36, 6, true);
  ctx.fillStyle = "#263238";
  roundRect(ctx, x - 24, y - 14, 48, 28, 4, true);
  strokeInk(ctx, 2);
  roundRect(ctx, x - 28, y - 18, 56, 36, 6, false);
}

export function drawFlourBowl(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 36, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5d4037";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 22, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 18, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe0b2";
  ctx.beginPath();
  ctx.ellipse(x + 18, y + 16, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeInk(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 22, 22, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawPepperCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6d4c41";
  roundRect(ctx, x, y + 16, 50, 28, 5, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 2, y + 18, 46, 24, 4, true);
  for (const [px, py, col] of [
    [16, 28, "#43a047"],
    [30, 26, "#e53935"],
    [22, 34, "#fdd835"],
    [34, 34, "#43a047"],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x + px, y + py, 8, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 16, 50, 28, 5, false);
}

export function drawChickenCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#5d4037";
  roundRect(ctx, x, y + 14, 52, 30, 5, true);
  ctx.fillStyle = "#8d6e63";
  roundRect(ctx, x + 2, y + 16, 48, 26, 4, true);
  ctx.fillStyle = "#ffcc80";
  for (const [cx, cy] of [
    [16, 28],
    [30, 26],
    [22, 36],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + cx, y + cy, 9, 6, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  roundRect(ctx, x, y + 14, 52, 30, 5, false);
}

export function drawShrimpBowl(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#1565c0";
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 28, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8a65";
  for (const [sx, sy] of [
    [14, 24],
    [24, 22],
    [30, 28],
    [18, 30],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x + sx, y + sy, 6, 3.5, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  strokeInk(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(x + 22, y + 28, 20, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawPlaceSetting(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#fafafa";
  roundRect(ctx, x - 12, y - 8, 24, 16, 3, true);
  ctx.fillStyle = "#e53935";
  ctx.beginPath();
  ctx.arc(x, y + 18, 7, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBanner(
  ctx: CanvasRenderingContext2D,
  text: string,
  accent: string,
  sub = "",
) {
  ctx.fillStyle = INK;
  roundRect(ctx, 240, 4, 480, sub ? 36 : 30, 8, true);
  ctx.fillStyle = accent;
  roundRect(ctx, 244, 7, 472, sub ? 30 : 24, 6, true);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px Sora, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 480, sub ? 22 : 24);
  if (sub) {
    ctx.font = "bold 8px Sora, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(sub, 480, 33);
  }
}
