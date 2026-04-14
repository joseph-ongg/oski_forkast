import { MenuItem, Rankings, StationScoreResult, HallScoreResult, MenuData, MealSize } from './types';

// Diminishing weights for top-N items (index 0 = best item)
const MEAL_WEIGHTS = [1.0, 0.7, 0.5, 0.3];

/**
 * Weighted average of `values` using MEAL_WEIGHTS (truncated to length).
 */
function weightedAvg(values: number[]): number {
  if (values.length === 0) return 0;
  let sumW = 0;
  let sumWV = 0;
  for (let i = 0; i < values.length; i++) {
    const w = MEAL_WEIGHTS[i] ?? MEAL_WEIGHTS[MEAL_WEIGHTS.length - 1];
    sumW += w;
    sumWV += w * values[i];
  }
  return sumWV / sumW;
}

/**
 * Calculates score for a specific station (list of items).
 * Uses weighted top-N entrees where N = mealSize.
 */
export function calculateStationScore(
  items: MenuItem[],
  rankings: Rankings,
  mealSize: MealSize = 2
): Omit<StationScoreResult, 'name'> {
  let riceItem: { item: MenuItem; rating: number } | null = null;
  const entrees: { item: MenuItem; rating: number }[] = [];

  for (const item of items) {
    if (!(item.name in rankings)) continue;
    const rating = rankings[item.name];
    if (rating < 0) continue; // skipped dish — won't eat

    if (/\brice\b/.test(item.name.toLowerCase())) {
      if (riceItem === null || rating > riceItem.rating) {
        riceItem = { item, rating };
      }
    } else {
      entrees.push({ item, rating });
    }
  }

  // Sort entrees by rating descending
  entrees.sort((a, b) => b.rating - a.rating);

  // Take top N entrees (N = mealSize)
  const topEntrees = entrees.slice(0, mealSize);

  if (topEntrees.length === 0) {
    return { score: 0, details: [], entree_avg: 0, rice_bonus: 0 };
  }

  // Weighted average of top entrees using diminishing weights
  const avgEntreeScore = weightedAvg(topEntrees.map(e => e.rating));

  let riceBonus = 0;
  if (riceItem) {
    riceBonus = 0.1 * riceItem.rating;
  }

  const totalScore = Math.min(avgEntreeScore + riceBonus, 10);

  const details = topEntrees.map((e) => e.item);
  if (riceItem) {
    details.push(riceItem.item);
  }

  return {
    score: totalScore,
    details,
    entree_avg: avgEntreeScore,
    rice_bonus: riceBonus,
  };
}

/**
 * Calculates overall score for a dining hall for a specific meal period.
 * Uses weighted top-N stations where N = mealSize.
 */
export function calculateHallScore(
  menu: MenuData,
  rankings: Rankings,
  mealPeriod: string,
  ignoredCategories: Set<string> = new Set(),
  excludeItems: Set<string> = new Set(),
  mealSize: MealSize = 2
): HallScoreResult {
  if (!(mealPeriod in menu.meals)) {
    return { total_score: 0, stations: [] };
  }

  const items = menu.meals[mealPeriod];

  // Group by category (Station)
  const stations: Record<string, MenuItem[]> = {};
  for (const item of items) {
    if (excludeItems.size > 0 && excludeItems.has(item.name)) {
      continue;
    }
    if (ignoredCategories.size > 0 && ignoredCategories.has(item.category.toLowerCase())) {
      continue;
    }
    if (!stations[item.category]) {
      stations[item.category] = [];
    }
    stations[item.category].push(item);
  }

  // Calculate score for each station
  const stationScores: StationScoreResult[] = [];
  for (const [stationName, stationItems] of Object.entries(stations)) {
    const res = calculateStationScore(stationItems, rankings, mealSize);
    if (res.score > 0) {
      stationScores.push({ ...res, name: stationName });
    }
  }

  // Sort stations by score descending
  stationScores.sort((a, b) => b.score - a.score);

  if (stationScores.length === 0) {
    return { total_score: 0, stations: [] };
  }

  // Consider up to mealSize stations — a grazer visits more stations
  const stationCount = Math.min(mealSize, stationScores.length);
  const chosenStations = stationScores.slice(0, stationCount);

  // Weighted average of chosen station scores (no variety bonus)
  const finalScore = weightedAvg(chosenStations.map(s => s.score));

  return {
    total_score: finalScore,
    stations: chosenStations,
  };
}

/**
 * Get item names from earlier meal periods for a given hall.
 * Used to exclude dishes you'd already eat at an earlier meal.
 */
export function getEarlierMealItems(menu: MenuData, currentPeriod: string): Set<string> {
  const order = ['Breakfast', 'Brunch', 'Lunch', 'Dinner'];
  const currentIdx = order.indexOf(currentPeriod);
  const items = new Set<string>();
  if (currentIdx <= 0) return items;

  for (let i = 0; i < currentIdx; i++) {
    const period = order[i];
    if (period in menu.meals) {
      for (const item of menu.meals[period]) {
        items.add(item.name);
      }
    }
  }
  return items;
}

/**
 * Get current meal period based on day/time.
 */
export function getCurrentMealPeriod(): string {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    return hour < 15 ? 'Brunch' : 'Dinner';
  } else {
    if (hour < 10) return 'Breakfast';
    if (hour < 15) return 'Lunch';
    return 'Dinner';
  }
}

/**
 * Resolve the active meal period for a menu, handling Brunch/Lunch fallbacks.
 */
export function resolveActivePeriod(menu: MenuData, requestedPeriod: string): string | null {
  if (requestedPeriod in menu.meals) return requestedPeriod;
  if (requestedPeriod === 'Brunch' && 'Lunch' in menu.meals) return 'Lunch';
  if (requestedPeriod === 'Lunch' && 'Brunch' in menu.meals) return 'Brunch';
  if (requestedPeriod === 'Brunch' && 'Breakfast' in menu.meals) return 'Breakfast';
  return null;
}
