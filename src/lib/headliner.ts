import { MenuItem, DishType } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HeadlinerClassification {
  dishType: DishType;
  isHeadliner: boolean;
  score: number;
  reason: string;
}

// ─── Token Lists (owned by headliner.ts, NOT imported from prediction.ts) ──

const PROTEIN_TOKENS = new Set([
  'chicken', 'turkey', 'duck', 'hen', 'wing', 'wings', 'drumstick', 'thigh', 'breast',
  'beef', 'steak', 'burger', 'hamburger', 'brisket', 'meatball', 'meatloaf', 'sirloin', 'patty', 'veal',
  'pork', 'bacon', 'ham', 'sausage', 'bratwurst', 'carnitas', 'chorizo',
  'cod', 'tilapia', 'catfish', 'halibut', 'bass', 'sole', 'haddock', 'pollock', 'swai', 'mahi',
  'salmon', 'tuna', 'mackerel', 'trout',
  'shrimp', 'crab', 'lobster', 'clam', 'scallop', 'calamari', 'squid', 'prawn',
  'tofu', 'tempeh', 'seitan',
  'egg', 'eggs', 'omelette', 'omelet', 'frittata', 'scramble', 'quiche',
  'falafel',
]);

const STARCH_TOKENS = new Set([
  'pasta', 'spaghetti', 'penne', 'fusilli', 'linguine', 'rigatoni', 'macaroni', 'lasagna', 'ravioli', 'tortellini', 'gnocchi',
  'noodle', 'noodles', 'ramen', 'udon',
  'pizza', 'calzone',
  'rice', 'risotto', 'pilaf', 'biryani',
  'sandwich', 'wrap', 'panini', 'sub', 'melt', 'slider', 'sliders',
  'burrito', 'taco', 'tacos', 'enchilada', 'quesadilla', 'tamale',
  'bowl',
]);

const CUISINE_SAUCE_TOKENS = new Set([
  'marinara', 'alfredo', 'pesto', 'bolognese', 'parmesan', 'parmigiana',
  'teriyaki', 'kung pao', 'szechuan', 'katsu', 'bibimbap', 'bulgogi',
  'curry', 'tikka', 'masala', 'tandoori',
  'chipotle', 'al pastor', 'asada', 'pozole',
  'mediterranean', 'gyro', 'shawarma', 'kebab',
  'buffalo', 'bbq', 'barbecue',
  'cacciatore', 'piccata', 'marsala', 'saltimbocca',
  'lemon butter', 'garlic butter',
  'mango salsa', 'chimichurri',
  'cajun', 'jerk', 'blackened',
]);

const SUPPORT_TOKENS = new Set([
  'dressing', 'topping', 'garnish', 'seasoning', 'vinaigrette', 'spread',
  'aioli', 'mayo', 'mayonnaise', 'vinegar', 'syrup', 'jelly', 'jam',
  'relish', 'ketchup', 'mustard',
]);

const SINGLE_VEG_TOKENS = new Set([
  'broccoli', 'carrots', 'onions', 'mushrooms', 'peppers', 'zucchini',
  'spinach', 'kale', 'cabbage', 'celery', 'asparagus', 'beets',
  'cauliflower', 'corn', 'peas', 'squash', 'eggplant', 'artichoke',
  'radish', 'turnip', 'parsnip', 'cucumber', 'tomatoes', 'tomato',
  'lettuce', 'arugula', 'chard', 'collards',
  'olives', 'pickles', 'jalapenos', 'cilantro', 'basil', 'chive',
]);

const DESSERT_TOKENS = new Set([
  'cake', 'cupcake', 'cheesecake', 'brownie', 'brownies', 'blondie',
  'cookie', 'cookies', 'pie', 'tart', 'cobbler', 'crumble', 'strudel', 'danish', 'pastry',
  'ice cream', 'gelato', 'sorbet', 'sundae', 'smoothie', 'milkshake',
  'pudding', 'mousse', 'custard', 'flan', 'tiramisu',
  'donut', 'donuts', 'muffin', 'muffins',
]);

const BEVERAGE_TOKENS = new Set([
  'coffee', 'tea', 'juice', 'water', 'milk', 'lemonade', 'soda',
]);

const CONDIMENT_STATIONS = ['condiment', 'topping', 'produce', 'salad bar', 'deli bar'];
const DESSERT_STATIONS = ['dessert', 'bakery', 'pastry'];
const BEVERAGE_STATIONS = ['beverage', 'drink'];

// ─── Tokenizer (simple, purpose-built for headliner scoring) ────────────────

function tokenize(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 2);
}

function nameContainsAny(lower: string, tokens: Set<string>): boolean {
  return Array.from(tokens).some(token => {
    if (token.includes(' ')) {
      return lower.includes(token);
    }
    return new RegExp(`\\b${token}\\b`).test(lower);
  });
}

function getMatchingTokens(lower: string, tokens: Set<string>): string[] {
  return Array.from(tokens).filter(token => {
    if (token.includes(' ')) {
      return lower.includes(token);
    }
    return new RegExp(`\\b${token}\\b`).test(lower);
  });
}

// ─��─ classifyDish ───────────────────────────────────────────────────────────

