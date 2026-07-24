import Phaser from "phaser";
import { ITEMS, type ItemId } from "../items/types";
import type { BuffetTrayDef } from "../maps/types";
import type { ItemEntity } from "../items/ItemEntity";

export class BuffetTray {
  readonly def: BuffetTrayDef;
  readonly x: number;
  readonly y: number;
  private stock = 0;
  private label: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Image | null = null;
  private warn: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, def: BuffetTrayDef) {
    this.def = def;
    this.x = def.x;
    this.y = def.y;

    if (scene.textures.exists(ITEMS[def.accepts].texture)) {
      this.icon = scene.add
        .image(def.x, def.y - 4, ITEMS[def.accepts].texture)
        .setScale(1.2)
        .setDepth(6)
        .setAlpha(0.35);
    }

    this.label = scene.add
      .text(def.x, def.y + 22, `0/${def.max}`, {
        fontFamily: "Sora, sans-serif",
        fontSize: "11px",
        color: "#b71c1c",
        backgroundColor: "#fff8e1",
        padding: { x: 4, y: 2 },
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(8);

    this.warn = scene.add
      .text(def.x, def.y - 28, "!", {
        fontFamily: "Sora, sans-serif",
        fontSize: "16px",
        color: "#f9a825",
        fontStyle: "bold",
        stroke: "#212121",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(9)
      .setVisible(true);

    scene.add
      .text(def.x, def.y + 36, def.label, {
        fontFamily: "Sora, sans-serif",
        fontSize: "9px",
        color: "#37474f",
        backgroundColor: "#ffffffcc",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(8);

    this.refresh();
  }

  get accepts(): ItemId {
    return this.def.accepts;
  }

  get current(): number {
    return this.stock;
  }

  get max(): number {
    return this.def.max;
  }

  get isEmpty(): boolean {
    return this.stock <= 0;
  }

  get isFull(): boolean {
    return this.stock >= this.def.max;
  }

  canStock(item: ItemEntity): boolean {
    return item.id === this.def.accepts && !this.isFull;
  }

  /** Stock a cooked batch; returns servings added (or 0). */
  stockItem(item: ItemEntity): number {
    if (!this.canStock(item)) return 0;
    const room = this.def.max - this.stock;
    const add = Math.min(room, this.def.addPerStock);
    this.stock += add;
    item.destroy();
    this.refresh();
    return add;
  }

  /** Customer takes one serving. */
  takeServing(): boolean {
    if (this.stock <= 0) return false;
    this.stock -= 1;
    this.refresh();
    return true;
  }

  promptFor(hands: ItemEntity | null): string | null {
    if (hands?.isGrillPan && hands.panFood === this.def.accepts) {
      if (this.isFull) return `${this.def.label} full (${this.stock}/${this.max})`;
      return `E · Empty pan into ${this.def.label} (+${this.def.addPerStock})`;
    }
    if (hands && hands.id === this.def.accepts) {
      if (this.isFull) return `${this.def.label} full (${this.stock}/${this.max})`;
      return `E · Stock ${hands.label} (+${this.def.addPerStock})`;
    }
    if (hands) return null;
    return `${this.def.label} ${this.stock}/${this.max}`;
  }

  /** Stock from a grill pan (keeps the empty pan) or a loose cooked item. */
  stockFromHands(item: ItemEntity): { added: number; keepItem: boolean } {
    if (item.isGrillPan && item.panFood === this.def.accepts) {
      if (this.isFull) return { added: 0, keepItem: true };
      const room = this.def.max - this.stock;
      const add = Math.min(room, this.def.addPerStock);
      this.stock += add;
      item.setPanFood(null);
      this.refresh();
      return { added: add, keepItem: true };
    }
    const added = this.stockItem(item);
    return { added, keepItem: added === 0 };
  }

  /** Sync stock from server authority snapshot. */
  setStock(n: number) {
    this.stock = Math.max(0, Math.min(this.def.max, Math.floor(n)));
    this.refresh();
  }

  private refresh() {
    this.label.setText(`${this.stock}/${this.def.max}`);
    this.label.setColor(this.stock <= 0 ? "#b71c1c" : this.isFull ? "#2e7d32" : "#e65100");
    this.warn.setVisible(this.stock <= 0);
    if (this.icon) {
      this.icon.setAlpha(this.stock <= 0 ? 0.25 : 0.55 + (this.stock / this.def.max) * 0.45);
    }
  }
}
