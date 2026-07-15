import Phaser from "phaser";
import { AudioManager } from "../audio/AudioManager";
import { Appliance } from "../entities/Appliance";
import { BuffetCustomer, BuffetCustomerManager } from "../entities/BuffetCustomer";
import { BuffetTray } from "../entities/BuffetTray";
import { Player } from "../entities/Player";
import { ItemEntity } from "../items/ItemEntity";
import { BUFFET_GUIDES } from "../items/buffetRecipes";
import { APPLIANCE_RANGE, ITEMS, PANTRY_RANGE, PICKUP_RANGE } from "../items/types";
import { getMap, MAP_H, MAP_W, type MapDef } from "../maps/catalog";
import { calcStars, ScoreManager } from "../systems/ScoreManager";
import { KitchenFx } from "../systems/KitchenFx";
import { generateGameAssets } from "../assets/generateAssets";

const CUSTOMER_RANGE = 90;

/**
 * Buffet mode: stock trays, hand plates to groups, wash loop, optional juice.
 */
export class BuffetScene extends Phaser.Scene {
  private mapDef!: MapDef;
  private player!: Player;
  private appliances: Appliance[] = [];
  private trays: BuffetTray[] = [];
  private customers!: BuffetCustomerManager;
  private scoring!: ScoreManager;
  private audio!: AudioManager;
  private kitchenFx!: KitchenFx;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private itemGroup!: Phaser.Physics.Arcade.Group;
  private worldItems: ItemEntity[] = [];

  private interactKey?: Phaser.Input.Keyboard.Key;
  private dropKey?: Phaser.Input.Keyboard.Key;
  private pauseKey?: Phaser.Input.Keyboard.Key;
  private helpKey?: Phaser.Input.Keyboard.Key;

  private paused = false;
  private helpVisible = false;
  private ended = false;

  private prompt!: Phaser.GameObjects.Container;
  private promptLabel!: Phaser.GameObjects.Text;
  private heldHud!: Phaser.GameObjects.Text;
  private scoreHud!: Phaser.GameObjects.Text;
  private timerHud!: Phaser.GameObjects.Text;
  private ratingHud!: Phaser.GameObjects.Text;
  private comboHud!: Phaser.GameObjects.Text;
  private hudHint!: Phaser.GameObjects.Text;
  private waveHud!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayBody!: Phaser.GameObjects.Text;
  private stationGlow!: Phaser.GameObjects.Graphics;

  constructor() {
    super("buffet");
  }

  create() {
    this.ended = false;
    this.paused = false;
    this.helpVisible = false;
    this.worldItems = [];
    this.appliances = [];
    this.trays = [];

    this.mapDef = getMap(this.registry.get("mapId") as string | undefined);
    this.scoring = new ScoreManager(this.mapDef.matchSeconds);
    this.audio = new AudioManager();
    const prefs = this.registry.get("audioPrefs") as
      | { masterVolume: number; sfxVolume: number }
      | undefined;
    if (prefs) this.audio.applyPrefs(prefs.masterVolume, prefs.sfxVolume);
    this.audio.playBoot();

    try {
      // Assets/backdrop already built in Preload — only rebuild if missing.
      if (!this.textures.exists("player")) generateGameAssets(this);
      if (!this.textures.exists(this.mapDef.bgKey)) this.mapDef.paint(this);
    } catch (err) {
      console.error("[buffet] asset rebuild failed", err);
    }

    if (!this.textures.exists(this.mapDef.bgKey)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xc4a574);
      g.fillRect(0, 0, MAP_W, MAP_H);
      g.generateTexture(this.mapDef.bgKey, MAP_W, MAP_H);
      g.destroy();
    }

    this.add.image(0, 0, this.mapDef.bgKey).setOrigin(0, 0).setDepth(0);
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBackgroundColor("#c4a574");

    this.solids = this.physics.add.staticGroup();
    for (const c of this.mapDef.colliders) {
      const wall = this.add.rectangle(c.x, c.y, c.w, c.h, 0x000000, 0);
      this.physics.add.existing(wall, true);
      this.solids.add(wall);
    }

