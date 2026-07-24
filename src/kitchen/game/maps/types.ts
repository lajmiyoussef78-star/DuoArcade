import type Phaser from "phaser";
import type { ApplianceDef, ItemId } from "../items/types";
import type { CustomerSeat } from "../entities/Customer";

export const MAP_W = 960;
export const MAP_H = 540;

export type EnvId = "diner" | "beach" | "mall" | "buffet";

export type MapId =
  | "diner-1"
  | "diner-2"
  | "diner-3"
  | "diner-4"
  | "diner-5"
  | "beach-1"
  | "beach-2"
  | "beach-3"
  | "beach-4"
  | "beach-5"
  | "mall-1"
  | "mall-2"
  | "mall-3"
  | "mall-4"
  | "mall-5"
  | "buffet-1"
  | "buffet-2"
  | "buffet-3"
  | "buffet-4"
  | "buffet-5";

export type GameMode = "classic" | "buffet";

export type Collider = { x: number; y: number; w: number; h: number };

export type BuffetTrayId =
  | "chicken"
  | "shrimp"
  | "fries"
  | "tomato"
  | "pepper";

export type BuffetTrayDef = {
  id: BuffetTrayId;
  x: number;
  y: number;
  label: string;
  /** Cooked item the player stocks into this tray. */
  accepts: ItemId;
  max: number;
  /** How many servings one stocked cook-cycle adds. */
  addPerStock: number;
};

export type MapDef = {
  id: MapId;
  env: EnvId;
  mode: GameMode;
  name: string;
  slot: number;
  unlocked: boolean;
  matchSeconds: number;
  customerSpawnMs: [number, number];
  spawn: { x: number; y: number };
  /** Where customers walk in from. */
  door: { x: number; y: number };
  /** Dish ids customers can order on this map (classic mode). */
  menu: ItemId[];
  /** Clean plates available at the start (finite — wash to reuse). */
  plateStock: number;
  colliders: Collider[];
  appliances: ApplianceDef[];
  seats: CustomerSeat[];
  /** Buffet trays (buffet mode only). */
  buffetTrays?: BuffetTrayDef[];
  /** Texture key for this map's backdrop. */
  bgKey: string;
  paint: (scene: Phaser.Scene) => void;
};

export type EnvInfo = {
  id: EnvId;
  title: string;
  blurb: string;
  difficulty: "Easy" | "Medium" | "Hard";
  accent: string;
  /** Five slots; unlocked maps referenced by id, others null. */
  slots: (MapId | null)[];
};
