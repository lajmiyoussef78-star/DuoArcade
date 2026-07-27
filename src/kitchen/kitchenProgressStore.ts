import { useSyncExternalStore } from 'react';
import { isMapId, type MapId } from './game/maps/catalog';
import {
  COSMETIC_SHOP,
  FREE_BOOT_STYLE,
  FREE_CHARACTER_ID,
  FREE_SHIRT_STYLE,
  type BootStyle,
  type CharacterId,
  type ShirtStyle
} from './game/cosmetics/chefLook';

export type MapBest = {
  percent: number;
  stars: 0 | 1 | 2 | 3;
};

type ProgressState = {
  coins: number;
  xp: number;
  ownedCosmetics: string[];
  mapBest: Partial<Record<MapId, MapBest>>;
};

type ProgressApi = ProgressState & {
  applyMatch: (input: {
    mapId: string;
    coinsEarned: number;
    xpEarned?: number;
    performancePercent: number;
    stars: 0 | 1 | 2 | 3;
  }) => void;
  addRewards: (input: { coins?: number; xp?: number }) => void;
  bestFor: (mapId: MapId) => MapBest | null;
  ownsCosmetic: (itemId: string) => boolean;
  ownsShirtStyle: (style: ShirtStyle) => boolean;
  ownsBootStyle: (style: BootStyle) => boolean;
  ownsCharacterId: (id: CharacterId) => boolean;
  buyCosmetic: (itemId: string) => boolean;
};

const KEY = 'duoarcade-rsc-progress-v1';
const LEGACY_GASTRO = 'gastronomica-kitchen-progress';

function normalizeMapBest(
  raw: Record<string, MapBest> | Partial<Record<MapId, MapBest>> | undefined
): Partial<Record<MapId, MapBest>> {
  const out: Partial<Record<MapId, MapBest>> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!isMapId(k) || !v) continue;
    const percent = Math.max(0, Math.min(100, Math.round(Number(v.percent) || 0)));
    const stars = ([0, 1, 2, 3] as const).includes(v.stars as 0 | 1 | 2 | 3)
      ? (v.stars as 0 | 1 | 2 | 3)
      : percent >= 100
        ? 3
        : percent >= 70
          ? 2
          : percent >= 40
            ? 1
            : 0;
    out[k] = { percent, stars };
  }
  return out;
}

function normalizeOwned(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(COSMETIC_SHOP.map(i => i.id));
  return raw.filter((id): id is string => typeof id === 'string' && ids.has(id));
}

function load(): ProgressState {
  try {
    const raw =
      JSON.parse(localStorage.getItem(KEY) || 'null') ||
      JSON.parse(localStorage.getItem(LEGACY_GASTRO) || 'null');
    if (!raw || typeof raw !== 'object') {
      return { coins: 0, xp: 0, ownedCosmetics: [], mapBest: {} };
    }
    const owned = normalizeOwned(raw.ownedCosmetics ?? raw.owned);
    return {
      coins: Math.max(0, Number(raw.coins) | 0),
      xp: Math.max(0, Number(raw.xp) | 0),
      ownedCosmetics: owned,
      mapBest: normalizeMapBest(raw.mapBest)
    };
  } catch {
    return { coins: 0, xp: 0, ownedCosmetics: [], mapBest: {} };
  }
}

let state = load();
const listeners = new Set<() => void>();

function persist() {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      coins: state.coins,
      xp: state.xp,
      owned: state.ownedCosmetics,
      ownedCosmetics: state.ownedCosmetics,
      mapBest: state.mapBest
    })
  );
  listeners.forEach(l => l());
}

function setState(next: ProgressState) {
  state = next;
  persist();
}

const api: ProgressApi = {
  get coins() { return state.coins; },
  get xp() { return state.xp; },
  get ownedCosmetics() { return state.ownedCosmetics; },
  get mapBest() { return state.mapBest; },
  applyMatch: ({ mapId, coinsEarned, xpEarned = 0, performancePercent, stars }) => {
    if (!isMapId(mapId)) return;
    const add = Math.max(0, Math.floor(coinsEarned));
    const xpAdd = Math.max(0, Math.floor(xpEarned));
    const percent = Math.max(0, Math.min(100, Math.round(performancePercent)));
    const prev = state.mapBest[mapId];
    const nextBest = !prev || percent > prev.percent ? { percent, stars } : prev;
    setState({
      ...state,
      coins: state.coins + add,
      xp: state.xp + xpAdd,
      mapBest: { ...state.mapBest, [mapId]: nextBest }
    });
  },
  addRewards: ({ coins = 0, xp = 0 }) => {
    const c = Math.max(0, Number(coins) | 0);
    const x = Math.max(0, Number(xp) | 0);
    if (!c && !x) return;
    setState({ ...state, coins: state.coins + c, xp: state.xp + x });
  },
  bestFor: mapId => state.mapBest[mapId] ?? null,
  ownsCosmetic: itemId => state.ownedCosmetics.includes(itemId),
  ownsShirtStyle: style => {
    if (style === FREE_SHIRT_STYLE) return true;
    const item = COSMETIC_SHOP.find(i => i.shirtStyle === style);
    return item ? state.ownedCosmetics.includes(item.id) : false;
  },
  ownsBootStyle: style => {
    if (style === FREE_BOOT_STYLE) return true;
    const item = COSMETIC_SHOP.find(i => i.bootStyle === style);
    return item ? state.ownedCosmetics.includes(item.id) : false;
  },
  ownsCharacterId: id => {
    if (id === FREE_CHARACTER_ID) return true;
    const item = COSMETIC_SHOP.find(i => i.characterId === id);
    return item ? state.ownedCosmetics.includes(item.id) : false;
  },
  buyCosmetic: itemId => {
    const item = COSMETIC_SHOP.find(i => i.id === itemId);
    if (!item) return false;
    if (state.ownedCosmetics.includes(itemId)) return false;
    if (state.coins < item.priceCoins) return false;
    setState({
      ...state,
      coins: state.coins - item.priceCoins,
      ownedCosmetics: [...state.ownedCosmetics, itemId]
    });
    return true;
  }
};

export function useKitchenProgress<T>(selector: (s: ProgressApi) => T): T {
  return useSyncExternalStore(
    onChange => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => selector(api),
    () => selector(api)
  );
}

export function getKitchenProgress(): ProgressState {
  return state;
}
