import Phaser from "phaser";
import type { KitchenSnapshot } from "@gastronomica/shared";
import { tryHandCombine } from "@gastronomica/shared";
import { generateGameAssets } from "../assets/generateAssets";
import { AudioManager } from "../audio/AudioManager";
import { Appliance } from "../entities/Appliance";
import { Customer, CustomerManager } from "../entities/Customer";
import { Player } from "../entities/Player";
import { RemoteChef } from "../entities/RemoteChef";
import { ItemEntity } from "../items/ItemEntity";
import { APPLIANCE_RANGE, ITEMS, PANTRY_RANGE, PASS_RANGE, PICKUP_RANGE, type ItemId } from "../items/types";
import { recipesForMenu, recipeHowTo, recipeIngredientLine, type Recipe } from "../items/recipes";
import { getMap, MAP_H, MAP_W } from "../maps/catalog";
import type { MapDef } from "../maps/types";
import type { MultiplayerBridge } from "../net/MultiplayerBridge";
import { ScoreManager, calcStars } from "../systems/ScoreManager";
import { KitchenFx } from "../systems/KitchenFx";

export type { MultiplayerBridge } from "../net/MultiplayerBridge";

const CUSTOMER_RANGE = 140;
const NET_SEND_MS = 66;

const SLOT_OFFSETS = [
  { x: 0, y: 0 },
  { x: 28, y: 0 },
  { x: -28, y: 0 },
  { x: 0, y: 28 },
];

export class KitchenScene extends Phaser.Scene {
  private player!: Player;
  private audio!: AudioManager;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private appliances: Appliance[] = [];
  private customers!: CustomerManager;
  private scoring!: ScoreManager;
  private worldItems: ItemEntity[] = [];
  private itemGroup!: Phaser.Physics.Arcade.Group;
  private prompt!: Phaser.GameObjects.Container;
  private promptLabel!: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private dropKey!: Phaser.Input.Keyboard.Key;
  private throwKey!: Phaser.Input.Keyboard.Key;
  private hudHint!: Phaser.GameObjects.Text;
  private heldHud!: Phaser.GameObjects.Text;
  private scoreHud!: Phaser.GameObjects.Text;
  private ratingHud!: Phaser.GameObjects.Text;
  private timerHud!: Phaser.GameObjects.Text;
  private timerBg!: Phaser.GameObjects.Graphics;
  private stationGlow!: Phaser.GameObjects.Graphics;
  private kitchenFx!: KitchenFx;
  private recipeTooltip!: Phaser.GameObjects.Container;
  private recipeTooltipBg!: Phaser.GameObjects.Graphics;
  private recipeTooltipTitle!: Phaser.GameObjects.Text;
  private recipeTooltipBody!: Phaser.GameObjects.Text;
  private comboHud!: Phaser.GameObjects.Text;
  private ended = false;
  private paused = false;
  private helpVisible = false;
  private helpKey!: Phaser.Input.Keyboard.Key;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayBody!: Phaser.GameObjects.Text;
  private mp: MultiplayerBridge | null = null;
  private remotes = new Map<string, RemoteChef>();
  private netAcc = 0;
  private localNameLabel: Phaser.GameObjects.Text | null = null;
  private mapDef!: MapDef;
  private authority = false;
  private authWorld = new Map<string, ItemEntity>();
  private authCustomers = new Map<
    number,
    { root: Phaser.GameObjects.Container; bubble: Phaser.GameObjects.Text }
  >();
  private lastSnapSeq = -1;
  /** Cooldown so proximity combine doesn't fire every frame. */
  private combineCd = 0;

  constructor() {
    super("kitchen");
  }

