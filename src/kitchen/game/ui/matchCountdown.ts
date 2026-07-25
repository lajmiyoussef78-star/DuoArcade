import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";

export type MatchCountdown = {
  /** Call every frame. Returns true once the match may start. */
  tick: (deltaMs: number) => boolean;
  destroy: () => void;
};

/** Full-screen 3 · 2 · 1 · GO! before a kitchen shift. */
export function attachMatchCountdown(scene: Phaser.Scene): MatchCountdown {
  let ms = 3000;
  let finished = false;
  let lastShown = -1;

  const dim = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 3, GAME_HEIGHT * 3, 0x1a0800, 0.52)
    .setScrollFactor(0)
    .setDepth(5000);

  const text = scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 8, "3", {
      fontFamily: "Fraunces, Georgia, serif",
      fontSize: "108px",
      color: "#fff8e1",
      fontStyle: "bold",
      stroke: "#e65100",
      strokeThickness: 10,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(5001);

  const sub = scene.add
    .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 72, "Get ready…", {
      fontFamily: "Sora, sans-serif",
      fontSize: "18px",
      color: "#ffe0b2",
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(5001);

  const pulse = (n: string, color = "#fff8e1") => {
    text.setText(n);
    text.setColor(color);
    text.setScale(1.25);
    scene.tweens.add({
      targets: text,
      scale: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  };

  pulse("3");
  lastShown = 3;

  return {
    tick(deltaMs: number) {
      if (finished) return true;
      ms -= deltaMs;

      if (ms > 0) {
        const n = Math.max(1, Math.ceil(ms / 1000));
        if (n !== lastShown) {
          lastShown = n;
          pulse(String(n));
        }
        return false;
      }

      // Brief GO! beat
      if (ms > -650) {
        if (lastShown !== 0) {
          lastShown = 0;
          pulse("GO!", "#c8ffc8");
          sub.setText("Cook!");
        }
        return false;
      }

      finished = true;
      dim.destroy();
      text.destroy();
      sub.destroy();
      return true;
    },
    destroy() {
      if (finished) return;
      finished = true;
      dim.destroy();
      text.destroy();
      sub.destroy();
    },
  };
}
