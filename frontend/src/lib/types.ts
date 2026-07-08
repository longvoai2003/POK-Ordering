export type CategorySlug =
  | "base"
  | "protein"
  | "cook_veg"
  | "sauce"
  | "raw_veg"
  | "topping"
  | "egg"
  | "cooking_oil";

export interface Component {
  component_id: string;
  component_name: string;
  category: CategorySlug;
  is_available: boolean;
  default_portion: number;
  unit: "g" | "ml" | "count";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  min_portion: number;
  max_portion: number;
  portion_step: number;
  description: string;
  fiber: number;
  cost: number;
  skip_portion: boolean;
}

export interface SelectedIngredient {
  component: Component;
  portion: number;
}

export interface Meal {
  [category: string]: SelectedIngredient[];
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
