import { MenuItem, DietaryPreferences } from './types';

/**
 * Check if a dish should be excluded based on dietary preferences.
 * - Diet filter: if user requires "Halal", exclude dishes where "Halal" is NOT in dietaryChoices
 * - Allergen filter: if user avoids "Peanut", exclude dishes where "Peanut" IS in allergens
 */
// Vegan is a subset of vegetarian — vegan dishes satisfy vegetarian requirements
function dishMatchesDiet(item: MenuItem, diet: string): boolean {
  if (item.dietaryChoices.includes(diet)) return true;
  if (diet === 'Vegetarian Option' && item.dietaryChoices.includes('Vegan Option')) return true;
  return false;
}

export function shouldExcludeDish(item: MenuItem, prefs: DietaryPreferences): boolean {
  // Diet requirement: dish must match ALL selected diets
  for (const diet of prefs.diets) {
    if (!dishMatchesDiet(item, diet)) {
      return true;
    }
  }

  // Allergen avoidance: dish must NOT have ANY selected allergens
  for (const allergen of prefs.allergens) {
    if (item.allergens.includes(allergen)) {
      return true;
    }
  }

  return false;
}

/**
 * Compute the set of dish names to exclude from a list of menus.
 */
export function getExcludedDishNames(
  items: MenuItem[],
  prefs: DietaryPreferences
): Set<string> {
  const excluded = new Set<string>();
  if (prefs.diets.length === 0 && prefs.allergens.length === 0) return excluded;
  for (const item of items) {
    if (shouldExcludeDish(item, prefs)) {
      excluded.add(item.name);
    }
  }
  return excluded;
}

export function hasActiveDietaryFilters(prefs: DietaryPreferences): boolean {
  return prefs.diets.length > 0 || prefs.allergens.length > 0;
}