    this.player = new Player(this, this.mapDef.spawn.x, this.mapDef.spawn.y);
    this.player.sprite.setScale(1.35);
    this.physics.add.collider(this.player.sprite, this.solids);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    this.itemGroup = this.physics.add.group();
    this.physics.add.collider(this.itemGroup, this.solids);

    this.appliances = this.mapDef.appliances.map((def) => new Appliance(this, def));
    this.kitchenFx = new KitchenFx(this);
    this.kitchenFx.bindAppliances(this.appliances);
    this.stationGlow = this.add.graphics().setDepth(5);

    for (const a of this.appliances) {
      if (a.kind === "plates") {
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
      } else if (a.kind === "pantry" && a.def.label) {
        this.add
          .text(a.x, a.y + 22, a.def.label.slice(0, 8), {
            fontFamily: "Sora, sans-serif",
            fontSize: "9px",
            color: "#2b1d14",
            backgroundColor: "#fffde7cc",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5)
          .setDepth(8);
      } else if (a.kind === "flour") {
        this.add
          .text(a.x, a.y + 22, "Flour", {
            fontFamily: "Sora, sans-serif",
            fontSize: "10px",
            color: "#5d4037",
            backgroundColor: "#fff8e1",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5)
          .setDepth(8);
      } else if (a.kind === "grill_panel") {
        this.add
          .text(a.x, a.y + 22, a.def.label, {
            fontFamily: "Sora, sans-serif",
            fontSize: "9px",
            color: "#bf360c",
            backgroundColor: "#ffebee",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5)
          .setDepth(8);
      }
    }

    for (const def of this.mapDef.buffetTrays ?? []) {
      this.trays.push(new BuffetTray(this, def));
    }

    // Seed removable pans on both grill slots
    for (const a of this.appliances) {
      if (a.kind === "grill_panel") {
        const pan = new ItemEntity(this, "grill_pan", a.x, a.y - 8);
        this.trackWorldItem(pan);
        a.place(pan);
      }
    }

    this.customers = new BuffetCustomerManager(
      this,
      this.mapDef.seats,
      this.mapDef.door,
    );

    this.buildHud();
    this.buildRecipeRibbon();
    this.buildOverlay();

    // Prep window so trays can be stocked before the first wave
    this.tip("Prep time! Stock the buffet — guests arrive soon");
    this.time.delayedCall(12000, () => {
      if (this.ended) return;
      this.customers.spawnFirstGroup();
      this.tip("Group arriving — hand out clean plates!");
    });

    const kb = this.input.keyboard;
    if (kb) {
      this.interactKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.dropKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.pauseKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this.helpKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    } else {
      console.warn("[buffet] No keyboard — click the game canvas, then use WASD/E");
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private buildHud() {
    this.scoreHud = this.add
      .text(12, 10, "💰 0", {
        fontFamily: "Sora, sans-serif",
        fontSize: "16px",
        color: "#fff8e1",
        backgroundColor: "#00695c",
        padding: { x: 10, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(51);

    this.timerHud = this.add
      .text(this.scale.width / 2, 10, "3:00", {
        fontFamily: "Sora, sans-serif",
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#263238",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(51);

    this.ratingHud = this.add
      .text(this.scale.width - 12, 10, "☆☆☆☆☆", {
        fontFamily: "Sora, sans-serif",
        fontSize: "14px",
        color: "#ffd54f",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(51);

    this.comboHud = this.add
      .text(12, 48, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "12px",
        color: "#fff8e1",
        backgroundColor: "#00897b",
        padding: { x: 8, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(51)
      .setVisible(false);

    this.heldHud = this.add
      .text(12, 48, "Hands: empty", {
        fontFamily: "Sora, sans-serif",
        fontSize: "12px",
        color: "#2b1d14",
        backgroundColor: "#ffffffee",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(51);

    this.waveHud = this.add
      .text(12, 78, "Wave 1 · Group arriving", {
        fontFamily: "Sora, sans-serif",
        fontSize: "11px",
        color: "#004d40",
        backgroundColor: "#e0f2f1",
        padding: { x: 6, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(51);

    this.hudHint = this.add
      .text(this.scale.width / 2, 48, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "13px",
        color: "#004d40",
        backgroundColor: "#e0f2f1ee",
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(52)
      .setVisible(false);

    this.promptLabel = this.add
      .text(0, 0, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "12px",
        color: "#004d40",
        backgroundColor: "#ffffff",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);
    this.prompt = this.add.container(0, 0, [this.promptLabel]).setDepth(40).setVisible(false);

    this.add
      .text(this.scale.width - 12, 36, "❚❚", {
        fontFamily: "Sora, sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#455a64",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(51)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.paused = !this.paused;
        this.refreshOverlay();
      });
  }

  private buildRecipeRibbon() {
    const { width, height } = this.scale;
    const guides = BUFFET_GUIDES;
    const badgeGap = 88;
    const barW = Math.max(340, guides.length * badgeGap + 100);
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

    const startX = width / 2 - ((guides.length - 1) * badgeGap) / 2 + 18;
    guides.forEach((g, i) => {
      const cx = startX + i * badgeGap;
      const cy = barY + 23;
      const tex = ITEMS[g.icon]?.texture;

      const badge = this.add.graphics().setScrollFactor(0).setDepth(51);
      badge.fillStyle(0xffffff, 1);
      badge.fillCircle(cx, cy, 18);
      badge.lineStyle(3, 0x2b1d14, 1);
      badge.strokeCircle(cx, cy, 18);

      if (tex && this.textures.exists(tex)) {
        const icon = this.add
          .image(cx, cy, tex)
          .setScrollFactor(0)
          .setDepth(52)
          .setScale(1.15)
          .setInteractive({
            hitArea: new Phaser.Geom.Circle(0, 0, 22),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            useHandCursor: true,
          });
        const card = this.add
          .text(cx, barY - 8, `${g.name}\n${g.howTo}`, {
            fontFamily: "Sora, sans-serif",
            fontSize: "10px",
            color: "#2b1d14",
            backgroundColor: "#fffde7",
            padding: { x: 8, y: 6 },
            align: "left",
          })
          .setOrigin(0.5, 1)
          .setScrollFactor(0)
          .setDepth(55)
          .setVisible(false);
        icon.on("pointerover", () => card.setVisible(true));
        icon.on("pointerout", () => card.setVisible(false));
      }
    });
  }

  private buildOverlay() {
    this.overlayTitle = this.add
      .text(0, -40, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "22px",
        color: "#fff8e1",
      })
      .setOrigin(0.5);
    this.overlayBody = this.add
      .text(0, 20, "", {
        fontFamily: "Sora, sans-serif",
        fontSize: "13px",
        color: "#cfd8dc",
        align: "center",
      })
      .setOrigin(0.5);
    const bg = this.add.rectangle(0, 0, 420, 200, 0x004d40, 0.94);
    this.overlay = this.add
      .container(this.scale.width / 2, this.scale.height / 2, [
        bg,
        this.overlayTitle,
        this.overlayBody,
      ])
      .setScrollFactor(0)
      .setDepth(60)
      .setVisible(false);
  }

  private refreshOverlay() {
    if (this.paused) {
      this.overlay.setVisible(true);
      this.overlayTitle.setText("Paused");
      this.overlayBody.setText(
        "Esc to resume · H for controls\nHand plates · stock trays · wash dirty plates",
      );
    } else if (this.helpVisible) {
      this.overlay.setVisible(true);
      this.overlayTitle.setText("Buffet controls");
      this.overlayBody.setText(
        "WASD move · E interact · Q drop\n1) Stock trays  2) Hand plates to guests\n3) Wash dirty plates  4) Serve juice requests",
      );
    } else {
      this.overlay.setVisible(false);
    }
  }

  update(_t: number, delta: number) {
    if (this.pauseKey && Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
      this.paused = !this.paused;
      this.helpVisible = false;
      this.refreshOverlay();
    }
    if (this.helpKey && Phaser.Input.Keyboard.JustDown(this.helpKey)) {
      this.helpVisible = !this.helpVisible;
      if (this.helpVisible) this.paused = false;
      this.refreshOverlay();
    }
    if (this.paused || this.helpVisible) {
      this.player.sprite.setVelocity(0, 0);
      return;
    }
    if (this.ended) return;

    this.scoring.tick(delta / 1000);
    if (this.scoring.isClosing) this.customers.setSpawning(false);
    if (this.scoring.ended && !this.ended) {
      this.finishMatch();
      return;
    }

    this.player.update();
    this.audio.playStep(delta, this.player.moving);
    this.heldHud.setText(
      this.player.held ? `Hands: ${this.player.held.label}` : "Hands: empty",
    );
    this.kitchenFx.update(delta);
    this.updateStationGlow();
    this.syncTimerHud();
    this.waveHud.setText(`Wave ${this.customers.waveIndex || 1} · Guests ${this.customers.activeCount}`);

    for (const app of this.appliances) {
      const msg = app.update(delta);
      if (msg) {
        this.tip(msg);
        if (msg.includes("Burned")) {
          this.audio.playBurn();
          this.scoring.registerBurn();
        } else if (msg.includes("ready")) {
          this.audio.playCookDone();
        } else if (msg.includes("Chopped")) this.audio.playChop();
        else if (msg.includes("Washed") || msg.includes("Floured")) this.audio.playWash();
      }
    }

    const { walkouts, finished } = this.customers.update(delta, this.trays);
    if (walkouts > 0) {
      this.scoring.registerWalkout();
      this.audio.playWalkout();
      this.tip("A guest left unhappy!");
      this.refreshScoreHud();
    }
    for (const f of finished) {
      const { points, tip, stars } = f.customer.scorePoints();
      this.scoring.registerServe(points, tip);
      this.audio.playServe();
      this.floatFeedback(f.dirtySeat.x, f.dirtySeat.y - 40, [
        `+${points}`,
        `${"★".repeat(stars)}`,
      ]);
      const dirty = new ItemEntity(this, "dirty_plate", f.dirtySeat.x, f.dirtySeat.y + 8);
      this.trackWorldItem(dirty);
      this.tip("Dirty plate left behind — wash it!");
      this.refreshScoreHud();
    }

    if (this.dropKey && Phaser.Input.Keyboard.JustDown(this.dropKey)) {
      const dropped = this.player.drop();
      if (dropped) {
        this.trackWorldItem(dropped);
        this.audio.playDrop();
      }
    }

    const target = this.findInteractTarget();
    if (target) {
      this.prompt.setVisible(true);
      this.prompt.setPosition(target.x, target.y);
      this.promptLabel.setText(target.prompt);
      if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.resolveInteract(target);
      }
    } else {
      this.prompt.setVisible(false);
    }
  }

  private applianceReach(app: Appliance): number {
    return app.kind === "pantry" || app.kind === "plates" || app.kind === "flour"
      ? PANTRY_RANGE
      : APPLIANCE_RANGE;
  }

  private updateStationGlow() {
    this.stationGlow.clear();
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    let best: { x: number; y: number } | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const app of this.appliances) {
      const d = Phaser.Math.Distance.Between(px, py, app.x, app.y);
      if (d <= this.applianceReach(app) && d < bestD) {
        bestD = d;
        best = app;
      }
    }
    for (const tray of this.trays) {
      const d = Phaser.Math.Distance.Between(px, py, tray.x, tray.y);
      if (d <= APPLIANCE_RANGE + 20 && d < bestD) {
        bestD = d;
        best = tray;
      }
    }
    if (!best) return;
    const pulse = 0.35 + Math.sin(this.time.now / 180) * 0.15;
    this.stationGlow.lineStyle(4, 0x80cbc4, pulse);
    this.stationGlow.strokeCircle(best.x, best.y + 6, 22);
  }

  private findInteractTarget(): {
    kind: "item" | "appliance" | "tray" | "customer";
    prompt: string;
    x: number;
    y: number;
    item?: ItemEntity;
    appliance?: Appliance;
    tray?: BuffetTray;
    customer?: BuffetCustomer;
  } | null {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const held = this.player.held;

    // Hand plate / serve juice
    if (held?.id === "plate" && held.contents.length === 0) {
      const c = this.customers.nearestNeedPlate(px, py, CUSTOMER_RANGE);
      if (c) {
        return {
          kind: "customer",
          prompt: "E · Give clean plate",
          x: c.x,
          y: c.y - 70,
          customer: c,
        };
      }
    }
    if (held?.id === "juice") {
      const c = this.customers.nearestWantJuice(px, py, CUSTOMER_RANGE);
      if (c) {
        return {
          kind: "customer",
          prompt: "E · Serve juice",
          x: c.x,
          y: c.y - 70,
          customer: c,
        };
      }
    }

    if (!held) {
      let bestItem: ItemEntity | null = null;
      let bestDist = PICKUP_RANGE;
      for (const item of this.worldItems) {
        if (item.isCarried || item.isAnchored || item.isFlying || !item.sprite.active) continue;
        const d = Phaser.Math.Distance.Between(px, py, item.sprite.x, item.sprite.y);
        if (d < bestDist) {
          bestDist = d;
          bestItem = item;
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

    // Trays
    let bestTray: BuffetTray | null = null;
    let bestTrayD = APPLIANCE_RANGE + 24;
    for (const tray of this.trays) {
      const d = Phaser.Math.Distance.Between(px, py, tray.x, tray.y);
      if (d < bestTrayD) {
        bestTrayD = d;
        bestTray = tray;
      }
    }
    if (bestTray) {
      const prompt = bestTray.promptFor(held);
      if (
        prompt &&
        held &&
        (held.id === bestTray.accepts ||
          (held.isGrillPan && held.panFood === bestTray.accepts))
      ) {
        return {
          kind: "tray",
          prompt,
          x: bestTray.x,
          y: bestTray.y - 28,
          tray: bestTray,
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
      const prompt = bestApp.promptFor(held);
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
    kind: "item" | "appliance" | "tray" | "customer";
    item?: ItemEntity;
    appliance?: Appliance;
    tray?: BuffetTray;
    customer?: BuffetCustomer;
  }) {
    if (target.kind === "customer" && target.customer) {
      const c = target.customer;
      if (this.player.held?.id === "plate" && c.givePlate()) {
        this.player.held.destroy();
        this.player.held = null;
        this.audio.playInteract();
        this.tip("Plate handed — guest heads to the buffet");
        return;
      }
      if (this.player.held?.id === "juice" && c.serveJuice()) {
        this.player.held.destroy();
        this.player.held = null;
        this.audio.playServe();
        this.tip("Juice served!");
        this.floatFeedback(c.x, c.y - 50, ["+ Juice!"], "#00897b");
        return;
      }
    }

    if (target.kind === "tray" && target.tray && this.player.held) {
      const item = this.player.held;
      const { added, keepItem } = target.tray.stockFromHands(item);
      if (added > 0) {
        if (!keepItem) this.player.held = null;
        this.audio.playInteract();
        this.tip(`Stocked ${target.tray.def.label} (+${added})`);
      } else {
        this.tip(target.tray.isFull ? "Tray is full" : "Wrong food for this tray");
      }
      return;
    }

    if (target.kind === "item" && target.item && !this.player.held) {
      if (this.player.pickUp(target.item)) {
        this.audio.playPickup();
      }
      return;
    }

    const app = target.appliance;
    if (!app) return;

    // Return plate
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

    // Put chopped veg onto empty pan sitting on grill / prep
    if (
      this.player.held &&
      (this.player.held.id === "tomato_chopped" || this.player.held.id === "pepper_chopped") &&
      app.held?.isGrillPan &&
      app.held.contents.length === 0
    ) {
      const veg = this.player.held;
      this.player.held = null;
      if (app.place(veg)) {
        this.audio.playInteract();
        this.tip(
          app.kind === "grill_panel"
            ? "Grilling…"
            : "Veg on pan — put the pan on the grill",
        );
      } else {
        this.player.held = veg;
      }
      return;
    }

    // Flour dip while holding
    if (app.kind === "flour" && this.player.held && app.flourDipHands(this.player.held)) {
      this.audio.playWash();
      this.tip(`Floured → ${this.player.held.label}`);
      return;
    }

    if (app.isDispenser && !this.player.held) {
      const item = app.dispense(this);
      if (item && this.player.pickUp(item)) {
        this.trackWorldItem(item);
        this.audio.playPickup();
        this.tip(`Took ${item.label}`);
      } else if (app.kind === "plates") {
        this.tip("No plates — wash dirty ones at the sink");
      }
      return;
    }

    if (!this.player.held && app.held && (app.kind === "prep" || app.kind === "sink" || app.kind === "flour")) {
      const started = app.startManualProcess();
      if (started) {
        this.audio.playInteract();
        this.tip(started);
        return;
      }
    }

    if (!this.player.held && app.held) {
      const item = app.take();
      if (item && this.player.pickUp(item)) {
        this.audio.playPickup();
        this.tip(`Took ${item.label}`);
      }
      return;
    }

    if (this.player.held && app.canAccept(this.player.held)) {
      const item = this.player.held;
      this.player.held = null;
      if (app.place(item)) {
        if (item.sprite.active) this.trackWorldItem(item);
        this.audio.playInteract();
        if (app.kind === "trash") {
          this.tip("Trashed");
        } else if (app.kind === "fryer" || app.kind === "grill_panel") {
          this.tip(`Cooking on ${app.def.label}…`);
        } else if (app.kind === "flour") {
          this.tip(`Floured → ${app.held?.label ?? "done"}`);
        } else {
          this.tip(`Placed on ${app.def.label}`);
        }
      } else {
        this.player.held = item;
      }
    }
  }

  private finishMatch() {
    if (this.ended) return;
    this.ended = true;
    this.customers.setSpawning(false);
    const result = this.scoring.snapshot();
    this.tip("Buffet closed!");
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
  }

  private refreshScoreHud() {
    this.scoreHud.setText(`💰 ${this.scoring.score}`);
    const stars = calcStars({
      score: this.scoring.score,
      served: this.scoring.served,
      walkouts: this.scoring.walkouts,
      burns: this.scoring.burns,
      wrongServes: this.scoring.wrongServes,
      tips: this.scoring.tips,
      maxCombo: this.scoring.maxCombo,
    });
    this.ratingHud.setText("★".repeat(stars) + "☆".repeat(3 - stars));
    if (this.scoring.combo > 0) {
      this.comboHud.setText(`Combo ×${this.scoring.combo}`).setVisible(true);
      this.heldHud.setY(72);
      this.waveHud.setY(102);
    } else {
      this.comboHud.setVisible(false);
      this.heldHud.setY(48);
      this.waveHud.setY(78);
    }
  }

  private floatFeedback(x: number, y: number, lines: string[], color = "#00695c") {
    const t = this.add
      .text(x, y, lines.join("\n"), {
        fontFamily: "Sora, sans-serif",
        fontSize: "14px",
        color,
        fontStyle: "bold",
        align: "center",
        stroke: "#ffffff",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => t.destroy(),
    });
  }

  private tip(msg: string) {
    if (!this.hudHint) return;
    this.hudHint.setText(msg).setVisible(true);
    this.time.delayedCall(2200, () => {
      if (this.hudHint?.text === msg) this.hudHint.setVisible(false);
    });
  }

  private trackWorldItem(item: ItemEntity) {
    if (!item.sprite.active) return;
    if (!this.worldItems.includes(item)) this.worldItems.push(item);
    if (!this.itemGroup.contains(item.sprite)) this.itemGroup.add(item.sprite);
  }

  private cleanup() {
    this.customers?.destroy();
  }
}
