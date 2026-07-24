import { BUFFET_1 } from "./buffet";
import { BUFFET_2 } from "./buffet2";
import { BUFFET_3 } from "./buffet3";
import { BUFFET_4 } from "./buffet4";
import { BUFFET_5 } from "./buffet5";
import { BEACH_1 } from "./beach";
import { BEACH_2 } from "./beach2";
import { BEACH_3 } from "./beach3";
import { BEACH_4 } from "./beach4";
import { BEACH_5 } from "./beach5";
import { DINER_1 } from "./diner";
import { DINER_2 } from "./diner2";
import { DINER_3 } from "./diner3";
import { DINER_4 } from "./diner4";
import { DINER_5 } from "./diner5";
import { MALL_1 } from "./mall";
import { MALL_2 } from "./mall2";
import { MALL_3 } from "./mall3";
import { MALL_4 } from "./mall4";
import { MALL_5 } from "./mall5";
import type { EnvInfo, MapDef, MapId } from "./types";

export type { EnvId, EnvInfo, MapDef, MapId, GameMode, BuffetTrayDef } from "./types";
export { MAP_H, MAP_W } from "./types";

export const MAPS: Record<MapId, MapDef> = {
  "diner-1": DINER_1,
  "diner-2": DINER_2,
  "diner-3": DINER_3,
  "diner-4": DINER_4,
  "diner-5": DINER_5,
  "beach-1": BEACH_1,
  "beach-2": BEACH_2,
  "beach-3": BEACH_3,
  "beach-4": BEACH_4,
  "beach-5": BEACH_5,
  "mall-1": MALL_1,
  "mall-2": MALL_2,
  "mall-3": MALL_3,
  "mall-4": MALL_4,
  "mall-5": MALL_5,
  "buffet-1": BUFFET_1,
  "buffet-2": BUFFET_2,
  "buffet-3": BUFFET_3,
  "buffet-4": BUFFET_4,
  "buffet-5": BUFFET_5,
};

export const ENVIRONMENTS: EnvInfo[] = [
  {
    id: "diner",
    title: "Diner",
    blurb: "Early fast-paced grill and assembly levels.",
    difficulty: "Easy",
    accent: "#ff7043",
    slots: ["diner-1", "diner-2", "diner-3", "diner-4", "diner-5"],
  },
  {
    id: "beach",
    title: "Beach House",
    blurb: "Intermediate outdoor cooking environment.",
    difficulty: "Medium",
    accent: "#29b6f6",
    slots: ["beach-1", "beach-2", "beach-3", "beach-4", "beach-5"],
  },
  {
    id: "mall",
    title: "Mall",
    blurb: "Advanced multi-station rush level.",
    difficulty: "Hard",
    accent: "#ab47bc",
    slots: ["mall-1", "mall-2", "mall-3", "mall-4", "mall-5"],
  },
  {
    id: "buffet",
    title: "Buffet",
    blurb: "Stock trays, hand plates, serve waves of groups.",
    difficulty: "Medium",
    accent: "#00897b",
    slots: ["buffet-1", "buffet-2", "buffet-3", "buffet-4", "buffet-5"],
  },
];

export function getMap(id: string | null | undefined): MapDef {
  if (id && id in MAPS) return MAPS[id as MapId];
  return DINER_1;
}

export function isMapId(id: string | null | undefined): id is MapId {
  return !!id && id in MAPS;
}
