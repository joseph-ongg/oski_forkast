import { CategoryPreferenceLevel } from './types';

// Confidence scaling by preference strength for category predictions
// Strong signals (love/skip) → high confidence → eligible for auto-accept
// Weak signals (fine) → low confidence → manual rating required
export const PREFERENCE_CONFIDENCE: Record<CategoryPreferenceLevel, number> = {
  love: 0.75,
  skip: 0.75,
  good: 0.55,
  meh: 0.55,
  fine: 0.40,
};

// Common stations that many users want to skip during onboarding
// Hardcoded because onboarding runs before menus are loaded
export const COMMON_SKIPPABLE_STATIONS = [
  'Dessert',
  'Plant Forward',
  'Soup',
  'Salad',
  'Condiments',
];

export interface OnboardingGroup {
  displayName: string;
  taxonomyKeys: string[];
}

export const ONBOARDING_GROUPS: OnboardingGroup[] = [
  { displayName: 'Chicken & Poultry', taxonomyKeys: ['poultry'] },
  { displayName: 'Beef', taxonomyKeys: ['beef'] },
  { displayName: 'Pork', taxonomyKeys: ['pork'] },
  { displayName: 'Fish & Seafood', taxonomyKeys: ['white_fish', 'oily_fish', 'shellfish'] },
  { displayName: 'Tofu & Plant Protein', taxonomyKeys: ['tofu_soy', 'legume'] },
  { displayName: 'Eggs', taxonomyKeys: ['egg'] },
  { displayName: 'Pasta & Noodles', taxonomyKeys: ['pasta'] },
  { displayName: 'Rice & Grains', taxonomyKeys: ['rice_grain'] },
  { displayName: 'Pizza', taxonomyKeys: ['pizza'] },
  { displayName: 'Soup & Stew', taxonomyKeys: ['soup'] },
  { displayName: 'Salad', taxonomyKeys: ['salad'] },
  { displayName: 'Sandwiches & Wraps', taxonomyKeys: ['sandwich'] },
  { displayName: 'Asian Cuisine', taxonomyKeys: ['asian'] },
  { displayName: 'Mexican Food', taxonomyKeys: ['mexican'] },
];

export const PREFERENCE_TO_RATING: Record<CategoryPreferenceLevel, number> = {
  love: 9.0,
  good: 7.5,
  fine: 5.5,
  meh: 3.0,
  skip: -1,
};

// Taxonomy keys that represent food identity (proteins, starches, meal types)
// get weight 1.0 in category prediction. Cuisine keys get 0.5.
const CUISINE_KEYS = new Set(['asian', 'mexican', 'italian', 'mediterranean']);

export function getGroupWeight(taxonomyKey: string): number {
  return CUISINE_KEYS.has(taxonomyKey) ? 0.5 : 1.0;
}

// Build reverse index: taxonomy key → onboarding group display name
const TAXONOMY_TO_GROUP = new Map<string, string>();
for (const group of ONBOARDING_GROUPS) {
  for (const key of group.taxonomyKeys) {
    TAXONOMY_TO_GROUP.set(key, group.displayName);
  }
}

export function getOnboardingGroupForTaxonomy(taxonomyKey: string): string | undefined {
  return TAXONOMY_TO_GROUP.get(taxonomyKey);
}
