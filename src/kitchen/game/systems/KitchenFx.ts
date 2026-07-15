import Phaser from "phaser";
import type { Appliance } from "../entities/Appliance";

type Puff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: number;
  kind: "steam" | "smoke" | "spark" | "bubble";
  /** Darker burn smoke uses higher opacity. */
  heavy?: boolean;
};

/**
 * Kitchen VFX — grill/oven smoke only while cooking;
 * slow light steam when cooking, heavy dark smoke when burning.
 */
export class KitchenFx {
  private gfx: Phaser.GameObjects.Graphics;
  private puffs: Puff[] = [];
  private acc = 0;
  private appliances: Appliance[] = [];

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(6);
  }

  bindAppliances(apps: Appliance[]) {
    this.appliances = apps;
  }

  sparkBurst(x: number, y: number, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 80;
      this.puffs.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0,
        max: 0.35 + Math.random() * 0.25,
        r: 2 + Math.random() * 2,
        color: Math.random() > 0.5 ? 0xffee58 : 0xffab00,
        kind: "spark",
      });
    }
  }

  coinBurst(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const sp = 50 + Math.random() * 70;
      this.puffs.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        max: 0.55 + Math.random() * 0.2,
        r: 3,
        color: 0xffd54f,
        kind: "spark",
      });
    }
  }

  update(delta: number) {
    const dt = delta / 1000;
    this.acc += delta;
    // Slower emit cadence so smoke feels gentle
    if (this.acc > 160) {
      this.acc = 0;
      this.emitFromStations();
    }

    for (const p of this.puffs) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "steam" || p.kind === "smoke") {
        // Slow rise + soft drift
        p.vy -= (p.heavy ? 10 : 6) * dt;
        p.vx += Math.sin(p.life * 3) * (p.heavy ? 5 : 3) * dt;
        // Gentle drag
        p.vx *= 1 - 0.4 * dt;
        p.vy *= 1 - 0.15 * dt;
      } else if (p.kind === "bubble") {
        p.vy -= 10 * dt;
        p.vx += Math.sin(p.life * 8) * 4 * dt;
      } else {
        p.vy += 120 * dt;
      }
    }
    this.puffs = this.puffs.filter((p) => p.life < p.max);
    this.draw();
  }

  private emitFromStations() {
    for (const a of this.appliances) {
      if (a.kind === "grill" || a.kind === "grill_panel" || a.kind === "oven" || a.kind === "fryer") {
        const fx = a.cookFx;
        if (fx === "none") continue;

        if (fx === "cooking") {
          // Soft, slow steam — only while cooking
          if (a.kind === "fryer") {
            this.pushBubble(a.x + (Math.random() - 0.5) * 10, a.y - 12);
          }
          this.pushSmoke(
            a.x + (Math.random() - 0.5) * 14,
            a.y - 16,
            false,
          );
        } else {
          // Burning — lots of dark smoke
          const n = a.kind === "fryer" ? 2 : 3;
          for (let i = 0; i < n; i++) {
            this.pushSmoke(
              a.x + (Math.random() - 0.5) * 22,
              a.y - 14 - Math.random() * 8,
              true,
            );
          }
        }
        continue;
      }

      if (a.kind === "sink" && a.held) {
        this.pushBubble(a.x + (Math.random() - 0.5) * 10, a.y - 10);
      } else if (a.kind === "prep" && a.isBusy) {
        this.puffs.push({
          x: a.x,
          y: a.y - 16,
          vx: (Math.random() - 0.5) * 20,
          vy: -20,
          life: 0,
          max: 0.25,
          r: 2,
          color: 0xc5e1a5,
          kind: "spark",
        });
      }
    }
  }

  private pushSmoke(x: number, y: number, heavy: boolean) {
    this.puffs.push({
      x,
      y,
      vx: (Math.random() - 0.5) * (heavy ? 10 : 4),
      vy: heavy ? -12 - Math.random() * 8 : -8 - Math.random() * 4,
      life: 0,
      max: heavy ? 1.8 + Math.random() * 0.8 : 1.4 + Math.random() * 0.6,
      r: heavy ? 7 + Math.random() * 6 : 4 + Math.random() * 3,
      color: heavy
        ? Math.random() > 0.4
          ? 0x37474f
          : 0x212121
        : Math.random() > 0.5
          ? 0xeceff1
          : 0xffffff,
      kind: "smoke",
      heavy,
    });
  }

  private pushBubble(x: number, y: number) {
    this.puffs.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 6,
      vy: -8 - Math.random() * 4,
      life: 0,
      max: 0.8 + Math.random() * 0.4,
      r: 2 + Math.random() * 2,
      color: 0xffecb3,
      kind: "bubble",
    });
  }

  private draw() {
    this.gfx.clear();
    for (const p of this.puffs) {
      const t = 1 - p.life / p.max;
      const base = p.heavy ? 0.55 : p.kind === "smoke" ? 0.28 : 0.5;
      const alpha = Math.max(0, t * base);
      this.gfx.fillStyle(p.color, alpha);
      if (p.kind === "bubble") {
        this.gfx.lineStyle(1.5, p.color, alpha);
        this.gfx.strokeCircle(p.x, p.y, p.r * (0.6 + t * 0.6));
      } else {
        this.gfx.fillCircle(p.x, p.y, p.r * (0.55 + t * 0.7));
      }
    }
  }

  destroy() {
    this.gfx.destroy();
    this.puffs = [];
  }
}
