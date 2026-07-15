export const TILE = 32;
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Tile indices in the generated tileset strip. */
export const TileId = {
  /** Warm dining wood planks */
  Wood: 0,
  /** Deep teal wall */
  Wall: 1,
  /** Thick outlined wooden counter */
  Counter: 2,
  /** Brick oven / grill with fire */
  Stove: 3,
  /** Blue–white kitchen checker */
  Check: 4,
  /** Red booth seating */
  Booth: 5,
  Empty: -1,
} as const;

export const PLAYER_SPEED = 140;
export const PLAYER_SPRINT = 210;
