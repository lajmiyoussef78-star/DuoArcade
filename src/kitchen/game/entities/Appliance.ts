import Phaser from "phaser";
import { ItemEntity } from "../items/ItemEntity";
import {
  burnResult,
  canAddToPlate,
  canChop,
  canWash,
  cookResult,
  flourResult,
  isTomatoTopping,
  type CookKind,
} from "../items/recipes";
import {
  BURN_MS,
  CHOP_MS,
  COOK_MS,
  ITEMS,
  PIZZA_BURN_MS,
  PIZZA_COOK_MS,
  WASH_MS,
  type ApplianceDef,
  type ApplianceKind,
} from "../items/types";

type ProcessKind = "cook" | "chop" | "wash";

type ProcessState = {
  kind: ProcessKind;
  elapsed: number;
  duration: number;
  burnDuration?: number;
  phase: "active" | "ready" | "burning";
};

const PASS_OFFSETS = [
  { x: -18, y: -8 },
  { x: 0, y: -14 },
  { x: 18, y: -8 },
] as const;

export class Appliance {
  readonly def: ApplianceDef;
  readonly x: number;
  readonly y: number;
  /** Stack of parked items (pass holds up to 3; most stations hold 1). */
  private items: ItemEntity[] = [];
  private process: ProcessState | null = null;
  private barBg: Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private statusText: Phaser.GameObjects.Text;
  private slotHint: Phaser.GameObjects.Text | null = null;
  /** Finite clean plates on the stack (plates station only). */
  private _plateStock = 0;
  private plateStockLabel: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, def: ApplianceDef) {
    this.def = def;
    this.x = def.x;
    this.y = def.y;

    this.barBg = scene.add
      .rectangle(this.x, this.y - 28, 28, 5, 0x2b1d14, 0.85)
      .setDepth(15)
      .setVisible(false);
    this.barFill = scene.add
      .rectangle(this.x - 14, this.y - 28, 0, 5, 0xffc107)
      .setOrigin(0, 0.5)
      .setDepth(16)
      .setVisible(false);
    this.statusText = scene.add
      .text(this.x, this.y - 38, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "9px",
        color: "#bf360c",
      })
      .setOrigin(0.5)
      .setDepth(16)
      .setVisible(false);

    if (this.kind === "pass") {
      this.slotHint = scene.add
        .text(this.x, this.y + 20, "0/3", {
          fontFamily: "Sora, sans-serif",
          fontSize: "9px",
          color: "#e65100",
          backgroundColor: "#fff3e0cc",
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(8);
    }
  }

  get kind(): ApplianceKind {
    return this.def.kind;
  }

  /** Top item on this station (most recently placed). */
  get held(): ItemEntity | null {
    return this.items.length > 0 ? this.items[this.items.length - 1]! : null;
  }

  get capacity(): number {
    return this.kind === "pass" || this.kind === "counter" ? 3 : 1;
  }

  get isDispenser(): boolean {
    return (
      this.kind === "pantry" ||
      this.kind === "plates" ||
      this.kind === "juice" ||
      this.kind === "icecream"
    );
  }

  get isBusy(): boolean {
    return this.process?.phase === "active" || this.process?.phase === "burning";
  }

  get plateStock(): number {
    return this._plateStock;
  }

  setPlateStock(n: number, label?: Phaser.GameObjects.Text) {
    this._plateStock = Math.max(0, n);
    if (label) this.plateStockLabel = label;
    this.refreshPlateStockLabel();
  }

  restockPlate(): boolean {
    if (this.kind !== "plates") return false;
    this._plateStock += 1;
    this.refreshPlateStockLabel();
    return true;
  }

  private consumePlateStock(): boolean {
    if (this.kind !== "plates") return true;
    if (this._plateStock <= 0) return false;
    this._plateStock -= 1;
    this.refreshPlateStockLabel();
    return true;
  }

  private refreshPlateStockLabel() {
    if (this.plateStockLabel) {
      this.plateStockLabel.setText(`Plates ${this._plateStock}`);
      this.plateStockLabel.setColor(this._plateStock <= 0 ? "#b71c1c" : "#0d47a1");
    }
  }

  /** VFX state for grill/oven/fryer smoke. */
  get cookFx(): "none" | "cooking" | "burning" {
    if (
      this.kind !== "grill" &&
      this.kind !== "grill_panel" &&
      this.kind !== "oven" &&
      this.kind !== "fryer"
    ) {
      return "none";
    }
    if (this.process?.phase === "burning") return "burning";
    if (this.process?.phase === "active" && this.process.kind === "cook") return "cooking";
    const top = this.held;
    if (top && top.id.includes("burned")) return "burning";
    return "none";
  }

  private isCookStation(): boolean {
    return (
      this.kind === "grill" ||
      this.kind === "grill_panel" ||
      this.kind === "oven" ||
      this.kind === "fryer"
    );
  }

  canAccept(item: ItemEntity): boolean {
    if (this.isDispenser) return false;
    if (this.kind === "trash") return true;

    const top = this.held;
    // Tomato onto pizza dough → raw pizza (either order)
    if (top?.id === "pizza_dough" && isTomatoTopping(item.id)) return true;
    if (top && isTomatoTopping(top.id) && item.id === "pizza_dough") return true;

    // Add ingredients onto a plate sitting on this station
    if (top?.isPlate && !item.isPlate && !item.isDish) {
      return canAddToPlate(top.contents, item.id);
    }
    // Chopped veg onto an empty grill pan on this station
    if (top?.isGrillPan && top.contents.length === 0) {
      return item.id === "tomato_chopped" || item.id === "pepper_chopped";
    }

    if (this.items.length >= this.capacity) return false;

    if (this.kind === "grill") return item.id === "patty_raw";
    if (this.kind === "grill_panel") {
      // Removable pans only — cook happens on the pan's contents
      return item.isGrillPan;
    }
    if (this.kind === "oven") return item.id === "pizza_raw";
    if (this.kind === "fryer") {
      return (
        item.id === "potato" ||
        item.id === "potato_washed" ||
        item.id === "fries_raw" ||
        item.id === "chicken_floured" ||
        item.id === "shrimp_floured"
      );
    }
    if (this.kind === "flour") return flourResult(item.id) !== null;
    if (this.kind === "sink") return canWash(item.id) !== null;
    if (this.kind === "prep") {
      return (
        canChop(item.id) !== null ||
        item.isPlate ||
        item.isGrillPan ||
        item.isDish ||
        item.id === "pizza_dough" ||
        item.id === "pizza_raw"
      );
    }
    if (this.kind === "pass" || this.kind === "counter") return true;
    return false;
  }

  /** True when holding an ingredient that can go onto a fresh plate here. */
  canPlateIngredient(hands: ItemEntity | null): boolean {
    if (this.kind !== "plates" || !hands) return false;
    if (hands.isPlate || hands.isDish) return false;
    if (this._plateStock <= 0) return false;
    return canAddToPlate([], hands.id);
  }

  /** Holding empty plate — can lift cooked pizza from oven. */
  canPlatePizza(hands: ItemEntity | null): boolean {
    if (this.kind !== "oven" || !hands?.isPlate) return false;
    if (hands.contents.length > 0) return false;
    return this.held?.id === "pizza_cooked";
  }

  promptFor(hands: ItemEntity | null): string | null {
    if (this.kind === "trash") {
      if (!hands) return "Trash · throw burned food here";
      const burned = hands.id.includes("burned");
      return burned
        ? `E · Throw away ${hands.label}`
        : `E · Trash ${hands.label}`;
    }

    if (this.kind === "plates") {
      if (hands?.id === "plate" && hands.contents.length === 0) {
        return "E · Return plate to stack";
      }
      if (this.canPlateIngredient(hands)) {
        return `E · Put ${hands!.label} on a plate`;
      }
      if (hands) return null;
      if (this._plateStock <= 0) return "No plates · wash dirty ones";
      return `E · Take Plate (${this._plateStock})`;
    }

    if (this.kind === "flour") {
      if (hands && flourResult(hands.id)) {
        return `E · Dip ${hands.label} in flour`;
      }
      if (!hands && this.held && flourResult(this.held.id)) {
        return `E · Flour ${this.held.label}`;
      }
      if (hands && this.canAccept(hands)) return `E · Place ${hands.label}`;
      if (!hands && this.held) return `E · Take ${this.held.label}`;
      return "Flour dip · chicken or cut shrimp";
    }

    if (this.kind === "grill_panel") {
      if (hands?.isGrillPan) {
        return this.items.length >= this.capacity
          ? "Slot full"
          : `E · Put pan on grill`;
      }
      if (hands && this.held?.isGrillPan && this.held.contents.length === 0) {
        if (hands.id === "tomato_chopped" || hands.id === "pepper_chopped") {
          return `E · Put ${hands.label} on pan`;
        }
      }
      if (!hands && this.held?.isGrillPan) {
        if (this.process?.phase === "active") {
          const pct = Math.floor((this.process.elapsed / this.process.duration) * 100);
          return `Grilling… ${pct}%`;
        }
        if (this.process?.phase === "burning") return "Burning! Take pan → trash food";
        return `E · Take ${this.held.label}`;
      }
      if (!hands) return "Grill slot · place a pan here";
      return "Need a grill pan";
    }

    if (this.isDispenser) {
      if (hands) return null;
      const id = this.def.dispenses;
      return id ? `E · Take ${ITEMS[id].label}` : null;
    }

    if (this.canPlatePizza(hands)) {
      return "E · Plate cooked pizza";
    }

    if (this.kind === "oven" && this.held?.id === "pizza_cooked" && !hands) {
      return "Need empty plate to take pizza";
    }
    if (this.kind === "oven" && this.held?.id === "pizza_cooked" && hands && !hands.isPlate) {
      return "Need empty plate to take pizza";
    }

    if (this.process?.phase === "active") {
      const pct = Math.floor((this.process.elapsed / this.process.duration) * 100);
      return `${this.process.kind}… ${pct}%`;
    }
    if (this.process?.phase === "burning") {
      return "Burning! Take it → trash";
    }

    if (!hands && this.held) {
      if (this.kind === "prep" && canChop(this.held.id)) return `E · Chop ${this.held.label}`;
      if (this.kind === "sink" && canWash(this.held.id)) return `E · Wash ${this.held.label}`;
      if (this.held.id.includes("burned")) {
        return `E · Take ${this.held.label} → trash`;
      }
      // Cooked pizza requires a plate — don't allow bare take
      if (this.held.id === "pizza_cooked") {
        return "Need empty plate to take pizza";
      }
      const extra =
        this.kind === "pass" && this.items.length > 1 ? ` (${this.items.length}/3)` : "";
      return `E · Take ${this.held.label}${extra}`;
    }

    if (hands && this.held?.id === "pizza_dough" && isTomatoTopping(hands.id)) {
      return "E · Put tomato on dough";
    }
    if (hands?.id === "pizza_dough" && this.held && isTomatoTopping(this.held.id)) {
      return "E · Put dough on tomato";
    }

    if (hands && this.held?.isPlate && canAddToPlate(this.held.contents, hands.id)) {
      return `E · Add ${hands.label} to plate`;
    }

    if (hands && this.canAccept(hands)) {
      if (this.kind === "pass") {
        return `E · Park ${hands.label} (${this.items.length + 1}/3)`;
      }
      return `E · Place ${hands.label}`;
    }

    if (hands && this.items.length >= this.capacity) {
      return this.kind === "pass" ? "Pass full (3/3)" : "Station full";
    }
    if (hands && !this.canAccept(hands)) return "Wrong station";
    if (this.kind === "pass") return `Pass · hold up to 3 items (${this.items.length}/3)`;
    return `E · ${this.def.label}`;
  }

  dispense(scene: Phaser.Scene): ItemEntity | null {
    if (!this.isDispenser || !this.def.dispenses) return null;
    if (this.kind === "plates" && !this.consumePlateStock()) return null;
    return new ItemEntity(scene, this.def.dispenses, this.x, this.y - 8);
  }

  /**
   * At the plate stack: create a plate, add the held ingredient, return the plate.
   * Ingredient entity is destroyed.
   */
  plateIngredient(scene: Phaser.Scene, ingredient: ItemEntity): ItemEntity | null {
    if (!this.canPlateIngredient(ingredient)) return null;
    if (!this.consumePlateStock()) return null;
    const plate = new ItemEntity(scene, "plate", this.x, this.y - 8);
    const dishId = plate.addToPlate(ingredient.id);
    ingredient.destroy();
    if (dishId) {
      /* plate already transformed into dish */
    }
    return plate;
  }

  /** Lift cooked pizza onto an empty plate → finished pizza dish. */
  platePizzaFromOven(plate: ItemEntity): ItemEntity | null {
    if (!this.canPlatePizza(plate)) return null;
    const cooked = this.take({ allowCookedPizza: true });
    if (!cooked) return null;
    cooked.destroy();
    plate.transform("pizza");
    return plate;
  }

  place(item: ItemEntity): boolean {
    if (this.kind === "trash") {
      item.destroy();
      return true;
    }

    if (this.kind === "flour") {
      const next = flourResult(item.id);
      if (!next) return false;
      item.transform(next);
    }

    const top = this.held;
    if (top?.id === "pizza_dough" && isTomatoTopping(item.id)) {
      top.transform("pizza_raw");
      item.destroy();
      this.refreshSlotHint();
      return true;
    }
    if (top && isTomatoTopping(top.id) && item.id === "pizza_dough") {
      top.destroy();
      this.items.pop();
      item.transform("pizza_raw");
      this.items.push(item);
      this.layoutSlots();
      this.refreshSlotHint();
      return true;
    }

    if (top?.isGrillPan && top.contents.length === 0) {
      if (top.addToPan(item.id)) {
        item.destroy();
        this.refreshSlotHint();
        this.maybeStartAutoCook();
        return true;
      }
    }

    if (top?.isPlate && canAddToPlate(top.contents, item.id)) {
      const dish = top.addToPlate(item.id);
      item.destroy();
      if (dish) this.clearProcess();
      this.refreshSlotHint();
      return true;
    }

    if (!this.canAccept(item)) return false;
    if (this.items.length >= this.capacity) return false;

    this.items.push(item);
    this.layoutSlots();
    this.maybeStartAutoCook();
    this.refreshSlotHint();
    return true;
  }

  /** Dip held food in flour without parking it. */
  flourDipHands(hands: ItemEntity): boolean {
    if (this.kind !== "flour") return false;
    const next = flourResult(hands.id);
    if (!next) return false;
    hands.transform(next);
    return true;
  }

  /** Start chop/wash when player presses E with empty hands. */
  startManualProcess(): string | null {
    if (!this.held || this.process) return null;
    if (this.kind === "prep") {
      const next = canChop(this.held.id);
      if (!next) return null;
      this.process = { kind: "chop", elapsed: 0, duration: CHOP_MS, phase: "active" };
      this.syncBar();
      return `Chopping ${this.held.label}…`;
    }
    if (this.kind === "sink") {
      const next = canWash(this.held.id);
      if (!next) return null;
      this.process = { kind: "wash", elapsed: 0, duration: WASH_MS, phase: "active" };
      this.syncBar();
      return `Washing ${this.held.label}…`;
    }
    if (this.kind === "flour") {
      const next = flourResult(this.held.id);
      if (!next) return null;
      this.held.transform(next);
      return `Floured → ${ITEMS[next].label}`;
    }
    return null;
  }

  take(opts?: { allowCookedPizza?: boolean }): ItemEntity | null {
    if (this.items.length === 0) return null;
    // Block bare take of cooked pizza — must use a plate
    if (this.held?.id === "pizza_cooked" && !opts?.allowCookedPizza) return null;
    if (this.process?.phase === "active" && this.process.kind !== "cook") {
      this.clearProcess();
    }
    if (this.process?.kind === "cook") {
      this.clearProcess();
    }
    const item = this.items.pop()!;
    this.clearProcess();
    this.layoutSlots();
    this.refreshSlotHint();
    return item;
  }

  update(delta: number): string | null {
    if (!this.process || !this.held) {
      this.syncBar();
      return null;
    }

    this.process.elapsed += delta;
    let message: string | null = null;

    if (this.process.phase === "active") {
      if (this.process.elapsed >= this.process.duration) {
        if (this.process.kind === "cook") {
          if (this.held.isGrillPan && this.held.panFood) {
            const next = cookResult(this.kind as CookKind, this.held.panFood);
            if (next) {
              this.held.setPanFood(next);
              message = `${ITEMS[next].label} ready!`;
            }
          } else {
            const next = cookResult(this.kind as CookKind, this.held.id);
            if (next) {
              this.held.transform(next);
              message = `${ITEMS[next].label} ready!`;
            }
          }
          this.process = {
            kind: "cook",
            elapsed: 0,
            duration: this.process.burnDuration ?? BURN_MS,
            phase: "burning",
          };
        } else if (this.process.kind === "chop") {
          const next = canChop(this.held.id);
          if (next) {
            this.held.transform(next);
            message = `Chopped → ${ITEMS[next].label}`;
          }
          this.clearProcess();
        } else if (this.process.kind === "wash") {
          const next = canWash(this.held.id);
          if (next) {
            this.held.transform(next);
            message = `Washed → ${ITEMS[next].label}`;
          }
          this.clearProcess();
        }
      }
    } else if (this.process.phase === "burning") {
      if (this.process.elapsed >= this.process.duration) {
        if (this.held.isGrillPan && this.held.panFood) {
          const next = burnResult(this.kind as CookKind, this.held.panFood);
          if (next) {
            this.held.setPanFood(next);
            message = `Burned! ${ITEMS[next].label}`;
          }
        } else {
          const next = burnResult(this.kind as CookKind, this.held.id);
          if (next) {
            this.held.transform(next);
            message = `Burned! ${ITEMS[next].label}`;
          }
        }
        this.clearProcess();
      }
    }

    this.syncBar();
    return message;
  }

  private layoutSlots() {
    if (this.kind === "pass" || this.kind === "counter") {
      this.items.forEach((item, i) => {
        const o = PASS_OFFSETS[Math.min(i, PASS_OFFSETS.length - 1)]!;
        item.anchorAt(this.x + o.x, this.y + o.y);
      });
    } else if (this.held) {
      this.held.anchorAt(this.x, this.y - 10);
    }
  }

  private refreshSlotHint() {
    if (this.slotHint) {
      this.slotHint.setText(`${this.items.length}/3`);
    }
  }

  private maybeStartAutoCook() {
    if (!this.held) return;
    if (!this.isCookStation()) return;
    if (this.process) return;
    let cookId = this.held.id;
    if (this.held.isGrillPan) {
      if (!this.held.panFood) return;
      cookId = this.held.panFood;
    }
    const next = cookResult(this.kind as CookKind, cookId);
    if (!next) return;
    const cookMs = this.kind === "oven" ? PIZZA_COOK_MS : COOK_MS;
    const burnMs = this.kind === "oven" ? PIZZA_BURN_MS : BURN_MS;
    this.process = {
      kind: "cook",
      elapsed: 0,
      duration: cookMs,
      burnDuration: burnMs,
      phase: "active",
    };
    this.syncBar();
  }

  private clearProcess() {
    this.process = null;
    this.syncBar();
  }

  private syncBar() {
    if (!this.process) {
      this.barBg.setVisible(false);
      this.barFill.setVisible(false);
      this.statusText.setVisible(false);
      return;
    }
    const pct = Math.min(1, this.process.elapsed / this.process.duration);
    const color =
      this.process.phase === "burning"
        ? 0xe63946
        : this.process.kind === "wash"
          ? 0x4fc3f7
          : this.process.kind === "chop"
            ? 0x7cb342
            : 0xd4a017;
    this.barBg.setVisible(true);
    this.barFill.setVisible(true);
    this.barFill.setFillStyle(color);
    this.barFill.width = 28 * pct;
    this.statusText.setVisible(this.process.phase === "burning");
    this.statusText.setText(this.process.phase === "burning" ? "HOT!" : "");
  }
}
