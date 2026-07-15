import Phaser from "phaser";
import { ITEMS } from "../items/types";
import type { CustomerSeat, DoorPoint } from "./Customer";
import type { BuffetTray } from "./BuffetTray";

export type BuffetPhase =
  | "entering"
  | "needPlate"
  | "buffet"
  | "eating"
  | "wantJuice"
  | "leaving";

const GROUP_SIZES = [5, 6, 7] as const;
const EAT_MS = 8000;
const JUICE_WAIT_MS = 9000;
const EMPTY_WAIT_MS = 2500;
const BUFFET_BASE_POINTS = 110;

export class BuffetCustomer {
  readonly seat: CustomerSeat;
  phase: BuffetPhase = "entering";
  alive = true;
  satisfaction = 1;
  hasPlate = false;
  foodsTaken = 0;
  wantsJuice = false;
  juiceServed = false;
  private root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Text;
  private mood: Phaser.GameObjects.Text;
  private door: DoorPoint;
  private eatTimer = 0;
  private juiceTimer = 0;
  private emptyWait = 0;
  private trayIndex = 0;
  private leaveTween?: Phaser.Tweens.Tween;
  private enterTween?: Phaser.Tweens.Tween;
  private dirtySpawned = false;

  constructor(
    scene: Phaser.Scene,
    seat: CustomerSeat,
    door: DoorPoint,
  ) {
    this.seat = seat;
    this.door = door;

    const shadow = scene.textures.exists("shadow")
      ? scene.add.image(0, 6, "shadow").setAlpha(0.4).setScale(1.5)
      : scene.add.ellipse(0, 6, 26, 10, 0x000000, 0.25);

    this.body = scene.add
      .image(0, 0, "customer")
      .setOrigin(0.5, 0.85)
      .setScale(1.25);

    this.bubble = scene.add
      .text(0, -72, "Plate!", {
        fontFamily: "Sora, sans-serif",
        fontSize: "11px",
        color: "#bf360c",
        backgroundColor: "#fffde7",
        padding: { x: 5, y: 3 },
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.mood = scene.add
      .text(0, -94, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "10px",
        color: "#546e7a",
        stroke: "#ffffff",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.root = scene.add.container(door.x, door.y, [
      shadow,
      this.body,
      this.mood,
      this.bubble,
    ]);
    this.root.setDepth(7);
    this.root.setAlpha(0);

    scene.tweens.add({ targets: this.root, alpha: 1, duration: 200 });
    this.enterTween = scene.tweens.add({
      targets: this.root,
      x: seat.x,
      y: seat.y,
      duration: 900 + Math.random() * 400,
      ease: "Sine.out",
      onComplete: () => {
        this.phase = "needPlate";
        this.bubble.setText("Plate!").setVisible(true);
      },
    });
  }

  get x() {
    return this.root.x;
  }

  get y() {
    return this.root.y;
  }

  get isSeated() {
    return this.phase !== "entering" && this.phase !== "leaving";
  }

  givePlate(): boolean {
    if (this.phase !== "needPlate" || this.hasPlate) return false;
    this.hasPlate = true;
    this.phase = "buffet";
    this.trayIndex = 0;
    this.bubble.setText("Buffet…").setVisible(true);
    return true;
  }

  serveJuice(): boolean {
    if (this.phase !== "wantJuice") return false;
    this.juiceServed = true;
    this.phase = "eating";
    this.bubble.setText("Nom…").setVisible(true);
    return true;
  }

  update(
    delta: number,
    trays: BuffetTray[],
    scene: Phaser.Scene,
  ): "happy" | "walkout" | "dirty" | null {
    if (!this.alive) return null;

    if (this.phase === "needPlate") {
      this.satisfaction -= delta / 45000;
      this.mood.setText(this.satisfaction < 0.4 ? "…" : "");
      if (this.satisfaction <= 0) return this.walkout();
      return null;
    }

    if (this.phase === "buffet") {
      this.emptyWait -= delta;
      if (this.emptyWait > 0) {
        this.satisfaction -= delta / 28000;
        if (this.satisfaction <= 0) return this.walkout();
        return null;
      }

      // Walk along trays and take one from each stocked tray
      while (this.trayIndex < trays.length) {
        const tray = trays[this.trayIndex]!;
        this.trayIndex += 1;
        if (tray.isEmpty) {
          this.emptyWait = EMPTY_WAIT_MS;
          this.bubble.setText(`Wait ${tray.def.label}`).setVisible(true);
          this.satisfaction -= 0.04;
          return null;
        }
        if (tray.takeServing()) {
          this.foodsTaken += 1;
          this.root.x = tray.x + (Math.random() - 0.5) * 20;
          this.root.y = tray.y + 40;
        }
      }

      if (this.foodsTaken <= 0) return this.walkout();

      // Return to seat to eat
      this.phase = "eating";
      this.eatTimer = EAT_MS;
      this.wantsJuice = Math.random() < 0.3;
      this.bubble.setText("Eating…").setVisible(true);
      scene.tweens.add({
        targets: this.root,
        x: this.seat.x,
        y: this.seat.y,
        duration: 700,
        ease: "Sine.out",
      });
      return null;
    }

    if (this.phase === "eating") {
      this.eatTimer -= delta;
      if (this.wantsJuice && !this.juiceServed && this.eatTimer < EAT_MS * 0.55) {
        this.phase = "wantJuice";
        this.juiceTimer = JUICE_WAIT_MS;
        this.bubble.setText("Juice!").setVisible(true);
        if (scene.textures.exists(ITEMS.juice.texture)) {
          /* bubble text is enough */
        }
        return null;
      }
      if (this.eatTimer <= 0) return this.finishHappy(scene);
      return null;
    }

    if (this.phase === "wantJuice") {
      this.juiceTimer -= delta;
      this.satisfaction -= delta / 22000;
      if (this.juiceTimer <= 0 || this.satisfaction <= 0) {
        // Missed juice — finish with lower satisfaction
        this.satisfaction = Math.max(0.25, this.satisfaction - 0.2);
        return this.finishHappy(scene);
      }
      return null;
    }

    return null;
  }

  private finishHappy(scene: Phaser.Scene): "happy" | "dirty" {
    this.phase = "leaving";
    this.bubble.setVisible(false);
    const seat = this.seat;
    this.leaveTween = scene.tweens.add({
      targets: this.root,
      x: this.door.x,
      y: this.door.y,
      alpha: 0.2,
      duration: 900,
      onComplete: () => this.destroy(),
    });
    if (!this.dirtySpawned) {
      this.dirtySpawned = true;
      // Signal scene to spawn dirty plate at seat
      void seat;
      return "dirty";
    }
    return "happy";
  }

  private walkout(): "walkout" {
    this.phase = "leaving";
    this.bubble.setText("Bye!").setVisible(true);
    this.alive = false;
    this.root.destroy(true);
    return "walkout";
  }

  /** Points for a happy finish. */
  scorePoints(): { points: number; tip: number; stars: 1 | 2 | 3 } {
    const ratio = Math.max(0, Math.min(1, this.satisfaction));
    const stars: 1 | 2 | 3 = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
    const juiceBonus = this.juiceServed ? 20 : 0;
    const foodBonus = this.foodsTaken * 8;
    const points = Math.round((BUFFET_BASE_POINTS + foodBonus + juiceBonus) * (0.7 + ratio * 0.5));
    const tip = Math.round(points * 0.12 * stars);
    return { points, tip, stars };
  }

  destroy() {
    this.alive = false;
    this.leaveTween?.stop();
    this.enterTween?.stop();
    this.root.destroy(true);
  }
}

export class BuffetCustomerManager {
  private scene: Phaser.Scene;
  private seats: CustomerSeat[];
  private door: DoorPoint;
  private active: BuffetCustomer[] = [];
  private wave = 0;
  private spawning = true;
  private groupPending = false;
  private waveCooldown = 0;
  private firstSpawned = false;

  constructor(scene: Phaser.Scene, seats: CustomerSeat[], door: DoorPoint) {
    this.scene = scene;
    this.seats = seats;
    this.door = door;
  }

  setSpawning(on: boolean) {
    this.spawning = on;
  }

  get waveIndex() {
    return this.wave;
  }

  get activeCount() {
    return this.active.filter((c) => c.alive).length;
  }

  /** Kick first group immediately. */
  spawnFirstGroup() {
    if (this.firstSpawned) return;
    this.firstSpawned = true;
    this.spawnGroup();
  }

  private groupSize(): number {
    return GROUP_SIZES[this.wave % GROUP_SIZES.length]!;
  }

  private spawnGroup() {
    if (!this.spawning) return;
    const size = Math.min(this.groupSize(), this.seats.length);
    const free = [...this.seats];
    Phaser.Utils.Array.Shuffle(free);
    for (let i = 0; i < size; i++) {
      const seat = free[i];
      if (!seat) break;
      // Stagger entry slightly
      this.scene.time.delayedCall(i * 350, () => {
        if (!this.spawning) return;
        this.active.push(new BuffetCustomer(this.scene, seat, this.door));
      });
    }
    this.wave += 1;
    this.groupPending = false;
  }

  nearestNeedPlate(px: number, py: number, range: number): BuffetCustomer | null {
    let best: BuffetCustomer | null = null;
    let bestD = range;
    for (const c of this.active) {
      if (!c.alive || c.phase !== "needPlate") continue;
      const d = Phaser.Math.Distance.Between(px, py, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  nearestWantJuice(px: number, py: number, range: number): BuffetCustomer | null {
    let best: BuffetCustomer | null = null;
    let bestD = range;
    for (const c of this.active) {
      if (!c.alive || c.phase !== "wantJuice") continue;
      const d = Phaser.Math.Distance.Between(px, py, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  update(
    delta: number,
    trays: BuffetTray[],
  ): {
    walkouts: number;
    finished: { customer: BuffetCustomer; dirtySeat: CustomerSeat }[];
  } {
    let walkouts = 0;
    const finished: { customer: BuffetCustomer; dirtySeat: CustomerSeat }[] = [];

    for (const c of this.active) {
      if (!c.alive) continue;
      const r = c.update(delta, trays, this.scene);
      if (r === "walkout") walkouts += 1;
      if (r === "dirty" || r === "happy") {
        if (r === "dirty") finished.push({ customer: c, dirtySeat: c.seat });
        // Apply score in scene via finished callback for dirty; happy without dirty already scored?
        // finishHappy returns dirty first then destroys — scene scores on dirty event
      }
    }

    this.active = this.active.filter((c) => c.alive);

    // Next wave when group cleared
    if (this.spawning && this.firstSpawned && this.active.length === 0 && !this.groupPending) {
      this.groupPending = true;
      this.waveCooldown = 2800;
    }
    if (this.groupPending) {
      this.waveCooldown -= delta;
      if (this.waveCooldown <= 0) this.spawnGroup();
    }

    return { walkouts, finished };
  }

  destroy() {
    for (const c of this.active) c.destroy();
    this.active = [];
  }
}
