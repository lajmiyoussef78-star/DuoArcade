import Phaser from "phaser";
import type { MatchSnapshot } from "../systems/ScoreManager";
import { getMap } from "../maps/catalog";

export class ResultsScene extends Phaser.Scene {
  private result!: MatchSnapshot;

  constructor() {
    super("results");
  }

  init(data: { result: MatchSnapshot }) {
    this.result = data.result;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#ffcc80");
    this.cameras.main.fadeIn(280, 255, 204, 128);

    this.add.rectangle(width / 2, height / 2, width, height, 0xffe0b2, 0.95);

    this.add
      .text(width / 2, 36, "Service complete", {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#bf360c",
      })
      .setOrigin(0.5);

    const stars = "★".repeat(this.result.stars) + "☆".repeat(3 - this.result.stars);
    this.add
      .text(width / 2, 78, stars, {
        fontFamily: "sans-serif",
        fontSize: "42px",
        color: "#ff8f00",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 118, this.result.gradeLabel, {
        fontFamily: "Sora, sans-serif",
        fontSize: "18px",
        color: "#e65100",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 168, `${this.result.performancePercent}%`, {
        fontFamily: "Georgia, serif",
        fontSize: "56px",
        color: "#bf360c",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 208, "Performance score", {
        fontFamily: "Sora, sans-serif",
        fontSize: "13px",
        color: "#8d6e63",
      })
      .setOrigin(0.5);

    const barW = 280;
    const barH = 12;
    const barX = width / 2 - barW / 2;
    const barY = 228;
    this.add.rectangle(width / 2, barY, barW, barH, 0xd7ccc8, 1).setOrigin(0.5);
    const fill = Math.max(0, Math.min(1, this.result.performancePercent / 100));
    if (fill > 0) {
      this.add.rectangle(barX, barY, barW * fill, barH, 0xff8f00, 1).setOrigin(0, 0.5);
    }

    const howPlayed = [
      `Kitchen score  ${this.result.score}`,
      `Served  ${this.result.served}   ·   Tips  ${this.result.tips}`,
      `Max combo  ${this.result.maxCombo} (${this.result.comboTier})`,
      `Walkouts  ${this.result.walkouts}   ·   Burns  ${this.result.burns}   ·   Wrong  ${this.result.wrongServes}`,
      `+${this.result.xpEarned} XP   ·   +${this.result.coinsEarned} coins`,
    ];

    this.add
      .text(width / 2, 258, "How you played", {
        fontFamily: "Sora, sans-serif",
        fontSize: "14px",
        color: "#6d4c41",
      })
      .setOrigin(0.5);

    howPlayed.forEach((line, i) => {
      this.add
        .text(width / 2, 282 + i * 24, line, {
          fontFamily: "Sora, sans-serif",
          fontSize: "15px",
          color: i === howPlayed.length - 1 ? "#2e7d32" : "#5d4037",
        })
        .setOrigin(0.5);
    });

    this.add
      .text(width / 2, height - 48, "R — play again   ·   L / Esc — lobby", {
        fontFamily: "Sora, sans-serif",
        fontSize: "13px",
        color: "#e65100",
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard;
    if (kb) {
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.R).once("down", () => {
        this.restartKitchen();
      });
      const goLobby = () => {
        const cb = this.registry.get("onReturnToLobby") as (() => void) | undefined;
        if (cb) cb();
        else this.restartKitchen();
      };
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.L).once("down", goLobby);
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).once("down", goLobby);
    }

    const onComplete = this.registry.get("onMatchComplete") as
      | ((result: MatchSnapshot) => void)
      | undefined;
    onComplete?.(this.result);
  }

  /**
   * Fresh solo run. Skip PreloadScene ("Loading kitchen…") which can hang on rematch
   * when textures already exist — kitchen/buffet rebuild assets in create().
   */
  private restartKitchen() {
    this.registry.remove("multiplayer");
    const map = getMap(this.registry.get("mapId") as string | undefined);
    const next = map.mode === "buffet" ? "buffet" : "kitchen";

    // Tear down leftover scenes first; then start replaces this results scene.
    for (const key of ["preload", "kitchen", "buffet"] as const) {
      if (this.scene.get(key)) this.scene.stop(key);
    }
    this.scene.start(next);
  }
}
