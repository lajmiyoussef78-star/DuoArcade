import Phaser from "phaser";
import { ITEMS, type ItemId } from "./types";
import { tryAssemble } from "./recipes";

export class ItemEntity {
  private _id: ItemId;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  /** Ingredients stacked on a plate before it becomes a dish. */
  contents: ItemId[] = [];
  private carried = false;
  private anchored = false;
  private thrownUntil = 0;

  constructor(scene: Phaser.Scene, id: ItemId, x: number, y: number) {
    this._id = id;
    const def = ITEMS[id];
    this.sprite = scene.physics.add.sprite(x, y, def.texture);
    this.sprite.setDepth(8);
    this.sprite.setBounce(0.15);
    this.sprite.setDrag(420);
    this.sprite.setMaxVelocity(400);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setData("item", this);
    this.sprite.setSize(12, 12);
  }

  get id(): ItemId {
    return this._id;
  }

  get label(): string {
    if (this._id === "plate" && this.contents.length > 0) {
      return `Plate (${this.contents.length})`;
    }
    if (this._id === "grill_pan") {
      if (this.contents.length > 0) {
        return `Pan · ${ITEMS[this.contents[0]!].label}`;
      }
      return "Grill pan";
    }
    return ITEMS[this._id].label;
  }

  get isDish(): boolean {
    return Boolean(ITEMS[this._id].dish);
  }

  get isPlate(): boolean {
    return this._id === "plate";
  }

  get isGrillPan(): boolean {
    return this._id === "grill_pan";
  }

  get panFood(): ItemId | null {
    return this.isGrillPan && this.contents.length > 0 ? this.contents[0]! : null;
  }

  get isCarried(): boolean {
    return this.carried;
  }

  get isAnchored(): boolean {
    return this.anchored;
  }

  get isFlying(): boolean {
    return this.sprite.scene.time.now < this.thrownUntil;
  }

  get isFree(): boolean {
    return !this.carried && !this.anchored && !this.isFlying;
  }

  transform(next: ItemId) {
    this._id = next;
    this.contents = [];
    this.sprite.setTexture(ITEMS[next].texture);
  }

  addToPlate(ingredient: ItemId): ItemId | null {
    if (!this.isPlate) return null;
    this.contents.push(ingredient);
    const dish = tryAssemble(this.contents);
    if (dish) {
      this.transform(dish);
      return dish;
    }
    return null;
  }

  /** Put chopped veg on an empty grill pan. */
  addToPan(ingredient: ItemId): boolean {
    if (!this.isGrillPan) return false;
    if (this.contents.length > 0) return false;
    if (ingredient !== "tomato_chopped" && ingredient !== "pepper_chopped") return false;
    this.contents = [ingredient];
    this.refreshPanTexture();
    return true;
  }

  setPanFood(id: ItemId | null) {
    if (!this.isGrillPan) return;
    this.contents = id ? [id] : [];
    this.refreshPanTexture();
  }

  private refreshPanTexture() {
    const food = this.panFood;
    if (!food) {
      this.sprite.setTexture("item-grill-pan");
      return;
    }
    const key = ITEMS[food]?.texture;
    if (key && this.sprite.scene.textures.exists(key)) {
      this.sprite.setTexture(key);
    } else {
      this.sprite.setTexture("item-grill-pan");
    }
  }

  attachTo(carrier: Phaser.GameObjects.Sprite) {
    this.carried = true;
    this.anchored = false;
    this.thrownUntil = 0;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.sprite.setVelocity(0, 0);
    this.sprite.setDepth(12);
    void carrier;
  }

  updateCarry(carrier: Phaser.GameObjects.Sprite, facing: "down" | "left" | "right" | "up") {
    if (!this.carried) return;
    const ox = facing === "left" ? -6 : facing === "right" ? 6 : 0;
    const oy = facing === "up" ? -18 : -14;
    this.sprite.setPosition(carrier.x + ox, carrier.y + oy);
  }

  detachAt(x: number, y: number) {
    this.carried = false;
    this.anchored = false;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    this.sprite.setPosition(x, y);
    this.sprite.setDepth(8);
    this.sprite.setVelocity(0, 0);
  }

  anchorAt(x: number, y: number) {
    this.carried = false;
    this.anchored = true;
    this.thrownUntil = 0;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.sprite.setPosition(x, y);
    this.sprite.setDepth(9);
    this.sprite.setVelocity(0, 0);
  }

  throwToward(x: number, y: number, vx: number, vy: number) {
    this.detachAt(x, y);
    this.thrownUntil = this.sprite.scene.time.now + 350;
    this.sprite.setVelocity(vx, vy);
  }

  destroy() {
    this.sprite.destroy();
  }
}
