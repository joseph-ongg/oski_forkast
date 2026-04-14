import { Rankings, DietaryPreferences, CategoryPreferences, HallDistances, MealSize } from './types';

const RANKINGS_KEY = 'croads_rankings';
const IGNORED_CATEGORIES_KEY = 'croads_ignored_categories';
const DIETARY_PREFS_KEY = 'croads_dietary_preferences';
const CATEGORY_PREFS_KEY = 'croads_category_preferences';
const ONBOARDING_COMPLETE_KEY = 'croads_onboarding_complete';
const AUTO_ACCEPT_KEY = 'croads_auto_accept';
const ENTREES_ONLY_KEY = 'croads_entrees_only'; // legacy, migrated to headliners_only
const HEADLINERS_ONLY_KEY = 'croads_headliners_only';
const PRECISE_MODE_KEY = 'croads_precise_mode';
const VEGAN_MEAT_PREF_KEY = 'croads_vegan_meat_pref';
const HALL_DISTANCES_KEY = 'croads_hall_distances';
const BASELINE_SCORE_KEY = 'croads_baseline_score';
const MEAL_SIZE_KEY = 'croads_meal_size';

export function loadRankings(): Rankings {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(RANKINGS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveRankings(rankings: Rankings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RANKINGS_KEY, JSON.stringify(rankings));
}

export function loadIgnoredCategories(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(IGNORED_CATEGORIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveIgnoredCategories(categories: string[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(IGNORED_CATEGORIES_KEY, JSON.stringify(categories));
}

export function loadDietaryPreferences(): DietaryPreferences {
  if (typeof window === 'undefined') return { diets: [], allergens: [] };
  try {
    const data = localStorage.getItem(DIETARY_PREFS_KEY);
    return data ? JSON.parse(data) : { diets: [], allergens: [] };
  } catch {
    return { diets: [], allergens: [] };
  }
}

export function saveDietaryPreferences(prefs: DietaryPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DIETARY_PREFS_KEY, JSON.stringify(prefs));
}

export function loadCategoryPreferences(): CategoryPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(CATEGORY_PREFS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveCategoryPreferences(prefs: CategoryPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CATEGORY_PREFS_KEY, JSON.stringify(prefs));
}

export function isOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingComplete(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}

export function loadAutoAccept(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUTO_ACCEPT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAutoAccept(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_ACCEPT_KEY, enabled ? 'true' : 'false');
}

export function loadEntreesOnly(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ENTREES_ONLY_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveEntreesOnly(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENTREES_ONLY_KEY, enabled ? 'true' : 'false');
}

// 'yes' = would eat vegan meat, 'no' = skip vegan meat, null = not set
export function loadVeganMeatPref(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(VEGAN_MEAT_PREF_KEY);
    if (val === 'yes') return true;
    if (val === 'no') return false;
    return null;
  } catch {
    return null;
  }
}

export function saveVeganMeatPref(wouldEat: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VEGAN_MEAT_PREF_KEY, wouldEat ? 'yes' : 'no');
}

export function loadHallDistances(): HallDistances {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(HALL_DISTANCES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveHallDistances(distances: HallDistances): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HALL_DISTANCES_KEY, JSON.stringify(distances));
}

export function loadBaselineScore(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(BASELINE_SCORE_KEY);
    return data ? parseFloat(data) : null;
  } catch {
    return null;
  }
}

export function saveBaselineScore(score: number | null): void {
  if (typeof window === 'undefined') return;
  if (score === null) {
    localStorage.removeItem(BASELINE_SCORE_KEY);
  } else {
    localStorage.setItem(BASELINE_SCORE_KEY, String(score));
  }
}

// Migrate old entreesOnly → headlinersOnly (one-time)
function migrateEntreesToHeadliners(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(HEADLINERS_ONLY_KEY) === null) {
      const old = localStorage.getItem(ENTREES_ONLY_KEY);
      if (old !== null) {
        localStorage.setItem(HEADLINERS_ONLY_KEY, old);
      }
    }
  } catch {}
}

export function loadHeadlinersOnly(): boolean {
  if (typeof window === 'undefined') return false;
  migrateEntreesToHeadliners();
  try {
    return localStorage.getItem(HEADLINERS_ONLY_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveHeadlinersOnly(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HEADLINERS_ONLY_KEY, enabled ? 'true' : 'false');
}

export function loadPreciseMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PRECISE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function savePreciseMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PRECISE_MODE_KEY, enabled ? 'true' : 'false');
}

export function loadMealSize(): MealSize {
  if (typeof window === 'undefined') return 2;
  try {
    const val = parseInt(localStorage.getItem(MEAL_SIZE_KEY) || '');
    if (val >= 1 && val <= 4) return val as MealSize;
    return 2;
  } catch {
    return 2;
  }
}

export function saveMealSize(size: MealSize): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MEAL_SIZE_KEY, String(size));
}
