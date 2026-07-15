/** Same chef silhouette — customize clothes & colors only. */

export type HatStyle = "floppy" | "toque";

export type ChefLook = {
  hatStyle: HatStyle;
  /** Hex 0xRRGGBB */
  hatColor: number;
  shirtColor: number;
  apronColor: number;
  skinColor: number;
  shoeColor: number;
};

export const DEFAULT_CHEF_LOOK: ChefLook = {
  hatStyle: "floppy",
  hatColor: 0x8e24aa,
  shirtColor: 0xffffff,
  apronColor: 0xff8a65,
  skinColor: 0xffcc80,
  shoeColor: 0x212121,
};

export type ChefLookPreset = {
  id: string;
  name: string;
  look: ChefLook;
};

export const CHEF_LOOK_PRESETS: ChefLookPreset[] = [
  { id: "classic", name: "Classic", look: { ...DEFAULT_CHEF_LOOK } },
  {
    id: "garden",
    name: "Garden",
    look: {
      hatStyle: "floppy",
      hatColor: 0x43a047,
      shirtColor: 0xffffff,
      apronColor: 0x81c784,
      skinColor: 0xffcc80,
      shoeColor: 0x3e2723,
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    look: {
      hatStyle: "toque",
      hatColor: 0x263238,
      shirtColor: 0xeceff1,
      apronColor: 0x455a64,
      skinColor: 0xffcc80,
      shoeColor: 0x000000,
    },
  },
  {
    id: "tomato",
    name: "Tomato",
    look: {
      hatStyle: "floppy",
      hatColor: 0xc62828,
      shirtColor: 0xfff8e1,
      apronColor: 0xef5350,
      skinColor: 0xffcc80,
      shoeColor: 0x4e342e,
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    look: {
      hatStyle: "toque",
      hatColor: 0x0277bd,
      shirtColor: 0xe3f2fd,
      apronColor: 0x29b6f6,
      skinColor: 0xffcc80,
      shoeColor: 0x1a237e,
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    look: {
      hatStyle: "floppy",
      hatColor: 0xef6c00,
      shirtColor: 0xfff3e0,
      apronColor: 0xffb74d,
      skinColor: 0xffab91,
      shoeColor: 0x3e2723,
    },
  },
];

export const HAT_SWATCHES = [
  0x8e24aa, 0x43a047, 0xc62828, 0x0277bd, 0xef6c00, 0x263238, 0xf5f5f5, 0xf9a825,
];
export const APRON_SWATCHES = [
  0xff8a65, 0x81c784, 0xef5350, 0x29b6f6, 0xffb74d, 0x455a64, 0xffffff, 0xce93d8,
];
export const SHIRT_SWATCHES = [
  0xffffff, 0xfff8e1, 0xe3f2fd, 0xfff3e0, 0xeceff1, 0xffcdd2, 0xc8e6c9, 0x212121,
];
export const SKIN_SWATCHES = [
  0xffe0b2, 0xffcc80, 0xffab91, 0xd7a86e, 0xb98068, 0x8d5524, 0x5d4037,
];
export const SHOE_SWATCHES = [0x212121, 0x3e2723, 0x4e342e, 0x000000, 0x5d4037, 0x1a237e];

export function colorToCss(hex: number): string {
  return `#${(hex >>> 0).toString(16).padStart(6, "0")}`;
}

export function cssToColor(css: string): number {
  const cleaned = css.trim().replace("#", "");
  const n = Number.parseInt(cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned, 16);
  return Number.isFinite(n) ? n : DEFAULT_CHEF_LOOK.hatColor;
}

export function normalizeChefLook(partial?: Partial<ChefLook> | null): ChefLook {
  return {
    hatStyle: partial?.hatStyle === "toque" ? "toque" : "floppy",
    hatColor: partial?.hatColor ?? DEFAULT_CHEF_LOOK.hatColor,
    shirtColor: partial?.shirtColor ?? DEFAULT_CHEF_LOOK.shirtColor,
    apronColor: partial?.apronColor ?? DEFAULT_CHEF_LOOK.apronColor,
    skinColor: partial?.skinColor ?? DEFAULT_CHEF_LOOK.skinColor,
    shoeColor: partial?.shoeColor ?? DEFAULT_CHEF_LOOK.shoeColor,
  };
}

/** Peer / secondary chef — distinct default so remotes stay readable. */
export const REMOTE_CHEF_LOOK: ChefLook = {
  hatStyle: "floppy",
  hatColor: 0x43a047,
  shirtColor: 0xffffff,
  apronColor: 0x66bb6a,
  skinColor: 0xffcc80,
  shoeColor: 0x212121,
};
