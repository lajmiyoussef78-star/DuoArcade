/** Server-authoritative kitchen networking (shared kitchen for all players). */

export type NetItem = {
  uid: string;
  id: string;
  x: number;
  y: number;
  contents: string[];
};

export type NetProcess = {
  kind: "cook" | "chop" | "wash";
  elapsed: number;
  duration: number;
  phase: "active" | "ready" | "burning";
} | null;

export type NetAppliance = {
  id: string;
  held: NetItem | null;
  /** Pass can hold multiple */
  items: NetItem[];
  process: NetProcess;
  plateStock?: number;
};

export type NetCustomer = {
  seatId: number;
  phase:
    | "entering"
    | "seated"
    | "ordered"
    | "leaving"
    | "needPlate"
    | "buffet"
    | "eating"
    | "wantJuice";
  orderId: string;
  orderName: string;
  patience: number;
  maxPatience: number;
  x: number;
  y: number;
  vip: boolean;
};

export type NetPlayer = {
  id: string;
  displayName: string;
  avatarHue: number;
  x: number;
  y: number;
  facing: "down" | "left" | "right" | "up";
  moving: boolean;
  sprinting: boolean;
  held: NetItem | null;
};

export type NetTray = {
  id: string;
  stock: number;
  max: number;
  label: string;
  accepts: string;
};

export type KitchenSnapshot = {
  seq: number;
  code: string;
  mapId: string;
  mode?: "classic" | "buffet";
  timeLeft: number;
  duration: number;
  score: number;
  served: number;
  walkouts: number;
  tips: number;
  burns: number;
  combo: number;
  ended: boolean;
  players: NetPlayer[];
  appliances: NetAppliance[];
  worldItems: NetItem[];
  customers: NetCustomer[];
  plateStock: number;
  trays?: NetTray[];
  waveIndex?: number;
};

/** Client → server each tick / on press */
export type KitchenInput = {
  ax: number; // -1..1
  ay: number;
  sprint: boolean;
  interact: boolean;
  drop: boolean;
  facing?: "down" | "left" | "right" | "up";
};

export type MatchEndPayload = {
  code: string;
  mapId?: string;
  score: number;
  served: number;
  walkouts: number;
  tips: number;
  burns: number;
  stars: 0 | 1 | 2 | 3;
  performancePercent: number;
  coinsEarned: number;
  /** Shared duo totals after applying this match. */
  coinsTotal?: number;
  mapBest?: Record<string, { percent: number; stars: 0 | 1 | 2 | 3 }>;
};
