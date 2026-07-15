import Phaser from "phaser";
import { TILE, TileId } from "../config";
import {
  DEFAULT_CHEF_LOOK,
  REMOTE_CHEF_LOOK,
  type ChefLook,
  type HatStyle,
} from "../cosmetics/chefLook";

const OUTLINE = 0x2b1d14;
const ASSET_VER = 10;

/** Ready Set Cook reference look: thick outlines, wood + check floors, teal walls. */
export function generateGameAssets(scene: Phaser.Scene): void {
  const localLook = {
    ...DEFAULT_CHEF_LOOK,
    ...(scene.registry.get("chefLook") as Partial<ChefLook> | undefined),
  };
  const lookSig = JSON.stringify(localLook);
  if (
    scene.registry.get("assetVer") === ASSET_VER &&
    scene.textures.exists("player") &&
    scene.registry.get("chefLookSig") === lookSig
  ) {
    return;
  }

  // Drop old procedural keys so art upgrades always apply.
  for (const key of [
    "player",
    "player_b",
    "customer",
    "customer_vip",
    "prompt-bg",
    "place-ring",
    "shadow",
    "item-tomato",
    "item-tomato-washed",
    "item-tomato-chopped",
    "item-lettuce",
    "item-lettuce-washed",
    "item-lettuce-chopped",
    "item-patty",
    "item-patty-cooked",
    "item-patty-burned",
    "item-bun",
    "item-potato",
    "item-potato-washed",
    "item-fries",
    "item-fries-raw",
    "item-fries-burned",
    "item-pizza-dough",
    "item-pizza-raw",
    "item-pizza-cooked",
    "item-pizza-burned",
    "item-pizza",
    "item-tomato-grilled",
    "item-tomato-burned",
    "item-chicken-raw",
    "item-chicken-floured",
    "item-chicken-fried",
    "item-chicken-burned",
    "item-shrimp-raw",
    "item-shrimp-chopped",
    "item-shrimp-floured",
    "item-shrimp-fried",
    "item-shrimp-burned",
    "item-pepper",
    "item-pepper-chopped",
    "item-pepper-grilled",
    "item-pepper-burned",
    "item-grill-pan",
    "item-plate",
    "item-dirty-plate",
    "item-burger",
    "item-salad",
    "item-fries-meal",
    "item-juice",
    "item-ice-cream",
  ]) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const stripW = TILE * 6;
  g.clear();

  // 0 — Wood plank dining floor
  g.fillStyle(0xa67c52);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(0x8d623f);
  for (let y = 0; y < TILE; y += 8) {
    g.fillRect(0, y, TILE, 1);
  }
  g.fillStyle(0xc49a6c);
  g.fillRect(2, 2, 12, 5);
  g.fillRect(16, 10, 14, 5);
  g.fillRect(4, 18, 18, 5);
  g.lineStyle(2, OUTLINE, 0.35);
  g.strokeRect(1, 1, TILE - 2, TILE - 2);

  // 1 — Teal wall
  g.fillStyle(0x2f6f6f);
  g.fillRect(TILE, 0, TILE, TILE);
  g.fillStyle(0x3d8b8b);
  for (let row = 0; row < 4; row++) {
    const oy = row * 8 + 1;
    const ox = (row % 2) * 8;
    for (let c = 0; c < 2; c++) {
      g.fillRoundedRect(TILE + ox + c * 16 + 2, oy, 13, 6, 1);
    }
  }
  g.lineStyle(3, OUTLINE, 1);
  g.strokeRect(TILE + 1, 1, TILE - 2, TILE - 2);

  // 2 — Counter (wood top, blue tile face)
  g.fillStyle(0x5dade2);
  g.fillRect(TILE * 2, 14, TILE, TILE - 14);
  g.fillStyle(0xffffff);
  g.fillRect(TILE * 2 + 4, 16, 6, 6);
  g.fillRect(TILE * 2 + 16, 22, 6, 6);
  g.fillStyle(0xc49a6c);
  g.fillRect(TILE * 2, 0, TILE, 16);
  g.fillStyle(0xe8c9a0);
  g.fillRect(TILE * 2 + 3, 3, TILE - 6, 6);
  g.lineStyle(3, OUTLINE, 1);
  g.strokeRect(TILE * 2 + 1, 1, TILE - 2, TILE - 2);

  // 3 — Brick oven / grill with fire
  g.fillStyle(0x8d6e63);
  g.fillRect(TILE * 3, 0, TILE, TILE);
  g.fillStyle(0x6d4c41);
  for (let y = 2; y < TILE - 2; y += 7) {
    g.fillRect(TILE * 3 + 2, y, TILE - 4, 5);
  }
  g.fillStyle(0x263238);
  g.fillRoundedRect(TILE * 3 + 5, 8, TILE - 10, 14, 3);
  g.fillStyle(0xff6d00);
  g.fillCircle(TILE * 3 + 12, 16, 4);
  g.fillCircle(TILE * 3 + 20, 15, 3);
  g.fillStyle(0xffd54f);
  g.fillCircle(TILE * 3 + 12, 15, 2);
  g.fillStyle(0xffffff, 0.55);
  g.fillCircle(TILE * 3 + 10, 5, 1.5);
  g.fillCircle(TILE * 3 + 16, 3, 1);
  g.lineStyle(3, OUTLINE, 1);
  g.strokeRect(TILE * 3 + 1, 1, TILE - 2, TILE - 2);

  // 4 — Blue/white kitchen checker
  for (let y = 0; y < TILE; y += 8) {
    for (let x = 0; x < TILE; x += 8) {
      const light = (x / 8 + y / 8) % 2 === 0;
      g.fillStyle(light ? 0xe8f4fc : 0x5dade2);
      g.fillRect(TILE * 4 + x, y, 8, 8);
    }
  }
  g.lineStyle(2, OUTLINE, 0.25);
  g.strokeRect(TILE * 4 + 1, 1, TILE - 2, TILE - 2);

  // 5 — Red booth
  g.fillStyle(0xc62828);
  g.fillRect(TILE * 5, 0, TILE, TILE);
  g.fillStyle(0xe53935);
  g.fillRoundedRect(TILE * 5 + 3, 4, TILE - 6, TILE - 8, 4);
  g.fillStyle(0xb71c1c);
  g.fillRect(TILE * 5 + 3, TILE - 10, TILE - 6, 6);
  g.lineStyle(3, OUTLINE, 1);
  g.strokeRect(TILE * 5 + 1, 1, TILE - 2, TILE - 2);

  g.generateTexture("tileset", stripW, TILE);

  // --- Chefs (thick outline; local look from registry / defaults) ---
  makeChefSheet(scene, g, "player", localLook);
  makeChefSheet(scene, g, "player_b", REMOTE_CHEF_LOOK);

  // Prompt chip — green ring cue style
  g.clear();
  g.fillStyle(0xffffff, 0.95);
  g.fillRoundedRect(0, 0, 96, 24, 10);
  g.lineStyle(3, OUTLINE, 1);
  g.strokeRoundedRect(1.5, 1.5, 93, 21, 9);
  g.generateTexture("prompt-bg", 96, 24);

  // Green place marker
  g.clear();
  g.lineStyle(4, 0x69f0ae, 1);
  g.strokeCircle(16, 16, 12);
  g.lineStyle(2, 0x00c853, 0.8);
  g.strokeCircle(16, 16, 8);
  g.generateTexture("place-ring", 32, 32);

  // Items 28×28 — chunky RSC cartoon icons
  const S = 28;
  const item = (key: string, draw: () => void) => {
    g.clear();
    draw();
    g.generateTexture(key, S, S);
  };

  item("item-tomato", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 16, 11);
    g.fillStyle(0xe53935);
    g.fillCircle(14, 16, 9);
    g.fillStyle(0xff8a80);
    g.fillCircle(11, 13, 3);
    g.fillStyle(OUTLINE);
    g.fillTriangle(14, 3, 9, 11, 19, 11);
    g.fillStyle(0x43a047);
    g.fillTriangle(14, 5, 10, 10, 18, 10);
  });
  item("item-tomato-washed", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 16, 11);
    g.fillStyle(0xff5252);
    g.fillCircle(14, 16, 9);
    g.fillStyle(0x81d4fa);
    g.fillCircle(10, 12, 2.5);
    g.fillCircle(17, 14, 1.8);
    g.fillStyle(OUTLINE);
    g.fillTriangle(14, 3, 9, 11, 19, 11);
    g.fillStyle(0x66bb6a);
    g.fillTriangle(14, 5, 10, 10, 18, 10);
  });
  // Diced tomato cubes (chopped)
  item("item-tomato-chopped", () => {
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(3, 5, 10, 10, 2);
    g.fillRoundedRect(14, 4, 10, 10, 2);
    g.fillRoundedRect(8, 14, 10, 10, 2);
    g.fillStyle(0xe53935);
    g.fillRoundedRect(4, 6, 8, 8, 2);
    g.fillRoundedRect(15, 5, 8, 8, 2);
    g.fillRoundedRect(9, 15, 8, 8, 2);
    g.fillStyle(0xffcdd2);
    g.fillRect(5, 7, 3, 3);
    g.fillRect(16, 6, 3, 3);
    g.fillRect(10, 16, 3, 3);
  });
  // Whole mozzarella ball
  item("item-lettuce", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 11);
    g.fillStyle(0xfafafa);
    g.fillCircle(14, 15, 9);
    g.fillStyle(0xe0e0e0);
    g.fillCircle(14, 15, 5);
    g.fillStyle(0xffffff);
    g.fillCircle(11, 12, 2.5);
  });
  item("item-lettuce-washed", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 11);
    g.fillStyle(0xffffff);
    g.fillCircle(14, 15, 9);
    g.fillStyle(0x81d4fa);
    g.fillCircle(10, 12, 2.2);
    g.fillCircle(17, 14, 1.6);
    g.fillStyle(0xeceff1);
    g.fillCircle(14, 15, 4);
  });
  // Sliced mozzarella rounds (chopped)
  item("item-lettuce-chopped", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(9, 10, 14, 10);
    g.fillEllipse(19, 14, 14, 10);
    g.fillEllipse(12, 20, 14, 10);
    g.fillStyle(0xfafafa);
    g.fillEllipse(9, 10, 11, 7);
    g.fillEllipse(19, 14, 11, 7);
    g.fillEllipse(12, 20, 11, 7);
    g.fillStyle(0xe0e0e0);
    g.fillEllipse(9, 10, 5, 3);
    g.fillEllipse(19, 14, 5, 3);
    g.fillEllipse(12, 20, 5, 3);
  });
  item("item-patty", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 15, 22, 15);
    g.fillStyle(0xa1887f);
    g.fillEllipse(14, 15, 18, 11);
    g.fillStyle(0x8d6e63);
    g.fillEllipse(14, 15, 8, 4);
  });
  item("item-patty-cooked", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 15, 22, 15);
    g.fillStyle(0x6d4c41);
    g.fillEllipse(14, 15, 18, 11);
    g.fillStyle(0x4e342e);
    g.fillRect(7, 13, 14, 3);
    g.fillStyle(0xffab91, 0.5);
    g.fillCircle(10, 12, 2);
  });
  item("item-patty-burned", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 15, 22, 15);
    g.fillStyle(0x212121);
    g.fillEllipse(14, 15, 18, 11);
  });
  item("item-bun", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 12, 22, 16);
    g.fillStyle(0xffcc80);
    g.fillEllipse(14, 11, 18, 12);
    g.fillStyle(0xffb74d);
    g.fillEllipse(14, 16, 18, 9);
    g.fillStyle(0xffecb3);
    g.fillCircle(10, 9, 1.5);
    g.fillCircle(16, 8, 1.2);
  });
  item("item-potato", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 14, 18, 16);
    g.fillStyle(0xd7b874);
    g.fillEllipse(14, 14, 14, 12);
    g.fillStyle(0xc9a86c);
    g.fillCircle(11, 12, 2);
  });
  item("item-potato-washed", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 14, 18, 16);
    g.fillStyle(0xe6cc8a);
    g.fillEllipse(14, 14, 14, 12);
    g.fillStyle(0x81d4fa);
    g.fillCircle(17, 10, 2.2);
  });
  // Fries in a red carton (RSC style)
  item("item-fries", () => {
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(5, 12, 18, 14, 3);
    g.fillStyle(0xe53935);
    g.fillRoundedRect(6, 13, 16, 12, 2);
    g.fillStyle(0xffffff);
    g.fillRect(8, 15, 12, 3);
    // sticks sticking out
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(7, 2, 4, 14, 1);
    g.fillRoundedRect(12, 1, 4, 15, 1);
    g.fillRoundedRect(17, 3, 4, 13, 1);
    g.fillStyle(0xffc107);
    g.fillRoundedRect(8, 3, 2, 12, 1);
    g.fillRoundedRect(13, 2, 2, 13, 1);
    g.fillRoundedRect(18, 4, 2, 11, 1);
  });
  item("item-fries-burned", () => {
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(5, 12, 18, 14, 3);
    g.fillStyle(0x5d4037);
    g.fillRoundedRect(6, 13, 16, 12, 2);
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(7, 2, 4, 14, 1);
    g.fillRoundedRect(12, 1, 4, 15, 1);
    g.fillRoundedRect(17, 3, 4, 13, 1);
    g.fillStyle(0x3e2723);
    g.fillRoundedRect(8, 3, 2, 12, 1);
    g.fillRoundedRect(13, 2, 2, 13, 1);
    g.fillRoundedRect(18, 4, 2, 11, 1);
  });
  // Pizza dough (pâte)
  item("item-pizza-dough", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 15, 22, 18);
    g.fillStyle(0xffe0b2);
    g.fillEllipse(14, 15, 18, 14);
    g.fillStyle(0xfff8e1);
    g.fillEllipse(11, 12, 6, 4);
  });
  item("item-pizza-raw", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 15, 22, 18);
    g.fillStyle(0xffe0b2);
    g.fillEllipse(14, 15, 18, 14);
    g.fillStyle(0xe53935);
    g.fillEllipse(14, 15, 12, 9);
    g.fillStyle(0xffcdd2);
    g.fillCircle(10, 13, 1.5);
    g.fillCircle(16, 14, 1.5);
    g.fillCircle(13, 17, 1.2);
  });
  item("item-pizza-cooked", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 15, 22, 18);
    g.fillStyle(0xffcc80);
    g.fillEllipse(14, 15, 18, 14);
    g.fillStyle(0xd32f2f);
    g.fillEllipse(14, 15, 13, 10);
    g.fillStyle(0xfff59d);
    g.fillCircle(10, 12, 2);
    g.fillCircle(16, 13, 2);
    g.fillCircle(12, 17, 1.8);
    g.fillCircle(17, 16, 1.5);
  });
  item("item-pizza-burned", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 15, 22, 18);
    g.fillStyle(0x4e342e);
    g.fillEllipse(14, 15, 18, 14);
    g.fillStyle(0x3e2723);
    g.fillEllipse(14, 15, 12, 9);
    g.fillStyle(0x212121);
    g.fillCircle(10, 13, 1.5);
    g.fillCircle(16, 14, 1.5);
  });
  item("item-pizza", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 13);
    g.fillStyle(0xffffff);
    g.fillCircle(14, 16, 11);
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 14, 16, 12);
    g.fillStyle(0xffcc80);
    g.fillEllipse(14, 14, 13, 10);
    g.fillStyle(0xd32f2f);
    g.fillEllipse(14, 14, 10, 7);
    g.fillStyle(0xfff59d);
    g.fillCircle(11, 12, 1.6);
    g.fillCircle(16, 13, 1.6);
    g.fillCircle(13, 16, 1.4);
  });
  // Clean white plate with rim
  item("item-plate", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 12);
    g.fillStyle(0xffffff);
    g.fillCircle(14, 15, 10);
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 6);
    g.fillStyle(0xf5f5f5);
    g.fillCircle(14, 15, 4.5);
    g.fillStyle(0xffffff);
    g.fillCircle(11, 12, 2);
  });
  item("item-dirty-plate", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 12);
    g.fillStyle(0xbcaaa4);
    g.fillCircle(14, 15, 10);
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 6);
    g.fillStyle(0xa1887f);
    g.fillCircle(14, 15, 4.5);
    g.fillStyle(0x6d4c41);
    g.fillCircle(11, 13, 2);
    g.fillCircle(16, 16, 1.5);
  });
  item("item-burger", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 15, 24, 20);
    g.fillStyle(0xffcc80);
    g.fillEllipse(14, 7, 20, 9);
    g.fillStyle(0xffecb3);
    g.fillEllipse(11, 5, 6, 3);
    g.fillStyle(0x66bb6a);
    g.fillRect(5, 11, 18, 3);
    g.fillStyle(0xe53935);
    g.fillRect(6, 14, 16, 3);
    g.fillStyle(0xfafafa);
    g.fillRect(7, 17, 14, 2);
    g.fillStyle(0x6d4c41);
    g.fillEllipse(14, 20, 18, 6);
    g.fillStyle(0xffb74d);
    g.fillEllipse(14, 24, 20, 7);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(9, 6, 2);
  });
  item("item-salad", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 13);
    g.fillStyle(0xffffff);
    g.fillCircle(14, 16, 11);
    g.fillStyle(0xfafafa);
    g.fillCircle(10, 12, 5.5);
    g.fillCircle(18, 13, 5.5);
    g.fillStyle(0xff8a80);
    g.fillCircle(14, 16, 3.5);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(10, 11, 1.8);
  });
  item("item-fries-meal", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 13);
    g.fillStyle(0xffffff);
    g.fillCircle(14, 16, 11);
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(8, 7, 3.5, 14, 1);
    g.fillRoundedRect(13, 6, 3.5, 15, 1);
    g.fillRoundedRect(18, 8, 3.5, 13, 1);
    g.fillStyle(0xffc107);
    g.fillRoundedRect(8.6, 8, 2.4, 12, 1);
    g.fillRoundedRect(13.6, 7, 2.4, 13, 1);
    g.fillRoundedRect(18.6, 9, 2.4, 11, 1);
    g.fillStyle(0xffecb3);
    g.fillCircle(10, 9, 1.2);
    g.fillCircle(15, 8, 1.2);
  });
  item("item-juice", () => {
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(7, 4, 14, 20, 3);
    g.fillStyle(0xff9800);
    g.fillRoundedRect(9, 6, 10, 16, 2);
    g.fillStyle(0xffcc80);
    g.fillRoundedRect(10, 8, 4, 10, 1);
    g.fillStyle(OUTLINE);
    g.fillRect(11, 2, 6, 3);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(12, 10, 1.5);
  });
  item("item-ice-cream", () => {
    g.fillStyle(OUTLINE);
    g.fillTriangle(14, 26, 6, 12, 22, 12);
    g.fillStyle(0xffcc80);
    g.fillTriangle(14, 24, 8, 13, 20, 13);
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 10, 8);
    g.fillStyle(0xf8bbd0);
    g.fillCircle(14, 10, 6.5);
    g.fillStyle(0xfff8e1);
    g.fillCircle(14, 6, 4.5);
    g.fillStyle(0xce93d8);
    g.fillCircle(14, 3, 3);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(12, 5, 1.5);
  });

  // --- Buffet items ---
  item("item-fries-raw", () => {
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(6, 8, 16, 14, 2);
    g.fillStyle(0xd7ccc8);
    g.fillRoundedRect(7, 9, 14, 12, 2);
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(8, 4, 3, 12, 1);
    g.fillRoundedRect(13, 3, 3, 13, 1);
    g.fillRoundedRect(18, 5, 3, 11, 1);
    g.fillStyle(0xffe0b2);
    g.fillRoundedRect(8.5, 5, 2, 10, 1);
    g.fillRoundedRect(13.5, 4, 2, 11, 1);
    g.fillRoundedRect(18.5, 6, 2, 9, 1);
  });
  item("item-tomato-grilled", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 10);
    g.fillStyle(0xc62828);
    g.fillCircle(14, 15, 8);
    g.fillStyle(0xff8a65);
    g.fillCircle(11, 12, 2);
    g.fillStyle(0x5d4037);
    g.fillRect(8, 14, 12, 1.5);
    g.fillRect(9, 17, 10, 1);
  });
  item("item-tomato-burned", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 15, 10);
    g.fillStyle(0x3e2723);
    g.fillCircle(14, 15, 8);
  });
  item("item-chicken-raw", () => {
    // Raw chicken leg
    g.fillStyle(OUTLINE);
    g.fillCircle(10, 10, 7);
    g.fillRoundedRect(12, 10, 12, 6, 2);
    g.fillRoundedRect(20, 8, 5, 12, 2);
    g.fillStyle(0xffcc80);
    g.fillCircle(10, 10, 5.5);
    g.fillRoundedRect(13, 11, 10, 4, 1);
    g.fillStyle(0xffecb3);
    g.fillCircle(8, 8, 2);
    g.fillStyle(0xfff8e1);
    g.fillRoundedRect(21, 9, 3, 9, 1);
  });
  item("item-chicken-floured", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(10, 10, 7);
    g.fillRoundedRect(12, 10, 12, 6, 2);
    g.fillRoundedRect(20, 8, 5, 12, 2);
    g.fillStyle(0xfff8e1);
    g.fillCircle(10, 10, 5.5);
    g.fillRoundedRect(13, 11, 10, 4, 1);
    g.fillStyle(0xffe0b2);
    g.fillCircle(8, 8, 1.5);
    g.fillCircle(12, 12, 1.2);
  });
  item("item-chicken-fried", () => {
    // Chicken drumstick / leg
    g.fillStyle(OUTLINE);
    g.fillCircle(10, 10, 7);
    g.fillRoundedRect(12, 10, 12, 6, 2);
    g.fillRoundedRect(20, 8, 5, 12, 2);
    g.fillStyle(0xffb300);
    g.fillCircle(10, 10, 5.5);
    g.fillRoundedRect(13, 11, 10, 4, 1);
    g.fillStyle(0xffecb3);
    g.fillCircle(8, 8, 2);
    g.fillStyle(0xfff8e1);
    g.fillRoundedRect(21, 9, 3, 9, 1);
  });
  item("item-chicken-burned", () => {
    g.fillStyle(OUTLINE);
    g.fillCircle(10, 10, 7);
    g.fillRoundedRect(12, 10, 12, 6, 2);
    g.fillRoundedRect(20, 8, 5, 12, 2);
    g.fillStyle(0x4e342e);
    g.fillCircle(10, 10, 5.5);
    g.fillRoundedRect(13, 11, 10, 4, 1);
  });
  item("item-shrimp-raw", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(16, 14, 14, 8);
    g.fillStyle(0xffab91);
    g.fillEllipse(16, 14, 11, 6);
    g.fillStyle(OUTLINE);
    g.fillCircle(8, 12, 3.5);
    g.fillStyle(0xffccbc);
    g.fillCircle(8, 12, 2.5);
    g.fillStyle(0x212121);
    g.fillCircle(7, 11, 0.8);
  });
  item("item-shrimp-chopped", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(10, 12, 8, 5);
    g.fillEllipse(18, 16, 8, 5);
    g.fillStyle(0xff8a65);
    g.fillEllipse(10, 12, 6, 3.5);
    g.fillEllipse(18, 16, 6, 3.5);
  });
  item("item-shrimp-floured", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(16, 14, 14, 8);
    g.fillStyle(0xfff8e1);
    g.fillEllipse(16, 14, 11, 6);
    g.fillStyle(OUTLINE);
    g.fillCircle(8, 14, 3);
    g.fillStyle(0xffe0b2);
    g.fillCircle(8, 14, 2);
  });
  item("item-shrimp-fried", () => {
    // Curved fried shrimp
    g.fillStyle(OUTLINE);
    g.fillEllipse(17, 15, 14, 8);
    g.fillCircle(8, 12, 4);
    g.fillStyle(0xff7043);
    g.fillEllipse(17, 15, 11, 6);
    g.fillStyle(0xffab91);
    g.fillCircle(8, 12, 3);
    g.fillStyle(0xffecb3);
    g.fillCircle(18, 13, 1.5);
    g.fillStyle(0x212121);
    g.fillCircle(7, 11, 0.9);
  });
  item("item-shrimp-burned", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(17, 15, 14, 8);
    g.fillCircle(8, 12, 4);
    g.fillStyle(0x4e342e);
    g.fillEllipse(17, 15, 11, 6);
    g.fillCircle(8, 12, 3);
  });
  item("item-grill-pan", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 16, 20, 12);
    g.fillStyle(0x78909c);
    g.fillEllipse(14, 16, 16, 9);
    g.fillStyle(0x546e7a);
    g.fillEllipse(14, 16, 12, 6);
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(22, 8, 4, 10, 1);
    g.fillStyle(0x90a4ae);
    g.fillRoundedRect(23, 9, 2, 8, 1);
  });
  item("item-pepper", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 16, 12, 16);
    g.fillStyle(0x43a047);
    g.fillEllipse(14, 16, 9, 13);
    g.fillStyle(0x2e7d32);
    g.fillRect(12, 4, 4, 5);
  });
  item("item-pepper-chopped", () => {
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(6, 10, 8, 10, 2);
    g.fillRoundedRect(15, 8, 8, 12, 2);
    g.fillStyle(0x66bb6a);
    g.fillRoundedRect(7, 11, 6, 8, 1);
    g.fillStyle(0xe53935);
    g.fillRoundedRect(16, 9, 6, 10, 1);
  });
  item("item-pepper-grilled", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 16, 12, 14);
    g.fillStyle(0x2e7d32);
    g.fillEllipse(14, 16, 9, 11);
    g.fillStyle(0x5d4037);
    g.fillRect(8, 14, 12, 1.5);
    g.fillRect(9, 18, 10, 1);
  });
  item("item-pepper-burned", () => {
    g.fillStyle(OUTLINE);
    g.fillEllipse(14, 16, 12, 14);
    g.fillStyle(0x3e2723);
    g.fillEllipse(14, 16, 9, 11);
  });

  // Customers
  drawCustomer(g, "customer", 0x42a5f5, 0xffcc80);
  drawCustomer(g, "customer_vip", 0xffd54f, 0xffcc80);

  // Table furniture decor
  g.clear();
  g.fillStyle(OUTLINE);
  g.fillRoundedRect(2, 2, 28, 28, 4);
  g.fillStyle(0xfafafa);
  g.fillRoundedRect(4, 4, 24, 24, 3);
  g.generateTexture("table", 32, 32);

  g.clear();
  g.fillStyle(OUTLINE, 0.4);
  g.fillEllipse(14, 7, 24, 12);
  g.generateTexture("shadow", 28, 14);

  g.destroy();
  scene.registry.set("assetVer", ASSET_VER);
  scene.registry.set("chefLookSig", lookSig);
}

