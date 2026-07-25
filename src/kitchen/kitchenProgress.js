// Per-browser kitchen progress: coins, owned cosmetics, equipped look.

import {
  COSMETIC_SHOP,
  DEFAULT_CHEF_LOOK,
  FREE_BOOT_STYLE,
  FREE_CHARACTER_ID,
  FREE_SHIRT_STYLE,
  normalizeChefLook
} from './game/cosmetics/chefLook';

const KEY = 'duoarcade-rsc-progress-v1';

function blank() {
  return {
    coins: 0,
    xp: 0,
    owned: [],
    look: { ...DEFAULT_CHEF_LOOK }
  };
}

export function loadKitchenProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return blank();
    const owned = Array.isArray(raw.owned)
      ? raw.owned.filter(id => typeof id === 'string')
      : [];
    return {
      coins: Math.max(0, Number(raw.coins) | 0),
      xp: Math.max(0, Number(raw.xp) | 0),
      owned,
      look: normalizeChefLook(raw.look)
    };
  } catch {
    return blank();
  }
}

export function saveKitchenProgress(progress) {
  const next = {
    coins: Math.max(0, Number(progress.coins) | 0),
    xp: Math.max(0, Number(progress.xp) | 0),
    owned: Array.isArray(progress.owned) ? [...new Set(progress.owned)] : [],
    look: normalizeChefLook(progress.look)
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function isOwned(progress, itemId) {
  if (!itemId) return true;
  const item = COSMETIC_SHOP.find(i => i.id === itemId);
  if (!item) return true;
  if (item.shirtStyle === FREE_SHIRT_STYLE) return true;
  if (item.bootStyle === FREE_BOOT_STYLE) return true;
  if (item.characterId === FREE_CHARACTER_ID) return true;
  return progress.owned.includes(itemId);
}

export function ownsStyle(progress, slot, styleId) {
  if (slot === 'character' && styleId === FREE_CHARACTER_ID) return true;
  if (slot === 'shirt' && styleId === FREE_SHIRT_STYLE) return true;
  if (slot === 'boots' && styleId === FREE_BOOT_STYLE) return true;
  const item = COSMETIC_SHOP.find(i =>
    (slot === 'character' && i.characterId === styleId) ||
    (slot === 'shirt' && i.shirtStyle === styleId) ||
    (slot === 'boots' && i.bootStyle === styleId)
  );
  if (!item) return true;
  return progress.owned.includes(item.id);
}

export function buyItem(progress, itemId) {
  const item = COSMETIC_SHOP.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: 'missing', progress };
  if (isOwned(progress, itemId)) return { ok: false, reason: 'owned', progress };
  if (progress.coins < item.priceCoins) {
    return { ok: false, reason: 'broke', progress };
  }
  const next = saveKitchenProgress({
    ...progress,
    coins: progress.coins - item.priceCoins,
    owned: [...progress.owned, itemId]
  });
  return { ok: true, progress: next, item };
}

export function addCoins(progress, amount) {
  const n = Math.max(0, Number(amount) | 0);
  if (!n) return progress;
  return saveKitchenProgress({ ...progress, coins: progress.coins + n });
}

export function addRewards(progress, { coins = 0, xp = 0 } = {}) {
  const c = Math.max(0, Number(coins) | 0);
  const x = Math.max(0, Number(xp) | 0);
  if (!c && !x) return progress;
  return saveKitchenProgress({
    ...progress,
    coins: progress.coins + c,
    xp: (progress.xp || 0) + x
  });
}

export function setLook(progress, look) {
  return saveKitchenProgress({ ...progress, look: normalizeChefLook(look) });
}
