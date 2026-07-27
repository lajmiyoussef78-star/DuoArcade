export type SiteThemeId =
  | "classic"
  | "teal"
  | "midnight"
  | "ember"
  | "matcha"
  | "ocean"
  | "citrus"
  | "espresso"
  | "slate";

export type SiteTheme = {
  id: SiteThemeId;
  name: string;
  /** Short blurb shown in the picker. */
  blurb: string;
  /** Preview swatches: bg, panel, accent */
  swatches: [string, string, string];
};

export const SITE_THEMES: SiteTheme[] = [
  {
    id: "classic",
    name: "Warm Hearth",
    blurb: "Original cream kitchen with coral accents",
    swatches: ["#fff3e0", "#fff8e1", "#ff7043"],
  },
  {
    id: "teal",
    name: "Teal Kitchen",
    blurb: "Deep teal with lemon zest",
    swatches: ["#0c2422", "#143d39", "#f5c518"],
  },
  {
    id: "midnight",
    name: "Midnight Line",
    blurb: "Navy service with ice accents",
    swatches: ["#0b1220", "#152238", "#7dd3fc"],
  },
  {
    id: "ember",
    name: "Ember Grill",
    blurb: "Charcoal heat and coral flame",
    swatches: ["#1a1010", "#2a1818", "#ff6b4a"],
  },
  {
    id: "matcha",
    name: "Matcha Bar",
    blurb: "Soft sage and fresh leaf",
    swatches: ["#e8f0e6", "#d5e4d0", "#2f6b4f"],
  },
  {
    id: "ocean",
    name: "Harbor Blue",
    blurb: "Sea glass and bright foam",
    swatches: ["#062a36", "#0d3d4d", "#3de0c4"],
  },
  {
    id: "citrus",
    name: "Citrus Rush",
    blurb: "Bright zest on cool mint",
    swatches: ["#f3fbf7", "#dff3ea", "#e85d04"],
  },
  {
    id: "espresso",
    name: "Espresso Bar",
    blurb: "Roast brown and warm cream",
    swatches: ["#1c1410", "#2c211c", "#e8c39e"],
  },
  {
    id: "slate",
    name: "Steel Prep",
    blurb: "Cool slate and sky sparks",
    swatches: ["#12151a", "#1c222b", "#5b9cff"],
  },
];

export const DEFAULT_SITE_THEME: SiteThemeId = "classic";

export function isSiteThemeId(value: unknown): value is SiteThemeId {
  return SITE_THEMES.some((t) => t.id === value);
}

export function siteThemeById(id: SiteThemeId): SiteTheme {
  return SITE_THEMES.find((t) => t.id === id) ?? SITE_THEMES[0]!;
}
