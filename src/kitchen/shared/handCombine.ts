/** Proximity / hand assembly: combine held item with a nearby item. */

export type CombineSide = {
  id: string;
  contents: string[];
};

export type CombineResult =
  | {
      kind: "transform_held";
      heldId: string;
      heldContents: string[];
      message: string;
    }
  | {
      kind: "mutate_held_plate";
      heldId: string;
      heldContents: string[];
      message: string;
    }
  | {
      kind: "mutate_other_plate";
      otherId: string;
      otherContents: string[];
      message: string;
    };

const DISHES = new Set([
  "burger",
  "salad",
  "fries_meal",
  "pizza",
  "juice",
  "ice_cream",
]);

function isTomatoTopping(id: string) {
  return id === "tomato" || id === "tomato_washed" || id === "tomato_chopped";
}

function isPlate(id: string) {
  return id === "plate";
}

function canAddToPlate(plateContents: string[], ingredient: string): boolean {
  if (DISHES.has(ingredient)) return false;
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

function tryAssemble(contents: string[]): string | null {
  const set = new Set(contents);
  if (
    set.has("bun") &&
    set.has("patty_cooked") &&
    set.has("lettuce_chopped") &&
    set.has("tomato_chopped") &&
    contents.length === 4
  ) {
    return "burger";
  }
  if (set.has("lettuce_chopped") && set.has("tomato_chopped") && contents.length === 2) {
    return "salad";
  }
  if (set.has("fries") && contents.length === 1) return "fries_meal";
  return null;
}

function labelHint(id: string): string {
  if (id === "lettuce_chopped") return "mozzarella";
  if (id === "lettuce" || id === "lettuce_washed") return "mozzarella";
  if (id === "tomato_chopped") return "chopped tomato";
  if (id === "pizza_dough") return "dough";
  if (id === "pizza_raw") return "raw pizza";
  if (id === "salad") return "Mozzarella plate";
  if (id === "burger") return "burger";
  if (id === "fries_meal") return "fries meal";
  return id.replace(/_/g, " ");
}

/**
 * Pure combine rules for hand ↔ nearby item (floor or station).
 * Caller destroys/consumes `other` when a result is returned.
 */
export function tryHandCombine(held: CombineSide, other: CombineSide): CombineResult | null {
  // Dough + tomato (either way) → raw pizza in hands
  if (held.id === "pizza_dough" && isTomatoTopping(other.id)) {
    return {
      kind: "transform_held",
      heldId: "pizza_raw",
      heldContents: [],
      message: "Raw pizza ready — bake it in the Oven",
    };
  }
  if (isTomatoTopping(held.id) && other.id === "pizza_dough") {
    return {
      kind: "transform_held",
      heldId: "pizza_raw",
      heldContents: [],
      message: "Raw pizza ready — bake it in the Oven",
    };
  }

  // Holding plate → scoop nearby ingredient onto it
  if (isPlate(held.id) && canAddToPlate(held.contents, other.id)) {
    const contents = [...held.contents, other.id];
    const dish = tryAssemble(contents);
    if (dish) {
      return {
        kind: "mutate_held_plate",
        heldId: dish,
        heldContents: [],
        message: `Plated ${labelHint(dish)}! Deliver to customer`,
      };
    }
    return {
      kind: "mutate_held_plate",
      heldId: "plate",
      heldContents: contents,
      message: `Added ${labelHint(other.id)} to plate`,
    };
  }

  // Holding ingredient → drop onto nearby plate
  if (isPlate(other.id) && canAddToPlate(other.contents, held.id)) {
    const contents = [...other.contents, held.id];
    const dish = tryAssemble(contents);
    if (dish) {
      return {
        kind: "mutate_other_plate",
        otherId: dish,
        otherContents: [],
        message: `Plated ${labelHint(dish)}! Deliver to customer`,
      };
    }
    return {
      kind: "mutate_other_plate",
      otherId: "plate",
      otherContents: contents,
      message: `Added ${labelHint(held.id)} to plate`,
    };
  }

  return null;
}

/** True if these two sides can combine (for prompts). */
export function canHandCombine(held: CombineSide, other: CombineSide): boolean {
  return tryHandCombine(held, other) !== null;
}
