export type ItemId =
  | "tomato"
  | "tomato_washed"
  | "tomato_chopped"
  | "tomato_grilled"
  | "tomato_burned"
  | "lettuce"
  | "lettuce_washed"
  | "lettuce_chopped"
  | "patty_raw"
  | "patty_cooked"
  | "patty_burned"
  | "bun"
  | "potato"
  | "potato_washed"
  | "fries"
  | "fries_raw"
  | "fries_burned"
  | "pizza_dough"
  | "pizza_raw"
  | "pizza_cooked"
  | "pizza_burned"
  | "chicken_raw"
  | "chicken_floured"
  | "chicken_fried"
  | "chicken_burned"
  | "shrimp_raw"
  | "shrimp_chopped"
  | "shrimp_floured"
  | "shrimp_fried"
  | "shrimp_burned"
  | "pepper"
  | "pepper_chopped"
  | "pepper_grilled"
  | "pepper_burned"
  | "grill_pan"
  | "plate"
  | "dirty_plate"
  | "burger"
  | "salad"
  | "fries_meal"
  | "pizza"
  | "juice"
  | "ice_cream";

export type ItemDef = {
  id: ItemId;
  label: string;
  texture: string;
  throwable: boolean;
  /** Finished dish ready to serve. */
  dish?: boolean;
};

export const ITEMS: Record<ItemId, ItemDef> = {
  tomato: { id: "tomato", label: "Tomato", texture: "item-tomato", throwable: true },
  tomato_washed: {
    id: "tomato_washed",
    label: "Washed tomato",
    texture: "item-tomato-washed",
    throwable: true,
  },
  tomato_chopped: {
    id: "tomato_chopped",
    label: "Chopped tomato",
    texture: "item-tomato-chopped",
    throwable: true,
  },
  tomato_grilled: {
    id: "tomato_grilled",
    label: "Grilled tomato",
    texture: "item-tomato-grilled",
    throwable: true,
  },
  tomato_burned: {
    id: "tomato_burned",
    label: "Burned tomato",
    texture: "item-tomato-burned",
    throwable: true,
  },
  lettuce: { id: "lettuce", label: "Mozzarella", texture: "item-lettuce", throwable: true },
  lettuce_washed: {
    id: "lettuce_washed",
    label: "Washed mozzarella",
    texture: "item-lettuce-washed",
    throwable: true,
  },
  lettuce_chopped: {
    id: "lettuce_chopped",
    label: "Chopped mozzarella",
    texture: "item-lettuce-chopped",
    throwable: true,
  },
  patty_raw: { id: "patty_raw", label: "Raw patty", texture: "item-patty", throwable: true },
  patty_cooked: {
    id: "patty_cooked",
    label: "Cooked patty",
    texture: "item-patty-cooked",
    throwable: true,
  },
  patty_burned: {
    id: "patty_burned",
    label: "Burned patty",
    texture: "item-patty-burned",
    throwable: true,
  },
  bun: { id: "bun", label: "Bun", texture: "item-bun", throwable: true },
  potato: { id: "potato", label: "Potato", texture: "item-potato", throwable: true },
  potato_washed: {
    id: "potato_washed",
    label: "Washed potato",
    texture: "item-potato-washed",
    throwable: true,
  },
  fries: { id: "fries", label: "Fries", texture: "item-fries", throwable: true },
  fries_raw: { id: "fries_raw", label: "Raw fries", texture: "item-fries-raw", throwable: true },
  fries_burned: {
    id: "fries_burned",
    label: "Burned fries",
    texture: "item-fries-burned",
    throwable: true,
  },
  pizza_dough: {
    id: "pizza_dough",
    label: "Pizza dough",
    texture: "item-pizza-dough",
    throwable: true,
  },
  pizza_raw: {
    id: "pizza_raw",
    label: "Raw pizza",
    texture: "item-pizza-raw",
    throwable: true,
  },
  pizza_cooked: {
    id: "pizza_cooked",
    label: "Cooked pizza",
    texture: "item-pizza-cooked",
    throwable: true,
  },
  pizza_burned: {
    id: "pizza_burned",
    label: "Burned pizza",
    texture: "item-pizza-burned",
    throwable: true,
  },
  chicken_raw: {
    id: "chicken_raw",
    label: "Raw chicken",
    texture: "item-chicken-raw",
    throwable: true,
  },
  chicken_floured: {
    id: "chicken_floured",
    label: "Floured chicken",
    texture: "item-chicken-floured",
    throwable: true,
  },
  chicken_fried: {
    id: "chicken_fried",
    label: "Fried chicken",
    texture: "item-chicken-fried",
    throwable: true,
  },
  chicken_burned: {
    id: "chicken_burned",
    label: "Burned chicken",
    texture: "item-chicken-burned",
    throwable: true,
  },
  shrimp_raw: {
    id: "shrimp_raw",
    label: "Raw shrimp",
    texture: "item-shrimp-raw",
    throwable: true,
  },
  shrimp_chopped: {
    id: "shrimp_chopped",
    label: "Cut shrimp",
    texture: "item-shrimp-chopped",
    throwable: true,
  },
  shrimp_floured: {
    id: "shrimp_floured",
    label: "Floured shrimp",
    texture: "item-shrimp-floured",
    throwable: true,
  },
  shrimp_fried: {
    id: "shrimp_fried",
    label: "Fried shrimp",
    texture: "item-shrimp-fried",
    throwable: true,
  },
  shrimp_burned: {
    id: "shrimp_burned",
    label: "Burned shrimp",
    texture: "item-shrimp-burned",
    throwable: true,
  },
  pepper: { id: "pepper", label: "Pepper", texture: "item-pepper", throwable: true },
  pepper_chopped: {
    id: "pepper_chopped",
    label: "Chopped pepper",
    texture: "item-pepper-chopped",
    throwable: true,
  },
  pepper_grilled: {
    id: "pepper_grilled",
    label: "Grilled pepper",
    texture: "item-pepper-grilled",
    throwable: true,
  },
  pepper_burned: {
    id: "pepper_burned",
    label: "Burned pepper",
    texture: "item-pepper-burned",
    throwable: true,
  },
  grill_pan: {
    id: "grill_pan",
    label: "Grill pan",
    texture: "item-grill-pan",
    throwable: true,
  },
  plate: { id: "plate", label: "Plate", texture: "item-plate", throwable: true },
  dirty_plate: {
    id: "dirty_plate",
    label: "Dirty plate",
    texture: "item-dirty-plate",
    throwable: true,
  },
  burger: { id: "burger", label: "Burger", texture: "item-burger", throwable: true, dish: true },
  salad: { id: "salad", label: "Mozzarella", texture: "item-salad", throwable: true, dish: true },
  fries_meal: {
    id: "fries_meal",
    label: "Fries meal",
    texture: "item-fries-meal",
    throwable: true,
    dish: true,
  },
  pizza: { id: "pizza", label: "Pizza", texture: "item-pizza", throwable: true, dish: true },
  juice: { id: "juice", label: "Juice", texture: "item-juice", throwable: true, dish: true },
  ice_cream: {
    id: "ice_cream",
    label: "Ice cream",
    texture: "item-ice-cream",
    throwable: true,
    dish: true,
  },
};