export function classifyDish(item: MenuItem): HeadlinerClassification {
  const lower = item.name.toLowerCase();
  const tokens = tokenize(item.name);
  const station = (item.category || '').toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  // Rule 1: +3 for protein token
  if (nameContainsAny(lower, PROTEIN_TOKENS)) {
    score += 3;
    reasons.push('protein_token');
  }

  // Rule 2: +3 for cuisine/sauce differentiator
  if (nameContainsAny(lower, CUISINE_SAUCE_TOKENS)) {
    score += 3;
    reasons.push('cuisine_differentiator');
  }

  // Rule 3: +2 for primary starch token
  if (nameContainsAny(lower, STARCH_TOKENS)) {
    score += 2;
    reasons.push('starch_token');
  }

  // Rule 4: +1 if name is >= 3 words long
  if (tokens.length >= 3) {
    score += 1;
    reasons.push('long_name');
  }

  // Rule 5: -3 if single plant word with no protein/starch
  if (tokens.length <= 2 && nameContainsAny(lower, SINGLE_VEG_TOKENS)
    && !nameContainsAny(lower, PROTEIN_TOKENS) && !nameContainsAny(lower, STARCH_TOKENS)) {
    score -= 3;
    reasons.push('single_veg');
  }

  // Rule 6: -5 if support word (dressing, sauce standalone, topping, etc.)
  if (nameContainsAny(lower, SUPPORT_TOKENS)) {
    // "sauce" alone is support, but "Alfredo Sauce" has a cuisine token that overrides
    score -= 5;
    reasons.push('support_word');
  }

  // Rule 7: -2 if station name suggests non-entree
  if (CONDIMENT_STATIONS.some(s => station.includes(s))) {
    score -= 2;
    reasons.push('condiment_station');
  }

  // Determine dishType
  let dishType: DishType = 'side';
  if (nameContainsAny(lower, DESSERT_TOKENS) || DESSERT_STATIONS.some(s => station.includes(s))) {
    dishType = 'dessert';
  } else if (nameContainsAny(lower, BEVERAGE_TOKENS) || BEVERAGE_STATIONS.some(s => station.includes(s))) {
    dishType = 'beverage';
  } else if (nameContainsAny(lower, SUPPORT_TOKENS)) {
    dishType = score >= 0 ? 'sauce' : 'condiment';
  } else if (score >= 3) {
    dishType = 'entree';
  }

  return {
    dishType,
    isHeadliner: score >= 3,
    score,
    reason: reasons.join(', '),
  };
}

// ─── filterToHeadliners ─────────────────────────────────────────────────────

export function filterToHeadliners(
  items: MenuItem[],
  opts?: { minPerStation?: number; maxPerStation?: number }
): MenuItem[] {
  const minPerStation = opts?.minPerStation ?? 1;
  const maxPerStation = opts?.maxPerStation ?? 5;

  // Group items by station
  const stationMap = new Map<string, MenuItem[]>();
  items.forEach(item => {
    const station = item.category || '';
    const existing = stationMap.get(station);
    if (existing) {
      existing.push(item);
    } else {
      stationMap.set(station, [item]);
    }
  });

  const result: MenuItem[] = [];

  stationMap.forEach(stationItems => {
    // Score all items in this station
    const scored = stationItems.map((item: MenuItem) => ({
      item,
      classification: classifyDish(item),
    }));

    // Sort by score descending
    scored.sort((a: typeof scored[0], b: typeof scored[0]) => b.classification.score - a.classification.score);

    // Sibling-aware dedup: collapse items sharing both base token and sauce token
    const deduped = siblingDedup(scored.map((s: typeof scored[0]) => ({
      item: s.item,
      score: s.classification.score,
      isHeadliner: s.classification.isHeadliner,
    })));

    // Select headliners with min/max bounds
    let headliners = deduped.filter((s: ScoredItem) => s.isHeadliner);

    // Conditional min: only promote if best item has score >= 1
    if (headliners.length < minPerStation && deduped.length > 0 && deduped[0].score >= 1) {
      headliners = deduped.slice(0, minPerStation);
    }

    // Cap at max
    if (headliners.length > maxPerStation) {
      headliners = headliners.slice(0, maxPerStation);
    }

    headliners.forEach((h: ScoredItem) => result.push(h.item));
  });

  return result;
}

// ─── Sibling-aware dedup ────────────────────────────────────────────────────
// If two dishes share the same primary token AND the same sauce/differentiator,
// keep only the highest-scoring one. Different sauces = both survive.

interface ScoredItem {
  item: MenuItem;
  score: number;
  isHeadliner: boolean;
}

function siblingDedup(items: ScoredItem[]): ScoredItem[] {
  if (items.length <= 1) return items;

  const result: ScoredItem[] = [];
  const seen = new Set<string>();

  items.forEach(entry => {
    const lower = entry.item.name.toLowerCase();
    const proteins = getMatchingTokens(lower, PROTEIN_TOKENS);
    const starches = getMatchingTokens(lower, STARCH_TOKENS);
    const sauces = getMatchingTokens(lower, CUISINE_SAUCE_TOKENS);

    // Build a dedup key from primary token + differentiator
    const primary = proteins[0] || starches[0] || '';
    const differentiator = sauces[0] || '';
    const key = primary ? `${primary}::${differentiator}` : '';

    if (!key || !seen.has(key)) {
      result.push(entry);
      if (key) seen.add(key);
    }
  });

  return result;
}
