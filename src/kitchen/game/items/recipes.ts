import {
  COOK_MS,
  CHOP_MS,
  PIZZA_COOK_MS,
  WASH_MS,
  ITEMS,
  type ItemId,
} from "./types";

export type Recipe = {
  id: ItemId;
  name: string;
  needs: ItemId[];
  basePoints: number;
  /** Seconds of patience after the order is taken. */
  patience: number;
};

/**
 * Realistic solo prep time (seconds), including:
 * - walk between stations (map-scale trips)
 * - pick / place / interact presses
 * - cook / chop station times
 * - plate grab + occasional wash when stock is tight
 * - crowding (other customers / busy lanes / station queues)
 * - deliver to the table
 *
 * Patience uses ~2.4× this so a clean run has cushion, but juggling
 * multiple orders / burns still feels pressured.
 */
function estimatePrepSeconds(needs: ItemId[]): number {
  // Take order nearby + grab plate + deliver (~3 trips on a 960px kitchen)
  let actions = 8;
  // Finite plates: every other dish may need wash+return
  actions += (WASH_MS / 1000 + 4) * 0.45;
  // Crowding: detours around seats/players, waiting on oven/grill/fryer, re-pathing
  actions += 5.5;
  let stations = 0;

  for (const need of needs) {
    if (need === "bun") {
      actions += 2.5; // walk crate + pick
    } else if (need === "patty_cooked") {
      actions += 4; // pantry → grill → wait nearby / come back → take
      stations += COOK_MS / 1000;
    } else if (need === "fries") {
      actions += 4;
      stations += COOK_MS / 1000;
    } else if (need === "tomato_chopped") {
      actions += 3.5; // pantry → prep → chop → take
      stations += CHOP_MS / 1000;
    } else if (need === "lettuce_chopped") {
      actions += 3.5;
      stations += CHOP_MS / 1000;
    } else {
      actions += 2.5;
    }
  }

  // Parallel cooking (grill/fry while chopping) recovers some wall time
  const parallelBonus =
    needs.includes("patty_cooked") || needs.includes("fries") ? 2.5 : 0;
  return Math.max(12, actions + stations - parallelBonus);
}

function patienceFor(needs: ItemId[]): number {
  return Math.round(estimatePrepSeconds(needs) * 2.4);
}

/** Order of needs does not matter; plate itself is implied (assembly target). */
export const RECIPES: Recipe[] = [
  {
    id: "pizza",
    name: "Pizza",
    needs: [],
    basePoints: 130,
    // Oven wait is meaningful, but shorter bake keeps pizza in line with other dishes
    patience: Math.round((10 + PIZZA_COOK_MS / 1000 + 5) * 2.15),
  },
  {
    id: "burger",
    name: "Burger",
    needs: ["bun", "patty_cooked", "lettuce_chopped", "tomato_chopped"],
    basePoints: 140,
    patience: patienceFor(["bun", "patty_cooked", "lettuce_chopped", "tomato_chopped"]),
  },
  {
    id: "salad",
    name: "Mozzarella",
    needs: ["lettuce_chopped", "tomato_chopped"],
    basePoints: 90,
    patience: patienceFor(["lettuce_chopped", "tomato_chopped"]),
  },
  {
    id: "fries_meal",
    name: "Fries meal",
    needs: ["fries"],
    basePoints: 70,
    // Slightly more time so fries guests aren't gone before pizza is even plated
    patience: Math.max(
      patienceFor(["fries"]),
      Math.round(patienceFor(["fries"]) * 1.15),
    ),
  },
  {
    id: "juice",
    name: "Juice",
    needs: [],
    basePoints: 55,
    patience: 42,
  },
  {
    id: "ice_cream",
    name: "Ice cream",
    needs: [],
    basePoints: 65,
    patience: 44,
  },
];

export function recipesForMenu(menu: ItemId[]): Recipe[] {
  const set = new Set(menu);
  return RECIPES.filter((r) => set.has(r.id));
}

export function recipeByDish(id: ItemId): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/**
 * Pick a menu order, preferring dishes that are under-represented among
 * currently seated guests so one order (e.g. pizza) doesn't dominate the floor.
 */
export function randomRecipe(menu?: ItemId[], activeOrderIds: ItemId[] = []): Recipe {
  const pool =
    menu && menu.length > 0
      ? recipesForMenu(menu)
      : RECIPES.filter((r) => r.id === "pizza" || r.needs.length > 0);
  const list = pool.length > 0 ? pool : RECIPES;

  if (list.length === 1) return list[0]!;

  const counts = new Map<ItemId, number>();
  for (const id of list) counts.set(id.id, 0);
  for (const id of activeOrderIds) {
    if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const min = Math.min(...[...counts.values()]);
  const under = list.filter((r) => (counts.get(r.id) ?? 0) === min);
  const pickFrom = under.length > 0 ? under : list;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)]!;
}

export function tryAssemble(contents: ItemId[]): ItemId | null {
  const set = new Set(contents);
  for (const recipe of RECIPES) {
    // Skip oven/dispenser dishes (empty needs)
    if (recipe.needs.length === 0) continue;
    if (recipe.needs.every((n) => set.has(n)) && set.size === recipe.needs.length) {
      return recipe.id;
    }
  }
  return null;
}