  create() {
    this.ended = false;
    this.paused = false;
    this.helpVisible = false;
    this.remotes.clear();
    this.worldItems = [];
    this.authWorld.clear();
    this.authCustomers.clear();
    this.lastSnapSeq = -1;
    this.netAcc = 0;
    this.mp = (this.registry.get("multiplayer") as MultiplayerBridge | undefined) ?? null;
    this.authority = Boolean(this.mp?.authority);
    this.mapDef = getMap(
      (this.mp?.mapId as string | undefined) ??
        (this.registry.get("mapId") as string | undefined),
    );
    this.scoring = new ScoreManager(this.mapDef.matchSeconds);
    this.audio = new AudioManager();
    const prefs = this.registry.get("audioPrefs") as
      | { masterVolume: number; sfxVolume: number }
      | undefined;
    if (prefs) this.audio.applyPrefs(prefs.masterVolume, prefs.sfxVolume);
    this.audio.playBoot();
    this.cameras.main.fadeIn(280, 10, 16, 12);

    try {
      if (!this.textures.exists("player")) generateGameAssets(this);
      this.mapDef.paint(this);
    } catch (err) {
      console.error("[kitchen] asset rebuild failed", err);
    }
    if (!this.textures.exists(this.mapDef.bgKey)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xb8895a);
      g.fillRect(0, 0, MAP_W, MAP_H);
      g.generateTexture(this.mapDef.bgKey, MAP_W, MAP_H);
      g.destroy();
    }
    if (!this.textures.exists("player")) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff);
      g.fillCircle(16, 18, 14);
      g.generateTexture("player", 32, 40);
      g.destroy();
    }

    this.add.image(0, 0, this.mapDef.bgKey).setOrigin(0, 0).setDepth(0);
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBackgroundColor("#b8895a");
    this.cameras.main.setZoom(1);

    this.solids = this.physics.add.staticGroup();
    for (const c of this.mapDef.colliders) {
      const wall = this.add.rectangle(c.x, c.y, c.w, c.h, 0x000000, 0);
      this.physics.add.existing(wall, true);
      this.solids.add(wall);
    }

    const self = this.mp?.peers.find((p) => p.id === this.mp?.localId);
    const slot = self?.slot ?? 0;
    const offset = SLOT_OFFSETS[slot % SLOT_OFFSETS.length]!;
    const spawnX = this.mapDef.spawn.x + offset.x;
    const spawnY = this.mapDef.spawn.y + offset.y;
    this.player = new Player(this, spawnX, spawnY);
    this.player.sprite.setScale(1.35);
    if (self) {
      this.localNameLabel = this.add
        .text(spawnX, spawnY - 34, self.displayName, {
          fontFamily: "Sora, sans-serif",
          fontSize: "12px",
          color: "#bf360c",
          fontStyle: "bold",
          stroke: "#ffffff",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(30);
    } else {
      this.localNameLabel = this.add
        .text(spawnX, spawnY - 34, "YOU", {
          fontFamily: "Sora, sans-serif",
          fontSize: "12px",
          color: "#c62828",
          fontStyle: "bold",
          stroke: "#ffffff",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(30);
    }
    this.physics.add.collider(this.player.sprite, this.solids);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(60, 40);

    if (this.mp) {
      for (const peer of this.mp.peers) {
        if (peer.id === this.mp.localId) continue;
        const off = SLOT_OFFSETS[peer.slot % SLOT_OFFSETS.length]!;
        const rx = this.mapDef.spawn.x + off.x;
        const ry = this.mapDef.spawn.y + off.y;
        this.remotes.set(
          peer.id,
          new RemoteChef(this, peer.id, rx, ry, peer.displayName, peer.avatarHue),
        );
      }
    }

    this.itemGroup = this.physics.add.group();
    this.physics.add.collider(this.itemGroup, this.solids);

    this.appliances = this.mapDef.appliances.map((def) => new Appliance(this, def));
    this.kitchenFx = new KitchenFx(this);
    this.kitchenFx.bindAppliances(this.appliances);
    this.stationGlow = this.add.graphics().setDepth(5);

    // Soft station rings (no loud red fire icons)
    const stationColor: Record<string, number> = {
      grill: 0x8d6e63,
      oven: 0xb71c1c,
      fryer: 0xffb300,
      prep: 0x66bb6a,
      sink: 0x29b6f6,
      pass: 0xff9800,
      plates: 0x1e88e5,
      pantry: 0xffc107,
      juice: 0xfb8c00,
      icecream: 0xf06292,
      trash: 0x78909c,
      counter: 0xbcaaa4,
    };
    for (const a of this.appliances) {
      const col = stationColor[a.kind] ?? 0xffffff;
      const ring = this.add.graphics().setDepth(4);
      ring.lineStyle(2.5, col, 0.4);
      ring.strokeCircle(a.x, a.y + 8, 16);

      if (a.kind === "pantry" && a.def.label) {
        const short = a.def.label.length <= 8 ? a.def.label : a.def.label.slice(0, 3);
        this.add
          .text(a.x, a.y + 22, short, {
            fontFamily: "Sora, sans-serif",
            fontSize: "9px",
            color: "#2b1d14",
            backgroundColor: "#fffde7cc",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5)
          .setDepth(8);
      } else if (a.kind === "plates") {
        const stockLabel = this.add
          .text(a.x, a.y + 18, `Plates ${this.mapDef.plateStock}`, {
            fontFamily: "Sora, sans-serif",
            fontSize: "10px",
            color: "#0d47a1",
            backgroundColor: "#e3f2fd",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(8);
        a.setPlateStock(this.mapDef.plateStock, stockLabel);
      } else if (a.kind === "oven") {
        this.add
          .text(a.x, a.y + 22, "Oven", {
            fontFamily: "Sora, sans-serif",
            fontSize: "10px",
            color: "#b71c1c",
            backgroundColor: "#ffebee",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(8);
      } else if (a.kind === "juice") {
        this.add
          .text(a.x, a.y + 20, "Juice", {
            fontFamily: "Sora, sans-serif",
            fontSize: "10px",
            color: "#e65100",
            backgroundColor: "#fff3e0",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(8);
      } else if (a.kind === "icecream") {
        this.add
          .text(a.x, a.y + 20, "Ice cream", {
            fontFamily: "Sora, sans-serif",
            fontSize: "10px",
            color: "#ad1457",
            backgroundColor: "#fce4ec",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(8);
      } else if (a.kind === "trash") {
        this.add
          .text(a.x, a.y + 26, "Trash", {
            fontFamily: "Sora, sans-serif",
            fontSize: "10px",
            color: "#37474f",
            backgroundColor: "#eceff1",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(8);
      }
    }
    this.customers = new CustomerManager(
      this,
      this.mapDef.seats,
      this.mapDef.customerSpawnMs,
      this.mapDef.door,
      this.mapDef.menu,
    );
    if (this.authority) {
      this.customers.setSpawning(false);
      this.tip("Online co-op · shared kitchen (server)");
    } else {
      this.customers.trySpawn();
    }

    // No free items dumped in the aisle — grab everything from crates / plate stack.

    this.prompt = this.add.container(0, 0).setDepth(20).setVisible(false);
    const bg = this.add.image(0, 0, "prompt-bg");
    this.promptLabel = this.add
      .text(0, 0, "E", {
        fontFamily: "Sora, sans-serif",
        fontSize: "11px",
        color: "#2b1d14",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.prompt.add([bg, this.promptLabel]);

    const kb = this.input.keyboard!;
    kb.addCapture([
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.E,
      Phaser.Input.Keyboard.KeyCodes.Q,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    ]);
    this.interactKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.dropKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.throwKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.helpKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.pauseKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.hudHint = this.add
      .text(12, 52, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "12px",
        color: "#2b1d14",
        backgroundColor: "#ffffffee",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(52)
      .setVisible(false);

    const helpBtn = this.add
      .text(12, 8, " ☰ ", {
        fontFamily: "Sora, sans-serif",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#ff7043",
        padding: { x: 8, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(51)
      .setInteractive({ useHandCursor: true });
    helpBtn.on("pointerdown", () => {
      this.helpVisible = !this.helpVisible;
      this.paused = false;
      this.refreshOverlay();
    });

    const qBtn = this.add
      .text(56, 8, " ? ", {
        fontFamily: "Sora, sans-serif",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#ff7043",
        padding: { x: 8, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(51)
      .setInteractive({ useHandCursor: true });
    qBtn.on("pointerdown", () => {
      this.helpVisible = !this.helpVisible;
      this.refreshOverlay();
    });

    this.scoreHud = this.add
      .text(100, 8, "0", {
        fontFamily: "Sora, sans-serif",
        fontSize: "18px",
        color: "#ffffff",
        stroke: "#2b1d14",
        strokeThickness: 5,
      })
      .setScrollFactor(0)
      .setDepth(51);

    this.ratingHud = this.add
      .text(100, 28, "☆☆☆☆☆", {
        fontFamily: "Sora, sans-serif",
        fontSize: "13px",
        color: "#ffd54f",
        stroke: "#2b1d14",
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(51);

    this.timerBg = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.timerBg.fillStyle(0x2b1d14, 0.72);
    this.timerBg.fillRoundedRect(this.scale.width - 168, 4, 100, 40, 12);
    this.timerBg.lineStyle(3, 0xff9800, 1);
    this.timerBg.strokeRoundedRect(this.scale.width - 168, 4, 100, 40, 12);

    this.timerHud = this.add
      .text(this.scale.width - 118, 8, "3:00", {
        fontFamily: "Sora, sans-serif",
        fontSize: "26px",
        color: "#ffffff",
        stroke: "#2b1d14",
        strokeThickness: 6,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(51);

    const pauseBtn = this.add
      .text(this.scale.width - 12, 8, " ⏸ ", {
        fontFamily: "Sora, sans-serif",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#ff7043",
        padding: { x: 6, y: 5 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(51)
      .setInteractive({ useHandCursor: true });
    pauseBtn.on("pointerdown", () => {
      this.paused = !this.paused;
      this.helpVisible = false;
      this.refreshOverlay();
    });

    this.comboHud = this.add
      .text(100, 68, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "12px",
        color: "#fff8e1",
        backgroundColor: "#ff7043",
        padding: { x: 8, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(51);

    this.heldHud = this.add
      .text(100, 48, "Hands: empty", {
        fontFamily: "Sora, sans-serif",
        fontSize: "12px",
        color: "#2b1d14",
        backgroundColor: "#ffffffee",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(51);

    this.buildRecipeRibbon();
    this.buildOverlay();
    this.refreshScoreHud();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  /** Blue bottom bar: finished dishes for this level + hover recipe cards. */
  private buildRecipeRibbon() {
    const { width, height } = this.scale;
    const recipes = recipesForMenu(this.mapDef.menu);
    const badgeGap = 100;
    const barW = Math.max(340, recipes.length * badgeGap + 100);
    const barX = width / 2 - barW / 2;
    const barY = height - 54;

    const ribbon = this.add.graphics().setScrollFactor(0).setDepth(50);
    ribbon.fillStyle(0x1e88e5, 0.97);
    ribbon.fillRoundedRect(barX, barY, barW, 46, 14);
    ribbon.lineStyle(3, 0x2b1d14, 1);
    ribbon.strokeRoundedRect(barX, barY, barW, 46, 14);

    this.add
      .text(barX + 14, barY + 23, "MENU", {
        fontFamily: "Sora, sans-serif",
        fontSize: "11px",
        color: "#e3f2fd",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(51);

    this.recipeTooltipBg = this.add.graphics().setScrollFactor(0).setDepth(60);
    this.recipeTooltipTitle = this.add
      .text(0, 0, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "13px",
        color: "#2b1d14",
        fontStyle: "bold",
      })
      .setOrigin(0, 0);
    this.recipeTooltipBody = this.add
      .text(0, 0, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "11px",
        color: "#455a64",
        align: "left",
        lineSpacing: 4,
        wordWrap: { width: 220 },
      })
      .setOrigin(0, 0);
    this.recipeTooltip = this.add
      .container(0, 0, [this.recipeTooltipBg, this.recipeTooltipTitle, this.recipeTooltipBody])
      .setScrollFactor(0)
      .setDepth(60)
      .setVisible(false);

    const startX = width / 2 - ((recipes.length - 1) * badgeGap) / 2 + 18;
    recipes.forEach((recipe, i) => {
      const cx = startX + i * badgeGap;
      const cy = barY + 23;
      const tex = ITEMS[recipe.id].texture;

      const badge = this.add.graphics().setScrollFactor(0).setDepth(51);
      badge.fillStyle(0xffffff, 1);
      badge.fillCircle(cx, cy, 18);
      badge.lineStyle(3, 0x2b1d14, 1);
      badge.strokeCircle(cx, cy, 18);

      const icon = this.add
        .image(cx, cy, tex)
        .setScrollFactor(0)
        .setDepth(52)
        .setScale(1.2)
        .setInteractive({
          hitArea: new Phaser.Geom.Circle(0, 0, 22),
          hitAreaCallback: Phaser.Geom.Circle.Contains,
          useHandCursor: true,
        });

      icon.on("pointerover", () => this.showRecipeTooltip(cx, barY - 6, recipe));
      icon.on("pointerout", () => this.recipeTooltip.setVisible(false));
    });
  }

  private showRecipeTooltip(x: number, anchorY: number, recipe: Recipe) {
    const ingredients = recipeIngredientLine(recipe);
    const howTo = recipeHowTo(recipe);
    const body = `${ingredients}\n\n${howTo}\n\n⏱ ~${recipe.patience}s patience`;
    this.recipeTooltipTitle.setText(recipe.name);
    this.recipeTooltipBody.setText(body);
    this.recipeTooltipBody.setWordWrapWidth(220);

    const pad = 12;
    const titleH = 18;
    const innerW = Math.max(
      200,
      Math.max(this.recipeTooltipTitle.width, this.recipeTooltipBody.width),
    );
    const boxW = innerW + pad * 2;
    const boxH = titleH + this.recipeTooltipBody.height + pad * 2 + 6;

    this.recipeTooltipBg.clear();
    this.recipeTooltipBg.fillStyle(0xfffde7, 0.98);
    this.recipeTooltipBg.fillRoundedRect(-boxW / 2, -boxH, boxW, boxH, 12);
    this.recipeTooltipBg.lineStyle(3, 0x2b1d14, 1);
    this.recipeTooltipBg.strokeRoundedRect(-boxW / 2, -boxH, boxW, boxH, 12);
    this.recipeTooltipBg.fillStyle(0xfffde7, 0.98);
    this.recipeTooltipBg.fillTriangle(-8, -2, 8, -2, 0, 8);
    this.recipeTooltipBg.lineStyle(3, 0x2b1d14, 1);
    this.recipeTooltipBg.lineBetween(-8, -2, 0, 8);
    this.recipeTooltipBg.lineBetween(8, -2, 0, 8);

    this.recipeTooltipTitle.setPosition(-boxW / 2 + pad, -boxH + pad);
    this.recipeTooltipBody.setPosition(-boxW / 2 + pad, -boxH + pad + titleH + 2);
    this.recipeTooltip.setPosition(Phaser.Math.Clamp(x, boxW / 2 + 8, this.scale.width - boxW / 2 - 8), anchorY);
    this.recipeTooltip.setVisible(true);
  }

  private buildOverlay() {
    const { width, height } = this.scale;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x2b1d14, 0.72);
    this.overlayTitle = this.add
      .text(width / 2, height / 2 - 70, "Paused", {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#f3efe6",
      })
      .setOrigin(0.5);
    this.overlayBody = this.add
      .text(
        width / 2,
        height / 2 + 10,
        "WASD move · Shift sprint · E interact\nQ drop · Space throw · H help · Esc pause",
        {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#a8b5a4",
          align: "center",
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);
    this.overlay = this.add
      .container(0, 0, [dim, this.overlayTitle, this.overlayBody])
      .setScrollFactor(0)
      .setDepth(80)
      .setVisible(false);
  }

  private refreshOverlay() {
    if (this.paused) {
      this.overlayTitle.setText("Paused");
      this.overlayBody.setText(
        "Esc to resume · H for controls\nTimer is frozen while paused",
      );
      this.overlay.setVisible(true);
      return;
    }
    if (this.helpVisible) {
      this.overlayTitle.setText("Controls");
      this.overlayBody.setText(
        "WASD / Arrows — Move\nShift — Sprint\nE — Take order / cook / serve\nWalk into matching ingredients to assemble\nQ — Drop · Space — Throw\nH — Close help · Esc — Pause",
      );
      this.overlay.setVisible(true);
      return;
    }
    this.overlay.setVisible(false);
  }

  update(_time: number, delta: number) {
    if (this.ended) return;

    if (Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      if (this.helpVisible) {
        this.helpVisible = false;
      } else {
        this.paused = !this.paused;
      }
      this.refreshOverlay();
    }
    if (Phaser.Input.Keyboard.JustDown(this.helpKey)) {
      this.helpVisible = !this.helpVisible;
      if (this.helpVisible) this.paused = false;
      this.refreshOverlay();
    }

    if (this.paused || this.helpVisible) {
      this.player.sprite.setVelocity(0, 0);
      return;
    }

    if (this.authority) {
      this.updateAuthority(delta);
      return;
    }

    this.scoring.tick(delta / 1000);
    this.syncTimerHud();

    if (this.scoring.isClosing) {
      this.customers.setSpawning(false);
    }

    if (this.scoring.ended) {
      this.finishMatch();
      return;
    }

    this.player.update();
    this.localNameLabel?.setPosition(this.player.sprite.x, this.player.sprite.y - 34);
    this.audio.playStep(delta, this.player.moving);
    this.heldHud.setText(
      this.player.held ? `Hands: ${this.player.held.label}` : "Hands: empty",
    );
    this.syncMultiplayer(delta);
    this.kitchenFx.update(delta);
    this.updateStationGlow();
    this.tryProximityCombine(delta);

    for (const app of this.appliances) {
      const msg = app.update(delta);
      if (msg) {
        this.tip(msg);
        if (msg.includes("Burned")) {
          this.audio.playBurn();
          this.customers.notifyBurn();
          this.scoring.registerBurn();
          this.refreshScoreHud();
          this.tip("Burned! Take it and throw it in the TRASH");
          this.kitchenFx.sparkBurst(app.x, app.y - 16, 8);
          this.cameras.main.shake(80, 0.005);
        } else if (msg.includes("ready")) {
          this.audio.playCookDone();
          this.audio.playDing();
          this.kitchenFx.sparkBurst(app.x, app.y - 16, 12);
          this.cameras.main.shake(60, 0.003);
        } else if (msg.includes("Chopped")) this.audio.playChop();
        else if (msg.includes("Washed")) this.audio.playWash();
        else if (msg.includes("cooking") || msg.toLowerCase().includes("cook")) {
          /* idle sizzle handled ambiently */
        }
        if (app.kind === "grill" && app.isBusy && Math.random() < 0.02) {
          this.audio.playSizzle();
        }
      }
    }

    const { walkouts } = this.customers.update(delta);
    if (walkouts > 0) {
      this.scoring.registerWalkout(walkouts);
      this.refreshScoreHud();
      this.tip(`Customer walked out! Combo broken · −${40 * walkouts}`);
      this.audio.playWalkout();
    }

    for (const item of this.worldItems) {
      try {
        if (!item.sprite?.active) continue;
        if (!item.isCarried && !item.isAnchored && !item.isFlying) {
          const body = item.sprite.body as Phaser.Physics.Arcade.Body | null;
          if (body && body.velocity.length() < 12) item.sprite.setVelocity(0, 0);
        }
      } catch {
        /* destroyed mid-frame */
      }
    }
    this.pruneWorldItems();

    if (Phaser.Input.Keyboard.JustDown(this.dropKey)) {
      // Near a customer with a finished dish → serve (Q is a common "give" instinct)
      const near = this.customers.nearest(
        this.player.sprite.x,
        this.player.sprite.y,
        CUSTOMER_RANGE,
      );
      if (near && this.player.held && this.isServableMeal(this.player.held, near)) {
        this.deliverToCustomer(near);
      } else if (near && this.player.held && !this.player.held.isDish) {
        this.tip("That isn’t a finished plate yet — assemble on a plate, then press E");
      } else {
        const dropped = this.player.drop();
        if (dropped) {
          this.trackWorldItem(dropped);
          this.audio.playDrop();
          this.tip(
            near
              ? `Dropped ${dropped.label} · stand closer and press E to serve`
              : `Dropped ${dropped.label}`,
          );
        }
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.throwKey)) {
      const thrown = this.player.throwItem();
      if (thrown) {
        this.trackWorldItem(thrown);
        this.audio.playThrow();
        this.tip(`Threw ${thrown.label}`);
        this.cameras.main.shake(60, 0.003);
      }
    }

    const target = this.findInteractTarget();
    if (target) {
      this.prompt.setVisible(true);
      this.prompt.setPosition(target.x, target.y);
      this.promptLabel.setText(target.prompt);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.resolveInteract(target);
      }
    } else {
      this.prompt.setVisible(false);
    }
  }

  private finishMatch() {
    if (this.ended) return;
    this.ended = true;
    this.customers.setSpawning(false);
    const result = this.scoring.snapshot();
    this.tip("Kitchen closed!");
    this.audio.playServe();
    this.time.delayedCall(600, () => {
      this.scene.start("results", { result });
    });
  }

  private syncTimerHud() {
    const t = Math.ceil(this.scoring.timeLeft);
    const m = Math.floor(t / 60);
    const s = (t % 60).toString().padStart(2, "0");
    this.timerHud.setText(`${m}:${s}`);
    this.timerHud.setColor(
      this.scoring.isClosing ? "#ff5252" : t < 60 ? "#ffd54f" : "#ffffff",
    );
    if (this.scoring.isClosing && t > 0) {
      this.tip("Closing time — no new customers!");
    }
  }

  private scoreLine(): string {
    return `💰 ${this.scoring.score}`;
  }

  private ratingLine(): string {
    const s = calcStars({
      score: this.scoring.score,
      served: this.scoring.served,
      walkouts: this.scoring.walkouts,
      burns: this.scoring.burns,
      wrongServes: this.scoring.wrongServes,
      tips: this.scoring.tips,
      maxCombo: this.scoring.maxCombo,
    });
    return "★".repeat(s) + "☆".repeat(3 - s);
  }

  private refreshScoreHud() {
    this.scoreHud.setText(this.scoreLine());
    this.ratingHud.setText(this.ratingLine());
    const tier = this.scoring.comboTier;
    if (this.scoring.combo > 0) {
      this.comboHud.setText(`✨ Combo ×${this.scoring.combo} · ${tier}`).setVisible(true);
    } else {
      this.comboHud.setVisible(false);
    }
  }

  private applianceReach(app: Appliance): number {
    if (app.kind === "pantry" || app.kind === "plates") return PANTRY_RANGE;
    if (app.kind === "pass") return PASS_RANGE;
    return APPLIANCE_RANGE;
  }

  private updateStationGlow() {
    this.stationGlow.clear();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    let best: Appliance | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const app of this.appliances) {
      const d = Phaser.Math.Distance.Between(px, py, app.x, app.y);
      if (d <= this.applianceReach(app) && d < bestD) {
        bestD = d;
        best = app;
      }
    }
    if (!best) return;
    const pulse = 0.35 + Math.sin(this.time.now / 180) * 0.15;
    this.stationGlow.lineStyle(4, 0xfff59d, pulse);
    this.stationGlow.strokeCircle(best.x, best.y + 6, 22 + pulse * 4);
    this.stationGlow.fillStyle(0xfff59d, pulse * 0.15);
    this.stationGlow.fillCircle(best.x, best.y + 6, 20);
  }

  private floatFeedback(x: number, y: number, lines: string[], color = "#2e7d32") {
    const t = this.add
      .text(x, y, lines.join("\n"), {
        fontFamily: "Sora, sans-serif",
        fontSize: "16px",
        color,
        fontStyle: "bold",
        align: "center",
        stroke: "#ffffff",
        strokeThickness: 5,
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setAlpha(0);
    // Fade in → hold so tips / stars are readable → drift up slowly
    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 320,
      onComplete: () => {
        this.tweens.add({
          targets: t,
          y: y - 64,
          alpha: 0,
          duration: 2600,
          delay: 900,
          ease: "Sine.out",
          onComplete: () => t.destroy(),
        });
      },
    });
  }

  private tip(msg: string) {
    this.hudHint.setText(msg).setVisible(true);
    this.time.delayedCall(3200, () => {
      if (this.hudHint.text === msg) this.hudHint.setVisible(false);
    });
  }

  private trackWorldItem(item: ItemEntity) {
    if (!item.sprite?.active) return;
    if (!this.worldItems.includes(item)) this.worldItems.push(item);
    if (!this.itemGroup.contains(item.sprite)) this.itemGroup.add(item.sprite);
  }

  private untrackWorldItem(item: ItemEntity) {
    this.worldItems = this.worldItems.filter((i) => i !== item);
    if (item.sprite?.active && this.itemGroup.contains(item.sprite)) {
      this.itemGroup.remove(item.sprite);
    }
  }

  private pruneWorldItems() {
    this.worldItems = this.worldItems.filter((i) => {
      try {
        return Boolean(i.sprite?.active);
      } catch {
        return false;
      }
    });
  }

  /**
   * Walk-up assembly: dough↔tomato, ingredient↔plate (either in hands).
   * Works with floor items and items parked on prep / pass / hold / sink.
   */
  private tryProximityCombine(delta: number) {
    this.combineCd = Math.max(0, this.combineCd - delta);
    if (this.combineCd > 0) return;
    const held = this.player.held;
    if (!held || !held.sprite.active) return;

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const heldSide = { id: held.id, contents: [...held.contents] };

    type Candidate = {
      item: ItemEntity;
      dist: number;
      app?: Appliance;
    };
    let best: Candidate | null = null;

    for (const item of this.worldItems) {
      if (item === held || item.isCarried || item.isFlying || !item.sprite.active) continue;
      if (item.isAnchored) continue;
      const d = Phaser.Math.Distance.Between(px, py, item.sprite.x, item.sprite.y);
      if (d > PICKUP_RANGE) continue;
      if (!tryHandCombine(heldSide, { id: item.id, contents: [...item.contents] })) continue;
      if (!best || d < best.dist) best = { item, dist: d };
    }

    for (const app of this.appliances) {
      if (
        app.kind === "pantry" ||
        app.kind === "plates" ||
        app.kind === "trash" ||
        app.kind === "juice" ||
        app.kind === "icecream" ||
        app.kind === "flour" ||
        app.kind === "oven" ||
        app.kind === "grill" ||
        app.kind === "fryer" ||
        app.kind === "grill_panel"
      ) {
        continue;
      }
      if (app.isBusy) continue;
      const reach = this.applianceReach(app) + 8;
      for (const item of app.parked) {
        if (!item.sprite.active) continue;
        const dItem = Phaser.Math.Distance.Between(px, py, item.sprite.x, item.sprite.y);
        const dApp = Phaser.Math.Distance.Between(px, py, app.x, app.y);
        const d = Math.min(dItem, dApp);
        if (d > reach) continue;
        if (!tryHandCombine(heldSide, { id: item.id, contents: [...item.contents] })) continue;
        if (!best || d < best.dist) best = { item, dist: d, app };
      }
    }

    if (!best) return;
    const result = tryHandCombine(heldSide, {
      id: best.item.id,
      contents: [...best.item.contents],
    });
    if (!result) return;

    if (best.app) {
      // Merge onto the station item (dough/plate stays on hold/pass)
      if (result.kind === "transform_held") {
        best.item.transform(result.heldId as ItemId);
        best.item.contents = result.heldContents as ItemId[];
        this.untrackWorldItem(held);
        held.destroy();
        this.player.held = null;
      } else if (result.kind === "mutate_other_plate") {
        best.item.transform(result.otherId as ItemId);
        best.item.contents = result.otherContents as ItemId[];
        this.untrackWorldItem(held);
        held.destroy();
        this.player.held = null;
      } else {
        // Plate in hands scoops ingredient
        if (!best.app.removeItem(best.item)) return;
        this.untrackWorldItem(best.item);
        best.item.destroy();
        held.transform(result.heldId as ItemId);
        held.contents = result.heldContents as ItemId[];
        held.updateCarry(this.player.sprite, this.player.facing);
      }
      best.app.refreshParked();
    } else {
      this.untrackWorldItem(best.item);
      if (result.kind === "transform_held" || result.kind === "mutate_held_plate") {
        best.item.destroy();
        held.transform(result.heldId as ItemId);
        held.contents = result.heldContents as ItemId[];
        this.player.held = held;
        held.updateCarry(this.player.sprite, this.player.facing);
      } else {
        this.untrackWorldItem(held);
        held.destroy();
        this.player.held = null;
        best.item.transform(result.otherId as ItemId);
        best.item.contents = result.otherContents as ItemId[];
        this.trackWorldItem(best.item);
      }
    }

    this.combineCd = 280;
    this.audio.playInteract();
    this.tip(result.message);
    if (result.message.includes("Plated") || result.message.includes("Raw pizza")) {
      this.audio.playCookDone();
      this.kitchenFx.sparkBurst(px, py - 12, 8);
    }
    this.heldHud.setText(
      this.player.held ? `Hands: ${this.player.held.label}` : "Hands: empty",
    );
  }

  private findInteractTarget(): {
    kind: "item" | "appliance" | "customer";
    prompt: string;
    x: number;
    y: number;
    item?: ItemEntity;
    appliance?: Appliance;
    customer?: Customer;
  } | null {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    {
      const customer = this.customers.nearest(px, py, CUSTOMER_RANGE);
      if (customer) {
        const held = this.player.held;
        if (held && this.isServableMeal(held, customer)) {
          const match =
            held.id === customer.order.id ||
            (held.id === "fries" && customer.order.id === "fries_meal");
          return {
            kind: "customer",
            prompt: match
              ? `E · Serve ${customer.order.name}`
              : `E · Wrong dish (wants ${customer.order.name})`,
            x: customer.x,
            y: customer.y - 70,
            customer,
          };
        }
        if (held) {
          return {
            kind: "customer",
            prompt:
              customer.phase === "waiting"
                ? "E · Take order (finish plating first)"
                : `Needs plated ${customer.order.name}`,
            x: customer.x,
            y: customer.y - 70,
            customer,
          };
        }
        if (customer.phase === "waiting") {
          return {
            kind: "customer",
            prompt: "E · Take order",
            x: customer.x,
            y: customer.y - 70,
            customer,
          };
        }
        return {
          kind: "customer",
          prompt: `Bring ${customer.order.name} · press E`,
          x: customer.x,
          y: customer.y - 70,
          customer,
        };
      }
    }

    if (!this.player.held) {
      let bestItem: ItemEntity | null = null;
      let bestDist = PICKUP_RANGE;
      for (const item of this.worldItems) {
        try {
          if (item.isCarried || item.isAnchored || item.isFlying || !item.sprite?.active) continue;
          const d = Phaser.Math.Distance.Between(px, py, item.sprite.x, item.sprite.y);
          if (d < bestDist) {
            bestDist = d;
            bestItem = item;
          }
        } catch {
          continue;
        }
      }
      if (bestItem) {
        return {
          kind: "item",
          prompt: `E · Pick ${bestItem.label}`,
          x: bestItem.sprite.x,
          y: bestItem.sprite.y - 20,
          item: bestItem,
        };
      }
    }

    let bestApp: Appliance | null = null;
    let bestAppDist = Number.POSITIVE_INFINITY;
    for (const app of this.appliances) {
      const d = Phaser.Math.Distance.Between(px, py, app.x, app.y);
      if (d <= this.applianceReach(app) && d < bestAppDist) {
        bestAppDist = d;
        bestApp = app;
      }
    }
    if (bestApp) {
      const prompt = bestApp.promptFor(this.player.held, px, py);
      if (!prompt) return null;
      return {
        kind: "appliance",
        prompt,
        x: bestApp.x,
        y: bestApp.y - 28,
        appliance: bestApp,
      };
    }

    return null;
  }

  private resolveInteract(target: {
    kind: "item" | "appliance" | "customer";
    item?: ItemEntity;
    appliance?: Appliance;
    customer?: Customer;
  }) {
    if (target.kind === "customer" && target.customer) {
      this.deliverToCustomer(target.customer);
      return;
    }

    if (target.kind === "item" && target.item && !this.player.held) {
      if (this.player.pickUp(target.item)) {
        this.audio.playPickup();
        this.tip(`Picked up ${target.item.label}`);
      }
      return;
    }

    const app = target.appliance;
    if (!app) return;

    // Return clean empty plate to the stack
    if (
      app.kind === "plates" &&
      this.player.held?.id === "plate" &&
      this.player.held.contents.length === 0
    ) {
      const plate = this.player.held;
      this.player.held = null;
      app.restockPlate();
      plate.destroy();
      this.audio.playInteract();
      this.tip(`Returned plate (${app.plateStock} left)`);
      return;
    }

    // Oven: plate a cooked pizza with an empty plate in hand
    if (app.canPlatePizza(this.player.held)) {
      const plate = this.player.held!;
      try {
        const cooked = app.held;
        if (cooked) this.untrackWorldItem(cooked);
        const pizza = app.platePizzaFromOven(plate);
        if (pizza) {
          // Keep plated pizza in hands
          if (!this.player.held) this.player.pickUp(pizza);
          this.untrackWorldItem(pizza);
          this.audio.playCookDone();
          this.tip("Pizza plated! Deliver to customer");
          this.kitchenFx.sparkBurst(app.x, app.y - 10, 6);
        }
      } catch (err) {
        console.error("[kitchen] plate pizza failed", err);
        if (!this.player.held) this.player.held = plate;
        this.tip("Couldn't plate pizza — try again");
      }
      return;
    }

    // Holding chopped tomato / mozzarella (or any ingredient) → put straight on a new plate
    if (app.kind === "plates" && this.player.held && app.canPlateIngredient(this.player.held)) {
      const ingredient = this.player.held;
      const label = ingredient.label;
      this.player.held = null;
      const plate = app.plateIngredient(this, ingredient);
      if (plate && this.player.pickUp(plate)) {
        this.trackWorldItem(plate);
        this.audio.playInteract();
        if (plate.isDish) {
          this.tip(`Plated ${plate.label}! Deliver to customer`);
          this.audio.playCookDone();
        } else {
          this.tip(`Plate + ${label}`);
        }
      } else if (plate) {
        this.trackWorldItem(plate);
      } else {
        this.player.held = ingredient;
        this.tip("No plates left — wash dirty ones");
      }
      return;
    }

    if (app.isDispenser && !this.player.held) {
      const item = app.dispense(this);
      if (item && this.player.pickUp(item)) {
        this.trackWorldItem(item);
        this.audio.playPickup();
        this.tip(`Took ${item.label}`);
      } else if (app.kind === "plates") {
        this.tip("No plates left — wash dirty ones at the sink");
      }
      return;
    }

    if (!this.player.held && app.held && (app.kind === "prep" || app.kind === "sink")) {
      const started = app.startManualProcess();
      if (started) {
        this.audio.playInteract();
        this.tip(started);
        return;
      }
    }

    if (!this.player.held && app.held) {
      const item = app.take({
        px: this.player.sprite.x,
        py: this.player.sprite.y,
      });
      if (item && this.player.pickUp(item)) {
        this.untrackWorldItem(item);
        this.audio.playPickup();
        this.tip(
          app.kind === "pass" && app.capacity > 1
            ? `Took ${item.label} from pass`
            : `Took ${item.label}`,
        );
      }
      return;
    }

    if (this.player.held && app.canAccept(this.player.held)) {
      const item = this.player.held;
      this.player.held = null;
      const beforeActive = item.sprite.active;
      const toppingPizza =
        item.id === "pizza_dough" ||
        item.id === "tomato" ||
        item.id === "tomato_washed" ||
        item.id === "tomato_chopped";
      if (app.place(item)) {
        // Plate that scooped an ingredient stays in hands
        if (item.sprite.active && !item.isAnchored) {
          this.player.pickUp(item);
        } else if (item.sprite.active && item.isAnchored) {
          // Parked on a station — not a free floor item
          this.untrackWorldItem(item);
        } else if (item.sprite.active) {
          this.trackWorldItem(item);
        }
        this.audio.playInteract();
        if (app.kind === "trash") {
          const burned = item.id.includes("burned");
          this.tip(burned ? "Threw burned food in the trash" : "Trashed item");
          this.kitchenFx.sparkBurst(app.x, app.y - 10, burned ? 10 : 4);
        } else if (toppingPizza && app.held?.id === "pizza_raw") {
          this.tip("Raw pizza ready — take it to the Oven");
          this.audio.playCookDone();
          this.kitchenFx.sparkBurst(app.x, app.y - 10, 8);
        } else if (app.kind === "oven") {
          this.tip("Baking pizza… grab a plate while you wait");
        } else if (app.held?.isDish) {
          this.tip(`Plated ${app.held.label}! Deliver to customer`);
          this.audio.playCookDone();
        } else if (item.sprite.active && item.isDish) {
          this.tip(`Plated ${item.label}! Deliver to customer`);
          this.audio.playCookDone();
        } else if (!beforeActive || !item.sprite.active) {
          this.tip("Added to plate");
        } else if (app.kind === "pass") {
          this.tip(`Parked on pass (${app.parked.length}/3)`);
        } else if (app.kind === "counter") {
          this.tip(`Parked on hold spot`);
        } else {
          this.tip(`Placed ${item.label} on ${app.def.label}`);
        }
        this.cameras.main.shake(50, 0.002);
      } else {
        this.player.held = item;
      }
    }
  }

  /** Take order if needed, then serve a finished dish. Works with E or Q when nearby. */
  private deliverToCustomer(customer: Customer) {
    const dish = this.player.held;

    if (customer.phase === "waiting") {
      if (!dish || !this.isServableMeal(dish, customer)) {
        if (customer.takeOrder()) {
          this.audio.playInteract();
          this.tip(`Order: ${customer.order.name} — cook it, then bring it back with E`);
        }
        return;
      }
      // Holding the meal already — take order then serve in one press
      customer.takeOrder();
    }

    if (!dish) {
      this.tip(`Bring ${customer.order.name}, then press E to serve`);
      return;
    }

    if (!this.isServableMeal(dish, customer)) {
      if (dish.id.includes("burned")) {
        this.tip("That’s burned — throw it in the TRASH");
        return;
      }
      this.tip("Put the food on a plate until it becomes a finished meal");
      return;
    }

    // Loose fries count as fries meal
    if (dish.id === "fries" && customer.order.id === "fries_meal") {
      dish.transform("fries_meal");
    }

    this.serveCustomer(customer);
  }

  private isServableMeal(item: ItemEntity, customer: Customer): boolean {
    if (item.isDish) return true;
    return item.id === "fries" && customer.order.id === "fries_meal";
  }

  private serveCustomer(customer: Customer) {
    const dish = this.player.held;
    if (!dish) return;
    if (dish.id === "fries" && customer.order.id === "fries_meal") {
      dish.transform("fries_meal");
    }
    if (!dish.isDish) return;

    const result = customer.tryServe(dish.id);
    if (!result.ok) {
      if (result.reason === "wrong") {
        this.scoring.registerWrongServe();
        this.refreshScoreHud();
      }
      this.audio.playWrong();
      this.tip(
        result.reason === "wrong"
          ? `Wrong order! Combo broken · wants ${customer.order.name}`
          : result.reason === "no_order"
            ? "Take their order first (E)"
            : "Customer is leaving…",
      );
      return;
    }

    this.player.held = null;
    const awarded = this.scoring.registerServe(result.points, result.tip);
    this.refreshScoreHud();
    const starStr = "★".repeat(result.stars) + "☆".repeat(3 - result.stars);
    const lines = [
      `✔ +${awarded} coins`,
      result.stars === 3 ? "⭐ Perfect!" : starStr,
      result.tip > 0 ? `💰 Tip +${result.tip}` : "",
      this.scoring.combo >= 2 ? `✨ Combo ×${this.scoring.combo}` : "",
    ].filter(Boolean);
    this.floatFeedback(customer.x, customer.y - 40, lines);
    this.tip(
      `${result.vip ? "VIP! " : ""}Served ${customer.order.name}` +
        (this.scoring.combo >= 2 ? ` · combo ${this.scoring.combo}` : ""),
    );
    this.audio.playServe();
    this.audio.playCoin();
    this.audio.playLaugh();
    this.kitchenFx.coinBurst(customer.x, customer.y - 20);
    this.kitchenFx.sparkBurst(customer.x, customer.y - 10, 8);
    this.cameras.main.shake(120, 0.007);
    this.cameras.main.zoomTo(1.04, 160);
    this.time.delayedCall(280, () => {
      if (!this.ended) this.cameras.main.zoomTo(1, 360);
    });

    dish.transform("dirty_plate");
    dish.detachAt(this.player.sprite.x, this.player.sprite.y + 12);
    this.trackWorldItem(dish);
  }

  private updateAuthority(delta: number) {
    const kb = this.input.keyboard;
    let ax = 0;
    let ay = 0;
    if (kb) {
      // Reuse keys — never re-add every frame (that can break input)
      const A = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A, false);
      const D = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D, false);
      const W = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W, false);
      const S = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S, false);
      const L = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false);
      const R = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false);
      const U = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP, false);
      const Dn = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, false);
      if (A.isDown || L.isDown) ax -= 1;
      if (D.isDown || R.isDown) ax += 1;
      if (W.isDown || U.isDown) ay -= 1;
      if (S.isDown || Dn.isDown) ay += 1;
    }
    const sprint = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false).isDown ?? false;
    const interact = this.interactKey
      ? Phaser.Input.Keyboard.JustDown(this.interactKey)
      : false;
    const drop = this.dropKey ? Phaser.Input.Keyboard.JustDown(this.dropKey) : false;

    let facing: "down" | "left" | "right" | "up" | undefined;
    if (Math.abs(ax) > Math.abs(ay) && ax !== 0) facing = ax < 0 ? "left" : "right";
    else if (ay !== 0) facing = ay < 0 ? "up" : "down";

    this.mp?.sendInput?.({ ax, ay, sprint, interact, drop, facing });

    const snap = this.mp?.getSnapshot?.() ?? null;
    if (snap) {
      try {
        this.applyAuthoritySnapshot(snap);
      } catch (err) {
        console.error("[kitchen] authority snapshot apply failed", err);
      }
      // Server owns position — don't let arcade velocity fight teleports
      this.player.sprite.setVelocity(0, 0);
    } else {
      // No snapshot yet / connection hiccup — keep local control so we never soft-lock
      this.player.update();
    }

    this.localNameLabel?.setPosition(this.player.sprite.x, this.player.sprite.y - 34);
    this.audio.playStep(delta, Math.hypot(ax, ay) > 0.05 || this.player.moving);
    this.kitchenFx.update(delta);
    this.updateStationGlow();

    try {
      const target = this.findInteractTarget();
      if (target) {
        this.promptLabel.setText(target.prompt);
        this.prompt.setVisible(true);
        this.prompt.setPosition(target.x, target.y);
      } else {
        this.prompt.setVisible(false);
      }
    } catch (err) {
      console.error("[kitchen] prompt failed", err);
      this.prompt.setVisible(false);
    }

    if (snap?.ended && !this.ended) {
      this.finishAuthorityMatch(snap);
    }
  }

  private applyAuthoritySnapshot(snap: KitchenSnapshot) {
    if (snap.seq === this.lastSnapSeq) return;
    this.lastSnapSeq = snap.seq;

    this.scoring.score = snap.score;
    this.scoring.served = snap.served;
    this.scoring.walkouts = snap.walkouts;
    this.scoring.tips = snap.tips;
    this.scoring.burns = snap.burns;
    this.scoring.combo = snap.combo;
    this.scoring.timeLeft = snap.timeLeft;
    this.refreshScoreHud();
    this.syncTimerHud();

    const self = snap.players.find((p) => p.id === this.mp?.localId);
    if (self) {
      this.player.sprite.setPosition(self.x, self.y);
      this.player.facing = self.facing;
      this.heldHud.setText(self.held ? `Hands: ${self.held.id}` : "Hands: empty");
      if (self.held && self.held.id in ITEMS) {
        const want = self.held.id as ItemId;
        if (!this.player.held || this.player.held.id !== want) {
          this.player.held?.destroy();
          const ent = new ItemEntity(this, want, self.x, self.y - 18);
          ent.attachTo(this.player.sprite);
          this.player.held = ent;
        } else {
          this.player.held.updateCarry(this.player.sprite, self.facing);
        }
      } else if (this.player.held) {
        this.player.held.destroy();
        this.player.held = null;
      }
    }

    // Remotes
    const seen = new Set<string>();
    for (const p of snap.players) {
      if (p.id === this.mp?.localId) continue;
      seen.add(p.id);
      let chef = this.remotes.get(p.id);
      if (!chef) {
        chef = new RemoteChef(this, p.id, p.x, p.y, p.displayName, p.avatarHue);
        this.remotes.set(p.id, chef);
      }
      chef.apply({
        id: p.id,
        x: p.x,
        y: p.y,
        facing: p.facing,
        moving: p.moving,
        sprinting: p.sprinting,
        heldLabel: p.held?.id ?? null,
      });
    }
    for (const [id, chef] of [...this.remotes]) {
      if (seen.has(id)) continue;
      chef.destroy();
      this.remotes.delete(id);
    }

    // World items
    const worldSeen = new Set<string>();
    for (const it of snap.worldItems) {
      if (!(it.id in ITEMS)) continue;
      worldSeen.add(it.uid);
      let ent = this.authWorld.get(it.uid);
      if (!ent || !ent.sprite?.active) {
        ent = new ItemEntity(this, it.id as ItemId, it.x, it.y);
        this.authWorld.set(it.uid, ent);
        this.trackWorldItem(ent);
      } else if (ent.id !== it.id) {
        ent.transform(it.id as ItemId);
      }
      ent.sprite.setPosition(it.x, it.y);
    }
    for (const [uid, ent] of [...this.authWorld]) {
      if (worldSeen.has(uid)) continue;
      ent.destroy();
      this.authWorld.delete(uid);
      this.worldItems = this.worldItems.filter((w) => w !== ent);
    }

    // Customers
    const custSeen = new Set<number>();
    for (const c of snap.customers) {
      custSeen.add(c.seatId);
      let vis = this.authCustomers.get(c.seatId);
      if (!vis) {
        const body = this.add
          .image(0, 0, c.vip ? "customer_vip" : "customer")
          .setOrigin(0.5, 0.85)
          .setScale(1.2);
        const bubble = this.add
          .text(0, -70, c.orderName, {
            fontFamily: "Sora, sans-serif",
            fontSize: "11px",
            color: "#bf360c",
            backgroundColor: "#fffde7",
            padding: { x: 5, y: 3 },
            fontStyle: "bold",
          })
          .setOrigin(0.5);
        const root = this.add.container(c.x, c.y, [body, bubble]).setDepth(12);
        vis = { root, bubble };
        this.authCustomers.set(c.seatId, vis);
      }
      vis.root.setPosition(c.x, c.y);
      vis.bubble.setText(
        c.phase === "ordered" ? c.orderName : c.phase === "entering" ? "…" : "",
      );
      vis.bubble.setVisible(c.phase === "ordered" || c.phase === "entering");
    }
    for (const [seatId, vis] of [...this.authCustomers]) {
      if (custSeen.has(seatId)) continue;
      vis.root.destroy(true);
      this.authCustomers.delete(seatId);
    }

    // Stations (pass / hold / cookers) — must sync or parked items vanish in co-op
    for (const na of snap.appliances ?? []) {
      const app = this.appliances.find((a) => a.def.id === na.id);
      if (!app) continue;
      try {
        app.reconcileNet(this, na.items ?? [], na.process, na.plateStock);
      } catch (err) {
        console.error("[kitchen] appliance reconcile failed", na.id, err);
      }
    }
  }

  private finishAuthorityMatch(snap: KitchenSnapshot) {
    if (this.ended) return;
    this.ended = true;
    this.scoring.score = snap.score;
    this.scoring.served = snap.served;
    this.scoring.walkouts = snap.walkouts;
    this.scoring.tips = snap.tips;
    this.scoring.burns = snap.burns;
    this.scoring.ended = true;
    this.tip("Kitchen closed!");
    this.audio.playServe();
    this.time.delayedCall(600, () => {
      this.scene.start("results", { result: this.scoring.snapshot() });
    });
  }

  private syncMultiplayer(delta: number) {
    if (!this.mp) return;
    const peers = this.mp.getPeers?.() ?? this.mp.peers;

    this.netAcc += delta;
    if (this.netAcc >= NET_SEND_MS) {
      this.netAcc = 0;
      this.mp.sendState({
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        facing: this.player.facing,
        moving: this.player.moving,
        sprinting: this.player.sprinting,
        heldLabel: this.player.held?.label ?? null,
      });
    }

    const remotes = this.mp.getRemotes();
    for (const [id, state] of Object.entries(remotes)) {
      if (id === this.mp.localId) continue;
      let chef = this.remotes.get(id);
      if (!chef) {
        const peer = peers.find((p) => p.id === id);
        chef = new RemoteChef(
          this,
          id,
          state.x,
          state.y,
          peer?.displayName ?? "Chef",
          peer?.avatarHue ?? 140,
        );
        this.remotes.set(id, chef);
      }
      chef.apply(state);
    }

    for (const [id, chef] of [...this.remotes]) {
      if (peers.some((p) => p.id === id)) continue;
      chef.destroy();
      this.remotes.delete(id);
    }
  }

  private cleanup() {
    for (const chef of this.remotes.values()) chef.destroy();
    this.remotes.clear();
    this.localNameLabel?.destroy();
    this.localNameLabel = null;
    this.customers?.destroy();
    this.kitchenFx?.destroy();
    this.audio?.destroy();
  }
}
