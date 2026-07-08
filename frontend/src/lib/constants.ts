import type { CategorySlug } from "./types";

export const CATEGORY_DISPLAY_ORDER: CategorySlug[] = [
  "base",
  "protein",
  "cook_veg",
  "sauce",
  "raw_veg",
  "topping",
  "egg",
  "cooking_oil",
];

export const REQUIRED_CATEGORIES: CategorySlug[] = [
  "base",
  "protein",
  "cook_veg",
  "sauce",
];

export const OPTIONAL_CATEGORIES: CategorySlug[] = [
  "raw_veg",
  "topping",
  "egg",
  "cooking_oil",
];

export const FIXED_PRICE_CATEGORIES: CategorySlug[] = [
  "sauce",
  "topping",
  "cooking_oil",
];

export const MULTI_SELECT_CATEGORIES: CategorySlug[] = [
  "base",
  "protein",
  "cook_veg",
  "raw_veg",
  "egg",
];

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  base: "Base",
  protein: "Protein",
  cook_veg: "Cooked Vegetables",
  sauce: "Sauce",
  raw_veg: "Raw Vegetables",
  topping: "Toppings",
  egg: "Eggs",
  cooking_oil: "Cooking Oils",
};

export const CATEGORY_ICONS: Record<CategorySlug, string> = {
  base: "🍚",
  protein: "🥩",
  cook_veg: "🥬",
  sauce: "🫙",
  raw_veg: "🥑",
  topping: "🥜",
  egg: "🍳",
  cooking_oil: "🛢️",
};
