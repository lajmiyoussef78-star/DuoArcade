import Phaser from "phaser";
import { APP_NAME, APP_VERSION } from "@gastronomica/shared";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#ffcc80");

    this.add
      .text(width / 2, height / 2 - 16, APP_NAME, {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#bf360c",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, `DuoArcade · v${APP_VERSION}`, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#e65100",
      })
      .setOrigin(0.5);

    // Use window timer — Phaser clocks were not advancing (stuck on boot).
    window.setTimeout(() => {
      if (!this.sys.isActive()) return;
      this.scene.start("preload");
    }, 200);
  }
}
