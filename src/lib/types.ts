export interface MenuItem {
  name: string;
  category: string;
  description: string;
  allergens: string[];
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