export function makeChefSheet(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  key: string,
  look: ChefLook,
) {
  const fw = 36;
  const fh = 44;
  const cols = 4;
  const rows = 4;
  g.clear();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      drawChef(g, col * fw, row * fh, row, col, look);
    }
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  g.generateTexture(key, fw * cols, fh * rows);

  const texture = scene.textures.get(key);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      texture.add(String(index), 0, col * fw, row * fh, fw, fh);
    }
  }
}

/** Rebuild the local player sheet from a look (e.g. after prefs change). */
export function applyChefLookToScene(scene: Phaser.Scene, look: ChefLook, key = "player") {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  makeChefSheet(scene, g, key, look);
  g.destroy();
}

/**
 * RSC-style chibi chef: oversized head, tiny body, hat + clothes colors.
 */
function drawChef(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  facing: number,
  frame: number,
  look: ChefLook,
) {
  const bob = frame % 2 === 0 ? 0 : 1;
  const leg = frame === 1 ? 2 : frame === 3 ? -2 : 0;
  const cx = x + 18;
  const hat = look.hatColor;
  const shirt = look.shirtColor;
  const apron = look.apronColor;
  const skin = look.skinColor;
  const shoe = look.shoeColor;

  // soft oval shadow
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, y + 41, 22, 6);

  // tiny shoes / legs
  g.fillStyle(OUTLINE);
  g.fillRoundedRect(cx - 8 + leg, y + 32 + bob, 6, 8, 2);
  g.fillRoundedRect(cx + 2 - leg, y + 32 + bob, 6, 8, 2);
  g.fillStyle(shoe);
  g.fillRoundedRect(cx - 7 + leg, y + 33 + bob, 4, 6, 1);
  g.fillRoundedRect(cx + 3 - leg, y + 33 + bob, 4, 6, 1);

  // tiny torso + apron
  g.fillStyle(OUTLINE);
  g.fillRoundedRect(cx - 9, y + 23 + bob, 18, 12, 5);
  g.fillStyle(shirt);
  g.fillRoundedRect(cx - 8, y + 24 + bob, 16, 10, 4);
  g.fillStyle(apron);
  g.fillRoundedRect(cx - 5, y + 25 + bob, 10, 8, 3);

  // stubby arms
  g.fillStyle(OUTLINE);
  g.fillCircle(cx - 12, y + 27 + bob, 5);
  g.fillCircle(cx + 12, y + 27 + bob, 5);
  g.fillStyle(skin);
  g.fillCircle(cx - 12, y + 27 + bob, 3.5);
  g.fillCircle(cx + 12, y + 27 + bob, 3.5);

  // huge head
  g.fillStyle(OUTLINE);
  g.fillCircle(cx, y + 16 + bob, 12.5);
  g.fillStyle(skin);
  g.fillCircle(cx, y + 16 + bob, 10.5);

  // blush + eyes
  g.fillStyle(0xffab91, 0.85);
  g.fillEllipse(cx - 7, y + 18 + bob, 4, 2.5);
  g.fillEllipse(cx + 7, y + 18 + bob, 4, 2.5);
  g.fillStyle(OUTLINE);
  if (facing !== 3) {
    const ey = y + 15 + bob;
    if (facing === 1) {
      g.fillCircle(cx - 4, ey, 2);
      g.fillStyle(0xffffff);
      g.fillCircle(cx - 4.5, ey - 0.5, 0.7);
    } else if (facing === 2) {
      g.fillCircle(cx + 4, ey, 2);
      g.fillStyle(0xffffff);
      g.fillCircle(cx + 3.5, ey - 0.5, 0.7);
    } else {
      g.fillCircle(cx - 4, ey, 2);
      g.fillCircle(cx + 4, ey, 2);
      g.fillStyle(0xffffff);
      g.fillCircle(cx - 4.5, ey - 0.5, 0.7);
      g.fillCircle(cx + 3.5, ey - 0.5, 0.7);
    }
    g.fillStyle(0xe57373);
    g.fillEllipse(cx, ey + 5, 5, 2.5);
  }

  drawHat(g, cx, y + bob, look.hatStyle, hat);
}