export type ApplianceKind =
  | "grill"
  | "grill_panel"
  | "oven"
  | "fryer"
  | "prep"
  | "sink"
  | "pass"
  | "counter"
  | "pantry"
  | "plates"
  | "flour"
  | "juice"
  | "icecream"
  | "trash";

export type ApplianceDef = {
  id: string;
  /** Center position in pixels on the painted kitchen. */
  x: number;
  y: number;
  kind: ApplianceKind;
  label: string;
  dispenses?: ItemId;
};

export const APPLIANCES: ApplianceDef[] = [
  { id: "grill_a", x: 184, y: 110, kind: "grill", label: "Oven" },
  { id: "grill_b", x: 774, y: 110, kind: "grill", label: "Oven" },
  { id: "grill_c", x: 844, y: 110, kind: "grill", label: "Oven" },
  { id: "prep_a", x: 200, y: 215, kind: "prep", label: "Prep" },
  { id: "sink_a", x: 117, y: 215, kind: "sink", label: "Sink" },
  { id: "fryer_a", x: 820, y: 215, kind: "fryer", label: "Fryer" },
  { id: "pass_a", x: 480, y: 200, kind: "pass", label: "Pass" },
  { id: "counter_a", x: 480, y: 360, kind: "counter", label: "Counter" },
  { id: "counter_b", x: 160, y: 420, kind: "counter", label: "Counter" },
  { id: "counter_c", x: 800, y: 420, kind: "counter", label: "Counter" },
  { id: "trash_a", x: 880, y: 470, kind: "trash", label: "Trash" },
  { id: "pantry_tomato", x: 92, y: 467, kind: "pantry", label: "Tomatoes", dispenses: "tomato" },
  { id: "pantry_lettuce", x: 152, y: 467, kind: "pantry", label: "Lettuce", dispenses: "lettuce" },
  { id: "pantry_patty", x: 212, y: 467, kind: "pantry", label: "Patties", dispenses: "patty_raw" },
  { id: "pantry_bun", x: 152, y: 430, kind: "pantry", label: "Buns", dispenses: "bun" },
  { id: "pantry_potato", x: 212, y: 430, kind: "pantry", label: "Potatoes", dispenses: "potato" },
  { id: "plates", x: 740, y: 467, kind: "plates", label: "Plates", dispenses: "plate" },
];

export const THROW_SPEED = 280;
export const PICKUP_RANGE = 48;
export const APPLIANCE_RANGE = 64;
/** Ingredient crates / plates — reach from front or back of the counter. */
export const PANTRY_RANGE = 100;
/** Pass table — reach from any side of the counter. */
export const PASS_RANGE = 110;

export const COOK_MS = 3500;
/** Pizza oven — shorter bake so it fits between other prep without feeling idle. */
export const PIZZA_COOK_MS = 7500;
/** Grace window after food is ready before it burns. */
export const BURN_MS = 12000;
/** Extra window after pizza is ready before it burns. */
export const PIZZA_BURN_MS = 15000;
export const CHOP_MS = 1200;
export const WASH_MS = 1000;
