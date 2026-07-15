import Phaser from "phaser";
import { PLAYER_SPEED, PLAYER_SPRINT } from "../config";
import { ItemEntity } from "../items/ItemEntity";
import { THROW_SPEED } from "../items/types";

export type Facing = "down" | "left" | "right" | "up";

const FACING_ROW: Record<Facing, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

const FACING_VEC: Record<Facing, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private shadow: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private shift: Phaser.Input.Keyboard.Key;
  facing: Facing = "down";
  moving = false;
  sprinting = false;
  held: ItemEntity | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.shadow = scene.textures.exists("shadow")
      ? scene.add.image(x, y + 10, "shadow").setAlpha(0.5).setScale(1.8).setDepth(9)
      : scene.add.ellipse(x, y + 10, 30, 12, 0x000000, 0.3).setDepth(9);

    this.sprite = scene.physics.add.sprite(x, y, "player", 0);
    this.sprite.setSize(16, 12);
    this.sprite.setOffset(10, 28);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);
    // Soft outline pop via slight tint
    this.sprite.setTint(0xffffff);

    if (!scene.anims.exists("walk-down")) {
      const frameTotal = scene.textures.exists("player")
        ? scene.textures.get("player").frameTotal
        : 1;
      (["down", "left", "right", "up"] as Facing[]).forEach((dir) => {
        const row = FACING_ROW[dir];
        if (frameTotal >= 16) {
          scene.anims.create({
            key: `walk-${dir}`,
            frames: scene.anims.generateFrameNumbers("player", {
              start: row * 4,
              end: row * 4 + 3,
            }),
            frameRate: 8,
            repeat: -1,
          });
          scene.anims.create({
            key: `idle-${dir}`,
            frames: [{ key: "player", frame: row * 4 }],
            frameRate: 1,
          });
        } else {
          scene.anims.create({
            key: `walk-${dir}`,
            frames: [{ key: "player", frame: 0 }],
            frameRate: 1,
            repeat: -1,
          });
          scene.anims.create({
            key: `idle-${dir}`,
            frames: [{ key: "player", frame: 0 }],
            frameRate: 1,
          });
        }
      });
    }

    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.shift = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  update() {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;
    this.sprinting = this.shift.isDown;
    const speed = this.sprinting ? PLAYER_SPRINT : PLAYER_SPEED;

    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx = (vx / len) * speed;
      vy = (vy / len) * speed;
      this.moving = true;
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx < 0 ? "left" : "right";
      } else {
        this.facing = vy < 0 ? "up" : "down";
      }
      this.sprite.anims.play(`walk-${this.facing}`, true);
    } else {
      this.moving = false;
      this.sprite.setVelocity(0, 0);
      this.sprite.anims.play(`idle-${this.facing}`, true);
    }

    this.sprite.setVelocity(vx, vy);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 12);
    this.shadow.setAlpha(this.sprinting ? 0.35 : 0.5);
    this.held?.updateCarry(this.sprite, this.facing);
  }

  pickUp(item: ItemEntity): boolean {
    if (this.held) return false;
    this.held = item;
    item.attachTo(this.sprite);
    item.updateCarry(this.sprite, this.facing);
    return true;
  }

  drop(): ItemEntity | null {
    if (!this.held) return null;
    const item = this.held;
    this.held = null;
    const v = FACING_VEC[this.facing];
    item.detachAt(this.sprite.x + v.x * 14, this.sprite.y + v.y * 14);
    return item;
  }

  throwItem(): ItemEntity | null {
    if (!this.held) return null;
    const item = this.held;
    this.held = null;
    const v = FACING_VEC[this.facing];
    item.throwToward(
      this.sprite.x + v.x * 12,
      this.sprite.y + v.y * 12,
      v.x * THROW_SPEED,
      v.y * THROW_SPEED,
    );
    return item;
  }

  destroy() {
    this.held?.destroy();
    this.shadow.destroy();
    this.sprite.destroy();
  }
}