function drawHat(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  style: HatStyle,
  hatColor: number,
) {
  if (style === "toque") {
    // Classic tall chef toque
    g.fillStyle(OUTLINE);
    g.fillEllipse(cx, y + 9, 22, 7);
    g.fillStyle(hatColor);
    g.fillEllipse(cx, y + 9, 18, 5);
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(cx - 7, y - 8, 14, 18, 4);
    g.fillStyle(hatColor);
    g.fillRoundedRect(cx - 6, y - 7, 12, 16, 3);
    // soft top puff
    g.fillStyle(OUTLINE);
    g.fillEllipse(cx, y - 8, 16, 10);
    g.fillStyle(hatColor);
    g.fillEllipse(cx, y - 8, 13, 8);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(cx - 3, y - 10, 2.5);
    // band
    g.fillStyle(OUTLINE, 0.55);
    g.fillRect(cx - 7, y + 5, 14, 3);
    return;
  }

  // tall floppy / witch hat (RSC signature)
  g.fillStyle(OUTLINE);
  g.fillEllipse(cx, y + 9, 24, 8);
  g.fillStyle(hatColor);
  g.fillEllipse(cx, y + 9, 20, 6);
  g.fillStyle(OUTLINE);
  g.fillTriangle(cx, y - 6, cx - 10, y + 11, cx + 10, y + 11);
  g.fillStyle(hatColor);
  g.fillTriangle(cx, y - 4, cx - 8, y + 10, cx + 8, y + 10);
  g.fillStyle(OUTLINE);
  g.fillCircle(cx + 6, y - 2, 3.5);
  g.fillStyle(hatColor);
  g.fillCircle(cx + 6, y - 2, 2.2);
  g.fillStyle(0xffffff, 0.3);
  g.fillCircle(cx - 5, y + 7, 2.5);
}

