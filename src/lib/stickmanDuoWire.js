/**
 * Small helpers shared by stickman online-duo cores.
 * Pair with createDuoStickmanNet from duoStickmanNet.js.
 */

export function clonePlayersLite(players, fields) {
  if (!Array.isArray(players)) return [];
  return players.map((p) => {
    const o = {};
    for (const f of fields) {
      if (p && p[f] !== undefined) o[f] = p[f];
    }
    return o;
  });
}

export function applyPlayersLite(dest, src) {
  if (!Array.isArray(src) || !Array.isArray(dest)) return;
  src.forEach((sp, i) => {
    if (!dest[i] || !sp) return;
    Object.assign(dest[i], sp);
  });
}

/** Default combat/racer fields good enough for most stickman snapshots. */
export const COMMON_PLAYER_FIELDS = [
  "id", "x", "y", "vx", "vy", "facing", "hp", "onGround", "dead", "deathT",
  "angle", "aim", "power", "ammo", "reload", "crouch", "dashT", "dashCd",
  "stunT", "hurtFlash", "score", "lap", "progress", "finished", "item",
  "holding", "fuse", "v", "ang", "angVel", "grounded", "spawnProt",
  "slideT", "lives", "invuln", "weapon", "chargeT", "atk", "blocking",
];
