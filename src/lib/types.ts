export interface Macros {
  kcal: number;
  p: number; // protéines (g)
  c: number; // glucides (g)
  f: number; // lipides (g)
  fiber: number;
}

export type PregLevel = 'ok' | 'caution' | 'avoid';

export interface Ingredient {
  id: string;
  name: string;
  aisle: string;
  per100: Macros;
  pieceG?: number;
  pieceName?: string;
  csG?: number;
  mlG?: number;
  packs?: number[];
  soldBy: 'weight' | 'piece' | 'pack';
  eurKg: number; // prix de repli
  opTag?: string;
  opCat?: string;
  preg?: { level: 'caution' | 'avoid'; why: string };
  pantry: boolean;
  /** Jamais acheté (eau du robinet). */
  noBuy?: boolean;
  /** Pour 100 g : sucres, acides gras saturés, sel (g). */
  nutri?: { sugars: number; sat: number; salt: number };
  /** Fruit, légume ou légumineuse (compte dans la note nutritionnelle). */
  fvl?: boolean;
  /** Viande rouge ou charcuterie (plafond des points protéines). */
  redMeat?: boolean;
  /** Poids une fois cuit / poids sec (pâtes, riz, légumineuses sèches…). */
  cookedFactor?: number;
}

export type Unit = 'g' | 'ml' | 'cs' | 'cc' | 'pc';
export interface Qty {
  n: number;
  unit: Unit;
}

export interface RecipeIng {
  ing: string; // id d'ingrédient
  qty: Qty;
}

export type MealType = 'pdj' | 'plat' | 'collation';

export interface Recipe {
  id: string;
  title: string;
  meal: MealType;
  servings: number;
  prep: number; // minutes
  cook: number; // minutes
  ings: RecipeIng[];
  steps: string[];
  batch?: { keepDays: number; freeze: boolean };
  /** Lignes d'ingrédients importées mais non reconnues (ajoutées telles quelles aux courses). */
  loose?: string[];
  sourceUrl?: string;
  custom?: boolean;
  pregNote?: string;
}

export type Slot = 'pdj' | 'dej' | 'col' | 'din';

export interface PlanEntry {
  id: string;
  date: string; // AAAA-MM-JJ
  slot: Slot;
  recipeId: string;
  /** Portions par profil (id → nombre de portions). */
  portions: Record<string, number>;
  /** Portions supplémentaires (invités, enfants). */
  extra: number;
  /** Repas issu des restes d'un autre repas (batch cooking). */
  leftoverOf?: string;
}

export interface Profile {
  id: string;
  name: string;
  sex: 'm' | 'f';
  birth: string;
  heightCm: number;
  activity: number; // facteur d'activité (1.2 → 1.725)
  startKg: number;
  startDate: string;
  targetKg: number;
  targetDate: string;
  pregnant?: boolean;
  dueDate?: string;
  stepGoal: number;
  color: string;
}

export interface LogEntry {
  id: string;
  profileId: string;
  date: string;
  slot: Slot;
  label: string;
  qty: string;
  macros: Macros;
  planId?: string;
}

export interface Workout {
  id: string;
  profileId: string;
  date: string;
  type: string;
  minutes: number;
  intensity: 'low' | 'mid' | 'high';
  kcal: number;
  note?: string;
}

export interface StepsDay {
  id: string;
  profileId: string;
  date: string;
  count: number;
  src: 'manual' | 'health';
}

export interface WeightEntry {
  id: string;
  profileId: string;
  date: string;
  kg: number;
}

export interface ShoppingState {
  id: string;
  from: string;
  to: string;
  status: 'draft' | 'validated';
  validatedAt?: string;
  /** Lignes cochées en magasin. */
  checked: Record<string, boolean>;
  /** Forçage manuel « à acheter » / « j'en ai déjà » (sinon : placard = j'en ai déjà). */
  need: Record<string, boolean>;
  /** Articles ajoutés à la main. */
  extras: { id: string; label: string; checked: boolean }[];
}

export interface Settings {
  id: 'settings';
  weeklyBudget: number;
}

export interface PriceOverride {
  id: string;
  ingId: string;
  eurKg: number;
}