function drawCustomer(
  g: Phaser.GameObjects.Graphics,
  key: string,
  shirt: number,
  skin: number,
) {
  g.clear();
  const cx = 18;
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, 41, 20, 5);
  g.fillStyle(OUTLINE);
  g.fillRoundedRect(cx - 8, 32, 6, 8, 2);
  g.fillRoundedRect(cx + 2, 32, 6, 8, 2);
  g.fillStyle(0x5d4037);
  g.fillRoundedRect(cx - 7, 33, 4, 6, 1);
  g.fillRoundedRect(cx + 3, 33, 4, 6, 1);
  g.fillStyle(OUTLINE);
  g.fillRoundedRect(cx - 9, 23, 18, 12, 5);
  g.fillStyle(shirt);
  g.fillRoundedRect(cx - 8, 24, 16, 10, 4);
  g.fillStyle(OUTLINE);
  g.fillCircle(cx, 15, 12);
  g.fillStyle(skin);
  g.fillCircle(cx, 15, 10);
  g.fillStyle(0xffab91, 0.8);
  g.fillEllipse(cx - 6, 17, 3.5, 2);
  g.fillEllipse(cx + 6, 17, 3.5, 2);
  g.fillStyle(OUTLINE);
  g.fillCircle(cx - 4, 14, 1.8);
  g.fillCircle(cx + 4, 14, 1.8);
  g.fillStyle(OUTLINE);
  g.fillEllipse(cx, 6, 18, 7);
  g.fillStyle(0x5d4037);
  g.fillEllipse(cx, 6, 14, 5);
  g.generateTexture(key, 36, 44);
}

export function solidTiles(): number[] {
  return [TileId.Wall, TileId.Counter, TileId.Stove, TileId.Booth];
}
