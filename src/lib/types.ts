export interface MenuItem {
  name: string;
  category: string;
  description: string;
  allergens: string[];
  dietaryChoices: string[];
}

export interface DietaryPreferences {
  diets: string[];      // e.g. ["Vegan Option", "Halal"] — require presence
  allergens: string[];  // e.g. ["Peanut", "Milk"] — require absence
}

export interface MealData {
  [mealPeriod: string]: MenuItem[];
}

export interface MenuData {
  location: string;
  date: string;
  meals: MealData;
}

export interface StationScoreResult {
  score: number;
  name: string;
  details: MenuItem[];
  entree_avg: number;
  rice_bonus: number;
}

export interface HallScoreResult {
  total_score: number;
  stations: StationScoreResult[];
}

export interface HallResult {
  location: string;
  score: HallScoreResult;
  activePeriod: string;
}

export type Rankings = Record<string, number>;

// Hall name → walk time in minutes (0 = on-site, unset = no penalty)
export type HallDistances = Record<string, number>;

export type CategoryPreferenceLevel = 'love' | 'good' | 'fine' | 'meh' | 'skip';
export type CategoryPreferences = Record<string, CategoryPreferenceLevel>;

export interface Prediction {
  rating: number; // -1 means predicted skip
  confidence: number;
  similarDishes: { name: string; rating: number; similarity: number }[];
  predictedSkip: boolean;
}
