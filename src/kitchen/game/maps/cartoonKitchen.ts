/** @deprecated Prefer catalog — kept for preload fallbacks. */
export { MAP_H, MAP_W } from "./types";
export { getMap } from "./catalog";

import type Phaser from "phaser";
import { DINER_1 } from "./diner";

/** Legacy helper used by PreloadScene fallbacks. */
export function paintKitchenBackdrop(scene: Phaser.Scene): void {
  DINER_1.paint(scene);
}

export const SPAWN = DINER_1.spawn;
export const COLLIDERS = DINER_1.colliders;
