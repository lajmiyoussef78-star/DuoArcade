import { BUFFET_1 } from "./buffet";
import { BEACH_1 } from "./beach";
import { DINER_1 } from "./diner";
import { MALL_1 } from "./mall";
import type { EnvInfo, MapDef, MapId } from "./types";

export type { EnvId, EnvInfo, MapDef, MapId, GameMode, BuffetTrayDef } from "./types";
export { MAP_H, MAP_W } from "./types";

export const MAPS: Record<MapId, MapDef> = {
  "diner-1": DINER_1,
  "beach-1": BEACH_1,
  "mall-1": MALL_1,
  "buffet-1": BUFFET_1,
};

export const ENVIRONMENTS: EnvInfo[] = [
  {
    id: "diner",
    title: "Diner",
    blurb: "Early fast-paced grill and assembly levels.",
    difficulty: "Easy",
    accent: "#ff7043",
    slots: ["diner-1", null, null, null, null],
  },
  {
    id: "beach",
    title: "Beach House",
    blurb: "Intermediate outdoor cooking environment.",
    difficulty: "Medium",
    accent: "#29b6f6",
    slots: ["beach-1", null, null, null, null],
  },
  {
    id: "mall",
    title: "Mall",
    blurb: "Advanced multi-station rush level.",
    difficulty: "Hard",
    accent: "#ab47bc",
    slots: ["mall-1", null, null, null, null],
  },
  {
    id: "buffet",
    title: "Buffet",
    blurb: "Stock trays, hand plates, serve waves of groups.",
    difficulty: "Medium",
    accent: "#00897b",
    slots: ["buffet-1", null, null, null, null],
  },
];

export function getMap(id: string | null | undefined): MapDef {
  if (id && id in MAPS) return MAPS[id as MapId];
  return DINER_1;
}

export function isMapId(id: string | null | undefined): id is MapId {
  return !!id && id in MAPS;
}
