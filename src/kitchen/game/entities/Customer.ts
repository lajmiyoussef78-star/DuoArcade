import Phaser from "phaser";
import { ITEMS, type ItemId } from "../items/types";
import { randomRecipe, recipeByDish, type Recipe } from "../items/recipes";

export type CustomerSeat = { id: number; x: number; y: number };
export type DoorPoint = { x: number; y: number };

export const CUSTOMER_SEATS: CustomerSeat[] = [
  { id: 0, x: 360, y: 300 },
  { id: 1, x: 520, y: 300 },
  { id: 2, x: 360, y: 380 },
  { id: 3, x: 520, y: 380 },
];

export type ServeResult =
  | { ok: true; points: number; tip: number; stars: 1 | 2 | 3; vip: boolean; dish: ItemId }
  | { ok: false; reason: "wrong" | "leaving" | "no_order" };

/** entering = walking from door; waiting = seated ready for order; ordered = cooking timer */
export type CustomerPhase = "entering" | "waiting" | "ordered";

export class Customer {
  readonly seat: CustomerSeat;
  readonly order: Recipe;
  readonly vip: boolean;
  patience: number;
  readonly maxPatience: number;
  phase: CustomerPhase = "entering";
  alive = true;
  private root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private bubble: Phaser.GameObjects.Container;
  private bubbleBg: Phaser.GameObjects.Graphics;
  private ringGfx: Phaser.GameObjects.Graphics;
  private orderIcon: Phaser.GameObjects.Image;
  private callText: Phaser.GameObjects.Text;
  private mood: Phaser.GameObjects.Text;
  private leaving = false;
  private leaveTween?: Phaser.Tweens.Tween;
  private enterTween?: Phaser.Tweens.Tween;
  private tapAcc = 0;
  private door: DoorPoint;
  private walkBob?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    seat: CustomerSeat,
    order: Recipe,
    vip: boolean,
    door: DoorPoint,
    patienceScale = 1,
  ) {
    this.seat = seat;
    this.order = order;
    this.vip = vip;
    this.door = door;
    const patienceMult = vip ? 1.15 : 1;
    this.maxPatience =
      order.patience * patienceMult * patienceScale * (0.9 + Math.random() * 0.25);
    this.patience = this.maxPatience;

    this.shadow = scene.textures.exists("shadow")
      ? scene.add.image(0, 6, "shadow").setAlpha(0.45).setScale(1.6)
      : scene.add.ellipse(0, 6, 28, 10, 0x000000, 0.28);

    this.body = scene.add
      .image(0, 0, vip && scene.textures.exists("customer_vip") ? "customer_vip" : "customer")
      .setOrigin(0.5, 0.85)
      .setScale(1.3);

    this.bubbleBg = scene.add.graphics();
    this.ringGfx = scene.add.graphics();
    this.orderIcon = scene.add
      .image(12, -70, ITEMS[order.id].texture)
      .setScale(1.45)
      .setVisible(false);
    this.callText = scene.add
      .text(0, -70, "!", {
        fontFamily: "Sora, sans-serif",
        fontSize: "26px",
        color: "#c62828",
        fontStyle: "bold",
        stroke: "#ffffff",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.bubble = scene.add.container(0, 0, [
      this.bubbleBg,
      this.ringGfx,
      this.orderIcon,
      this.callText,
    ]);
    this.bubble.setVisible(false);
    this.redrawBubble();

    this.mood = scene.add
      .text(0, -110, "…", {
        fontFamily: "Sora, sans-serif",
        fontSize: "11px",
        color: "#546e7a",
        fontStyle: "bold",
        stroke: "#ffffff",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Spawn at the door, then walk to the table
    this.root = scene.add.container(door.x, door.y, [
      this.shadow,
      this.body,
      this.mood,
      this.bubble,
    ]);
    this.root.setDepth(7);
    this.root.setAlpha(0);

    scene.tweens.add({
      targets: this.root,
      alpha: 1,
      duration: 220,
    });

    const dist = Phaser.Math.Distance.Between(door.x, door.y, seat.x, seat.y);
    const walkMs = Phaser.Math.Clamp(dist * 7.5, 900, 2200);

    // Facing toward seat
    this.body.setFlipX(seat.x < door.x);

    this.walkBob = scene.tweens.add({
      targets: this.body,
      y: -3,
      duration: 160,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    this.enterTween = scene.tweens.add({
      targets: this.root,
      x: seat.x,
      y: seat.y,
      duration: walkMs,
      ease: "Sine.inOut",
      onComplete: () => this.arriveAtSeat(),
    });
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  get isSeated(): boolean {
    return this.phase === "waiting" || this.phase === "ordered";
  }

  private arriveAtSeat() {
    if (!this.alive || this.leaving) return;
    this.walkBob?.stop();
    this.body.y = 0;
    this.body.setFlipX(false);
    this.phase = "waiting";
    this.bubble.setVisible(true);
    this.mood.setText(this.vip ? "VIP ✦" : "😊");
    this.redrawBubble();
    // Settle bob
    this.root.scene.tweens.add({
      targets: this.body,
      y: -1.5,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    // Soft sit bounce
    this.root.scene.tweens.add({
      targets: this.root,
      scaleY: 0.92,
      duration: 100,
      yoyo: true,
    });
  }

  private redrawBubble() {
    this.bubbleBg.clear();
    const bw = 68;
    const bh = 52;
    this.bubbleBg.fillStyle(0xffffff, 0.98);
    this.bubbleBg.fillRoundedRect(-bw / 2, -98, bw, bh, 16);
    this.bubbleBg.lineStyle(4, 0x2b1d14, 1);
    this.bubbleBg.strokeRoundedRect(-bw / 2, -98, bw, bh, 16);
    this.bubbleBg.fillStyle(0xffffff, 0.98);
    this.bubbleBg.fillTriangle(-6, -46, 6, -46, 0, -36);
    this.bubbleBg.lineStyle(4, 0x2b1d14, 1);
    this.bubbleBg.lineBetween(-6, -46, 0, -36);
    this.bubbleBg.lineBetween(6, -46, 0, -36);

    if (this.phase === "waiting") {
      this.callText.setVisible(true);
      this.orderIcon.setVisible(false);
      this.ringGfx.clear();
    } else if (this.phase === "ordered") {
      this.callText.setVisible(false);
      this.orderIcon.setVisible(true);
      this.drawRing();
    } else {
      this.callText.setVisible(false);
      this.orderIcon.setVisible(false);
      this.ringGfx.clear();
    }
  }

  private urgencyColor(): number {
    const t = Phaser.Math.Clamp(this.patience / this.maxPatience, 0, 1);
    if (t > 0.5) return 0x66bb6a;
    if (t > 0.25) return 0xffc107;
    return 0xe53935;
  }

  private drawRing() {
    const t = Phaser.Math.Clamp(this.patience / this.maxPatience, 0, 1);
    const color = this.urgencyColor();
    this.ringGfx.clear();
    this.ringGfx.lineStyle(5, 0xeceff1, 1);
    this.ringGfx.beginPath();
    this.ringGfx.arc(-14, -72, 14, 0, Math.PI * 2);
    this.ringGfx.strokePath();
    this.ringGfx.lineStyle(5, color, 1);
    this.ringGfx.beginPath();
    this.ringGfx.arc(-14, -72, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t, false);
    this.ringGfx.strokePath();
  }

  takeOrder(): boolean {
    if (this.leaving || !this.alive || this.phase !== "waiting") return false;
    this.phase = "ordered";
    this.patience = this.maxPatience;
    this.mood.setText(this.vip ? "VIP ✦" : "🙂");
    this.redrawBubble();
    this.root.scene.tweens.add({
      targets: this.bubble,
      scale: 1.12,
      duration: 160,
      yoyo: true,
    });
    return true;
  }

  update(delta: number): "ok" | "walkout" {
    if (this.leaving || !this.alive) return "ok";
    if (this.phase === "entering") return "ok";

    this.tapAcc += delta;
    if (this.tapAcc > (this.phase === "waiting" ? 900 : 700)) {
      this.tapAcc = 0;
      const amp = this.phase === "ordered" && this.patience / this.maxPatience < 0.35 ? 3.5 : 2;
      this.root.scene.tweens.add({
        targets: this.body,
        x: amp,
        duration: 60,
        yoyo: true,
        repeat: 1,
      });
    }

    if (this.phase === "ordered") {
      this.patience -= delta / 1000;
      this.drawRing();
      const t = this.patience / this.maxPatience;
      if (t < 0.25) this.mood.setText("😠");
      else if (t < 0.5) this.mood.setText("😐");
      else this.mood.setText(this.vip ? "VIP ✦" : "🙂");

      if (t < 0.3) {
        const s = 1 + Math.sin(this.root.scene.time.now / 140) * 0.06;
        this.bubble.setScale(s);
      } else {
        this.bubble.setScale(1);
      }

      if (this.patience <= 0) {
        this.startLeave(false);
        return "walkout";
      }
    } else if (this.phase === "waiting") {
      this.callText.setScale(1 + Math.sin(this.root.scene.time.now / 200) * 0.1);
    }
    return "ok";
  }

  tryServe(dishId: ItemId): ServeResult {
    if (this.leaving || !this.alive) return { ok: false, reason: "leaving" };
    if (this.phase !== "ordered") return { ok: false, reason: "no_order" };
    const recipe = recipeByDish(dishId);
    if (!recipe || recipe.id !== this.order.id) {
      return { ok: false, reason: "wrong" };
    }
    const ratio = this.patience / this.maxPatience;
    const stars: 1 | 2 | 3 = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
    const tip = Math.floor(recipe.basePoints * 0.15 * stars * (this.vip ? 1.5 : 1));
    const points = recipe.basePoints + tip;
    this.startLeave(true);
    return { ok: true, points, tip, stars, vip: this.vip, dish: dishId };
  }

  private startLeave(happy: boolean) {
    if (this.leaving) return;
    this.leaving = true;
    this.enterTween?.stop();
    this.walkBob?.stop();
    this.bubble.setVisible(false);
    this.mood.setText(happy ? "😍 ♥" : "💢");
    this.body.setFlipX(this.door.x < this.root.x);

    const dist = Phaser.Math.Distance.Between(this.root.x, this.root.y, this.door.x, this.door.y);
    const walkMs = Phaser.Math.Clamp(dist * 6, 600, 1600);

    this.leaveTween = this.root.scene.tweens.add({
      targets: this.root,
      x: this.door.x,
      y: this.door.y,
      duration: walkMs,
      ease: "Sine.inOut",
      onComplete: () => {
        this.root.scene.tweens.add({
          targets: this.root,
          alpha: 0,
          duration: 220,
          onComplete: () => this.destroy(),
        });
      },
    });
  }

  destroy() {
    this.alive = false;
    this.leaveTween?.stop();
    this.enterTween?.stop();
    this.walkBob?.stop();
    this.root.destroy(true);
  }
}

export class CustomerManager {
  private scene: Phaser.Scene;
  private active: Customer[] = [];
  private spawnCd = 800;
  private spawning = true;
  private seats: CustomerSeat[];
  private spawnRange: [number, number];
  private door: DoorPoint;
  private menu: ItemId[];
  private spawnedTotal = 0;

  constructor(
    scene: Phaser.Scene,
    seats: CustomerSeat[] = CUSTOMER_SEATS,
    spawnRange: [number, number] = [3500, 6000],
    door: DoorPoint = { x: 480, y: 500 },
    menu: ItemId[] = ["burger", "salad", "fries_meal"],
  ) {
    this.scene = scene;
    this.seats = seats;
    this.spawnRange = spawnRange;
    this.door = door;
    this.menu = menu;
  }

  setSpawning(on: boolean) {
    this.spawning = on;
  }

  /** 0 = first seating tour; 1+ = later tours (need plate washing). */
  get tourIndex(): number {
    return Math.floor(this.spawnedTotal / Math.max(1, this.seats.length));
  }

  trySpawn() {
    if (!this.spawning) return;
    // One-by-one: wait until the previous guest has sat down
    if (this.active.some((c) => c.alive && c.phase === "entering")) return;
    const taken = new Set(this.active.filter((c) => c.alive).map((c) => c.seat.id));
    const free = this.seats.filter((s) => !taken.has(s.id));
    if (free.length === 0) return;
    const seat = Phaser.Utils.Array.GetRandom(free);
    const order = randomRecipe(this.menu);
    const vip = Math.random() < 0.12;
    // Second tour+: extra patience for wash dirty plate → return → re-serve
    const tour = Math.floor(this.spawnedTotal / Math.max(1, this.seats.length));
    const patienceScale = tour === 0 ? 1 : 1.55;
    this.active.push(
      new Customer(this.scene, seat, order, vip, this.door, patienceScale),
    );
    this.spawnedTotal += 1;
  }

  update(delta: number): { walkouts: number } {
    this.spawnCd -= delta;
    if (this.spawnCd <= 0) {
      this.trySpawn();
      const [lo, hi] = this.spawnRange;
      this.spawnCd = lo + Math.random() * (hi - lo);
    }
    let walkouts = 0;
    for (const c of this.active) {
      if (!c.alive) continue;
      if (c.update(delta) === "walkout") walkouts++;
    }
    this.active = this.active.filter((c) => c.alive);
    return { walkouts };
  }

  nearest(px: number, py: number, range: number): Customer | null {
    let best: Customer | null = null;
    let bestD = range;
    for (const c of this.active) {
      if (!c.alive || !c.isSeated) continue;
      const d = Phaser.Math.Distance.Between(px, py, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  nearestServable(px: number, py: number, range: number): Customer | null {
    return this.nearest(px, py, range);
  }

  notifyBurn() {
    /* reserved */
  }

  destroy() {
    for (const c of this.active) c.destroy();
    this.active = [];
  }
}