export function canWash(id: ItemId): ItemId | null {
  if (id === "lettuce") return "lettuce_washed";
  if (id === "potato") return "potato_washed";
  if (id === "dirty_plate") return "plate";
  return null;
}

export function canChop(id: ItemId): ItemId | null {
  if (id === "tomato" || id === "tomato_washed") return "tomato_chopped";
  if (id === "lettuce" || id === "lettuce_washed") return "lettuce_chopped";
  if (id === "shrimp_raw") return "shrimp_chopped";
  if (id === "pepper") return "pepper_chopped";
  return null;
}

export type CookKind = "grill" | "grill_panel" | "oven" | "fryer";

export function cookResult(kind: CookKind, id: ItemId): ItemId | null {
  if (kind === "grill" && id === "patty_raw") return "patty_cooked";
  if (kind === "oven" && id === "pizza_raw") return "pizza_cooked";
  if (kind === "fryer") {
    if (id === "potato" || id === "potato_washed" || id === "fries_raw") return "fries";
    if (id === "chicken_floured") return "chicken_fried";
    if (id === "shrimp_floured") return "shrimp_fried";
  }
  if (kind === "grill_panel") {
    if (id === "tomato_chopped") return "tomato_grilled";
    if (id === "pepper_chopped") return "pepper_grilled";
  }
  return null;
}

export function burnResult(kind: CookKind, id: ItemId): ItemId | null {
  if (kind === "grill" && id === "patty_cooked") return "patty_burned";
  if (kind === "oven" && id === "pizza_cooked") return "pizza_burned";
  if (kind === "fryer") {
    if (id === "fries") return "fries_burned";
    if (id === "chicken_fried") return "chicken_burned";
    if (id === "shrimp_fried") return "shrimp_burned";
  }
  if (kind === "grill_panel") {
    if (id === "tomato_grilled") return "tomato_burned";
    if (id === "pepper_grilled") return "pepper_burned";
  }
  return null;
}

/** Flour dip station transforms. */
export function flourResult(id: ItemId): ItemId | null {
  if (id === "chicken_raw") return "chicken_floured";
  if (id === "shrimp_chopped") return "shrimp_floured";
  return null;
}

export function isTomatoTopping(id: ItemId): boolean {
  return id === "tomato" || id === "tomato_washed" || id === "tomato_chopped";
}

export function canAddToPlate(plateContents: ItemId[], ingredient: ItemId): boolean {
  if (ITEMS[ingredient].dish) return false;
  if (ingredient === "plate" || ingredient === "dirty_plate") return false;
  if (ingredient.includes("burned")) return false;
  if (
    ingredient === "pizza_dough" ||
    ingredient === "pizza_raw" ||
    ingredient === "pizza_cooked"
  ) {
    return false;
  }
  if (plateContents.includes(ingredient)) return false;
  return true;
}

/** Short ingredient list for tooltips. */
export function recipeIngredientLine(recipe: Recipe): string {
  if (recipe.id === "pizza") return "Dough + tomato → Oven → Plate";
  if (recipe.needs.length === 0) {
    if (recipe.id === "juice") return "From Juice machine";
    if (recipe.id === "ice_cream") return "From Ice Cream machine";
    return "Ready to serve";
  }
  return recipe.needs.map((n) => ITEMS[n].label).join(" + ");
}

/** Step-by-step how-to for the recipe tooltip. */
export function recipeHowTo(recipe: Recipe): string {
  if (recipe.id === "pizza") {
    return [
      "1. Take pizza dough (pâte)",
      "2. Put tomato on the dough",
      `3. Bake in the Oven (~${PIZZA_COOK_MS / 1000}s)`,
      "4. Grab a clean plate (wash dirty ones)",
      "5. Take pizza from oven with the plate",
      "6. Deliver to the customer (E)",
    ].join("\n");
  }
  if (recipe.id === "juice") {
    return "1. Press E at the Juice machine\n2. Deliver to the customer (E)";
  }
  if (recipe.id === "ice_cream") {
    return "1. Press E at the Ice Cream machine\n2. Deliver to the customer (E)";
  }
  const steps: string[] = ["1. Grab a plate"];
  let n = 2;
  if (recipe.needs.includes("bun")) {
    steps.push(`${n++}. Take a bun from the bun crate`);
  }
  if (recipe.needs.includes("patty_cooked")) {
    steps.push(`${n++}. Raw patty → Grill (~${COOK_MS / 1000}s)`);
  }
  if (recipe.needs.includes("tomato_chopped")) {
    steps.push(`${n++}. Tomato → Chop board`);
  }
  if (recipe.needs.includes("lettuce_chopped")) {
    steps.push(`${n++}. Mozzarella → Chop board`);
  }
  if (recipe.needs.includes("fries")) {
    steps.push(`${n++}. Potato → Fryer (~${COOK_MS / 1000}s)`);
  }
  steps.push(`${n}. Add everything onto the plate`);
  steps.push(`${n + 1}. Deliver to the customer (E)`);
  return steps.join("\n");
}

export function recipeHintLines(): string[] {
  return RECIPES.map((r) => `${ITEMS[r.id].label}: ${recipeIngredientLine(r)}`);
}
