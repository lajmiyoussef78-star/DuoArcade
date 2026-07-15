import Phaser from "phaser";
import { generateGameAssets } from "../assets/generateAssets";
import { getMap, MAP_H, MAP_W } from "../maps/catalog";

/**
 * Fail-safe preload: build sprites + selected map backdrop, then enter kitchen.
 * Heavy work is chunked so the "Loading…" frame can paint and errors surface.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("preload");
  }

  create() {
    this.cameras.main.setBackgroundColor("#ffcc80");
    const { width, height } = this.scale;
    const map = getMap(this.registry.get("mapId") as string | undefined);

    this.add
      .text(width / 2, height / 2 - 28, "Loading kitchen…", {
        fontFamily: "Georgia, serif",
        fontSize: "22px",
        color: "#bf360c",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 8, map.name, {
        fontFamily: "Sora, sans-serif",
        fontSize: "14px",
        color: "#6d4c41",
      })
      .setOrigin(0.5);

    const status = this.add
      .text(width / 2, height / 2 + 36, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "12px",
        color: "#8d6e63",
      })
      .setOrigin(0.5);

    // Defer so the loading text paints before heavy canvas work.
    window.setTimeout(() => {
      void this.bootIntoMap(map.id, status);
    }, 30);
  }

  private async bootIntoMap(
    mapId: string,
    status: Phaser.GameObjects.Text,
  ) {
    if (!this.sys.isActive()) return;
    const map = getMap(mapId);
    const next = map.mode === "buffet" ? "buffet" : "kitchen";

    try {
      status.setText("Building chefs & items…");
      await this.yieldFrame();
      if (!this.sys.isActive()) return;

      try {
        generateGameAssets(this);
      } catch (err) {
        console.error("[preload] generateGameAssets failed", err);
        this.ensureMinimalSprites();
      }

      status.setText(`Painting ${map.name}…`);
      await this.yieldFrame();
      if (!this.sys.isActive()) return;

      try {
        map.paint(this);
      } catch (err) {
        console.error("[preload] map paint failed", err);
        this.ensureFallbackKitchen(map.bgKey);
      }

      if (!this.textures.exists(map.bgKey)) this.ensureFallbackKitchen(map.bgKey);
      if (!this.textures.exists("player")) this.ensureMinimalSprites();

      status.setText("Starting…");
      await this.yieldFrame();
      if (!this.sys.isActive()) return;

      if (!this.scene.get(next)) {
        throw new Error(`Scene "${next}" is not registered`);
      }
      this.scene.start(next);
    } catch (err) {
      console.error("[preload] failed to enter map", err);
      const msg = err instanceof Error ? err.message : String(err);
      status.setText(`Load failed: ${msg}`);
      status.setColor("#b71c1c");
      // Last-resort: try classic kitchen so the player isn't stuck forever
      window.setTimeout(() => {
        if (!this.sys.isActive()) return;
        if (this.scene.get("kitchen")) this.scene.start("kitchen");
      }, 1200);
    }
  }

  private yieldFrame(): Promise<void> {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  private ensureFallbackKitchen(key: string) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xb8895a);
    g.fillRect(0, 0, MAP_W, MAP_H);
    g.fillStyle(0x2f7a7a);
    g.fillRect(0, 0, MAP_W, 48);
    g.generateTexture(key, MAP_W, MAP_H);
    g.destroy();
  }

  private ensureMinimalSprites() {
    if (!this.textures.exists("player")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff);
      g.fillCircle(16, 14, 12);
      g.fillStyle(0x8e24aa);
      g.fillTriangle(16, 0, 4, 14, 28, 14);
      g.fillStyle(0xffcc80);
      g.fillCircle(16, 18, 8);
      g.generateTexture("player", 32, 40);
      g.destroy();
    }
    for (const key of [
      "prompt-bg",
      "place-ring",
      "item-tomato",
      "item-bun",
      "item-burger",
      "customer",
      "shadow",
      "item-grill-pan",
      "item-plate",
    ]) {
      if (this.textures.exists(key)) continue;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff);
      g.fillCircle(10, 10, 8);
      g.generateTexture(key, 20, 20);
      g.destroy();
    }
  }
}
