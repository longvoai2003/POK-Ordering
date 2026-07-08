import type { Meal, SelectedIngredient } from "./types";
import { FIXED_PRICE_CATEGORIES } from "./constants";

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

export function calculateIngredientPrice(selection: SelectedIngredient): number {
  const { component, portion } = selection;
  if (FIXED_PRICE_CATEGORIES.includes(component.category)) return component.cost;
  if (component.default_portion <= 0) return component.cost;
  return component.cost * (portion / component.default_portion);
}

export function calculateMealPrice(meal: Meal): number {
  return Object.values(meal).reduce((total, selections) => {
    return total + (selections ?? []).reduce(
      (sum, sel) => sum + calculateIngredientPrice(sel),
      0,
    );
  }, 0);
}
