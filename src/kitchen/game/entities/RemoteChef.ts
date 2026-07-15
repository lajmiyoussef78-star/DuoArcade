import Phaser from "phaser";
import type { FacingDir, PlayerNetState } from "@gastronomica/shared";

const FACING_ROW: Record<FacingDir, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

/** Visual-only chef for remote multiplayer peers (blue apron sheet). */
export class RemoteChef {
  readonly id: string;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private label: Phaser.GameObjects.Text;
  private heldText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    displayName: string,
    _avatarHue: number,
  ) {
    this.id = id;
    const key = scene.textures.exists("player_b") ? "player_b" : "player";
    this.sprite = scene.physics.add.sprite(x, y, key, 0);
    this.sprite.setSize(14, 12);
    this.sprite.setOffset(9, 24);
    this.sprite.setScale(1.35);
    this.sprite.setDepth(9);
    this.sprite.setImmovable(true);
    this.sprite.body!.enable = false;

    // Ensure walk anims exist for player_b (reuse player keys if same layout)
    if (key === "player_b" && !scene.anims.exists("walk-b-down")) {
      (["down", "left", "right", "up"] as FacingDir[]).forEach((dir) => {
        const row = FACING_ROW[dir];
        scene.anims.create({
          key: `walk-b-${dir}`,
          frames: scene.anims.generateFrameNumbers("player_b", {
            start: row * 4,
            end: row * 4 + 3,
          }),
          frameRate: 8,
          repeat: -1,
        });
        scene.anims.create({
          key: `idle-b-${dir}`,
          frames: [{ key: "player_b", frame: row * 4 }],
          frameRate: 1,
        });
      });
    }

    this.label = scene.add
      .text(x, y - 26, displayName, {
        fontFamily: "Sora, sans-serif",
        fontSize: "11px",
        color: "#3e2723",
        backgroundColor: "#fff8e1ee",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(30);

    this.heldText = scene.add
      .text(x, y - 36, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "10px",
        color: "#e65100",
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);
  }

  apply(state: PlayerNetState) {
    this.sprite.x = state.x;
    this.sprite.y = state.y;
    const row = FACING_ROW[state.facing];
    const useB = this.sprite.texture.key === "player_b";
    if (state.moving) {
      this.sprite.anims.play(useB ? `walk-b-${state.facing}` : `walk-${state.facing}`, true);
    } else {
      this.sprite.anims.play(useB ? `idle-b-${state.facing}` : `idle-${state.facing}`, true);
      this.sprite.setFrame(row * 4);
    }
    this.label.setPosition(state.x, state.y - 26);
    if (state.heldLabel) {
      this.heldText.setText(state.heldLabel).setVisible(true).setPosition(state.x, state.y - 38);
    } else {
      this.heldText.setVisible(false);
    }
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
    this.heldText.destroy();
  }
}
