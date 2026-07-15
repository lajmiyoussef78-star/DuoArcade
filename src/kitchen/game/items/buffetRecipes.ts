import { COOK_MS, ITEMS, type ItemId } from "./types";

export type BuffetRecipeGuide = {
  id: string;
  name: string;
  icon: ItemId;
  howTo: string;
  line: string;
};

export const BUFFET_GUIDES: BuffetRecipeGuide[] = [
  {
    id: "chicken",
    name: "Fried Chicken",
    icon: "chicken_fried",
    line: "Chicken → Flour → Fryer → Tray (+2 / max 6)",
    howTo: [
      "1. Take raw chicken legs",
      "2. Dip in flour",
      `3. Fry (~${COOK_MS / 1000}s)`,
      "4. Stock into Chicken tray (+2, max 6)",
    ].join("\n"),
  },
  {
    id: "shrimp",
    name: "Fried Shrimp",
    icon: "shrimp_fried",
    line: "Shrimp → Chop → Flour → Fryer → Tray (+2 / max 4)",
    howTo: [
      "1. Take raw shrimp",
      "2. Chop on prep board",
      "3. Dip in flour",
      `4. Fry (~${COOK_MS / 1000}s)`,
      "5. Stock into Shrimp tray (+2, max 4)",
    ].join("\n"),
  },
  {
    id: "fries",
    name: "French Fries",
    icon: "fries",
    line: "Raw fries → Fryer → Tray (+5 / max 10)",
    howTo: [
      "1. Take raw fries",
      `2. Fry (~${COOK_MS / 1000}s)`,
      "3. Stock into Fries tray (+5, max 10)",
    ].join("\n"),
  },
  {
    id: "tomato",
    name: "Grilled Tomatoes",
    icon: "tomato_grilled",
    line: `Tomato → Chop → Grill pan → Tray (+2 / max 2)`,
    howTo: [
      "1. Take a grill pan from the grill",
      "2. Chop tomato / pepper",
      "3. Put chopped veg on the pan",
      "4. Put the pan back on a grill slot",
      "5. Take pan when ready → empty into tray",
    ].join("\n"),
  },
  {
    id: "pepper",
    name: "Grilled Peppers",
    icon: "pepper_grilled",
    line: "Pan → Chop pepper → Grill slot → Tray (+2 / max 2)",
    howTo: [
      "1. Take a grill pan from the grill",
      "2. Chop a pepper",
      "3. Put it on the pan",
      "4. Return pan to a grill slot",
      "5. Take pan when ready → empty into tray",
    ].join("\n"),
  },
  {
    id: "juice",
    name: "Juice",
    icon: "juice",
    line: "Juice machine → serve while eating",
    howTo: [
      "1. Press E at the Juice machine",
      "2. Deliver to a customer requesting juice (E)",
    ].join("\n"),
  },
];

export function buffetGuideLabel(id: string): string {
  return BUFFET_GUIDES.find((g) => g.id === id)?.name ?? ITEMS.juice.label;
}
