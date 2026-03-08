import { MenuItem, Rankings, StationScoreResult, HallScoreResult, MenuData } from './types';

/**
 * Calculates score for a specific station (list of items).
 * Exact port of Python's calculate_station_score.
 */
export function calculateStationScore(
  items: MenuItem[],
  rankings: Rankings
): Omit<StationScoreResult, 'name'> {
  let riceItem: { item: MenuItem; rating: number } | null = null;
  const entrees: { item: MenuItem; rating: number }[] = [];

  for (const item of items) {
    if (!(item.name in rankings)) continue;
    const rating = rankings[item.name];
    if (rating < 0) continue; // skipped dish — won't eat

    if (item.name.toLowerCase().includes('rice')) {
      if (riceItem === null || rating > riceItem.rating) {
        riceItem = { item, rating };
      }
    } else {
      entrees.push({ item, rating });
    }
  }

  // Sort entrees by rating descending
  entrees.sort((a, b) => b.rating - a.rating);

  // Take top 2 entrees
  const topEntrees = entrees.slice(0, 2);

  if (topEntrees.length === 0) {
    return { score: 0, details: [], entree_avg: 0, rice_bonus: 0 };
  }

  const entree1 = topEntrees[0];
  const entree2 = topEntrees.length > 1 ? topEntrees[1] : null;

  // Conditional Entree Averaging
  // If Entree 2 exists and is >= 8, average them. Otherwise just use Entree 1.
  let avgEntreeScore: number;
  let usedEntrees: { item: MenuItem; rating: number }[];

  if (entree2 && entree2.rating >= 8) {
    avgEntreeScore = (entree1.rating + entree2.rating) / 2;
    usedEntrees = [entree1, entree2];
  } else {
    avgEntreeScore = entree1.rating;
    usedEntrees = [entree1];
  }

  let riceBonus = 0;
  if (riceItem) {
    riceBonus = 0.1 * riceItem.rating;
  }

  let totalScore = avgEntreeScore + riceBonus;

  const details = usedEntrees.map((e) => e.item);
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
 * Exact port of Python's calculate_hall_score.
 */
export function calculateHallScore(
  menu: MenuData,
  rankings: Rankings,
  mealPeriod: string,
  ignoredCategories: Set<string> = new Set()
): HallScoreResult {
  if (!(mealPeriod in menu.meals)) {
    return { total_score: 0, stations: [] };
  }

  const items = menu.meals[mealPeriod];

  // Group by category (Station)
  const stations: Record<string, MenuItem[]> = {};
  for (const item of items) {
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
    const res = calculateStationScore(stationItems, rankings);
    if (res.score > 0) {
      stationScores.push({ ...res, name: stationName });
    }
  }

  // Sort stations by score descending
  stationScores.sort((a, b) => b.score - a.score);

  if (stationScores.length === 0) {
    return { total_score: 0, stations: [] };
  }

  const stn1 = stationScores[0];
  const stn2 = stationScores.length > 1 ? stationScores[1] : null;

  let finalScore = stn1.score;
  const chosenStations: StationScoreResult[] = [stn1];

  // Combine Logic: if 2nd station >= 8, average + 1 variety bonus
  if (stn2 && stn2.score >= 8) {
    finalScore = (stn1.score + stn2.score) / 2 + 1;
    chosenStations.push(stn2);
  }

  return {
    total_score: finalScore,
    stations: chosenStations,
  };
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
