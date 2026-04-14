import { describe, it, expect } from 'vitest';
import { classifyDish } from '../headliner';
import { MenuItem } from '../types';

// Import the real rankings from the prediction real-data test
// We inline a subset here for the headliner guardrail test.
// These are real dishes rated 8+ by a real user — hiding any of them would be a visible regression.

const highRatedDishes: { name: string; rating: number }[] = [
  { name: "Bacon and Cheese Eggs Scramble", rating: 8 },
  { name: "Bacon Bits", rating: 8 },
  { name: "Baja Fish Taco", rating: 9 },
  { name: "Baked Cod with Lemon Butter", rating: 8 },
  { name: "Baked Penne Pasta", rating: 8 },
  { name: "Baked Pineapple Teriyaki Salmon", rating: 9 },
  { name: "Baked Pork Bacon", rating: 8 },
  { name: "Baked Salmon with Mango Salsa", rating: 9 },
  { name: "Basmati Rice", rating: 9 },
  { name: "Beef Bulgogi", rating: 9 },
  { name: "Beef Kaldereta", rating: 8 },
  { name: "Beef Swedish Meatballs", rating: 8 },
  { name: "Carne Asada", rating: 9 },
  { name: "Carne Asada Beef Taco", rating: 9 },
  { name: "Chicken Nuggets", rating: 9 },
  { name: "Chicken Tenders", rating: 8 },
  { name: "Cilantro and Lime Rice", rating: 9 },
  { name: "Citrus Basmati Rice", rating: 9 },
  { name: "Coconut Rice", rating: 8 },
  { name: "Creamy Chicken Tikka Masala", rating: 10 },
  { name: "Crispy Chicken Katsu", rating: 9 },
  { name: "Crispy Fried Chicken Wings", rating: 9 },
  { name: "Crispy Fried Tofu", rating: 8 },
  { name: "Egg Fried Rice", rating: 10 },
  { name: "Eggs Scramble", rating: 8 },
  { name: "Fish and Chips", rating: 9 },
  { name: "Fried Catfish", rating: 8 },
  { name: "Fried Chicken Breast", rating: 9 },
  { name: "Fried Egg", rating: 9 },
  { name: "Garlic Naan", rating: 10 },
  { name: "Grilled Chicken", rating: 8 },
  { name: "Grilled Chicken Breast", rating: 8 },
  { name: "Grilled New York Steak", rating: 10 },
  { name: "Jasmine Rice", rating: 9 },
  { name: "Korean BBQ Chicken Wings", rating: 10 },
  { name: "Korean Fried Chicken", rating: 10 },
  { name: "Mac and Cheese", rating: 9 },
  { name: "Margherita Pizza", rating: 8 },
  { name: "Orange Chicken", rating: 9 },
  { name: "Pancakes", rating: 8 },
  { name: "Pesto Pasta", rating: 8 },
  { name: "Roast Turkey", rating: 8 },
  { name: "Spaghetti Bolognese Sauce", rating: 8 },
  { name: "Spicy Pork Sausage", rating: 8 },
  { name: "Steamed White Rice", rating: 8 },
  { name: "Turkey Burger", rating: 8 },
];

// Protein and starch tokens used by headliner.ts — these identify "entree-looking" dishes
const ENTREE_TOKENS = new Set([
  'chicken', 'turkey', 'duck', 'hen', 'wing', 'wings', 'drumstick', 'thigh', 'breast',
  'beef', 'steak', 'burger', 'hamburger', 'brisket', 'meatball', 'meatloaf', 'sirloin', 'patty', 'veal',
  'pork', 'bacon', 'ham', 'sausage', 'bratwurst', 'carnitas', 'chorizo',
  'cod', 'tilapia', 'catfish', 'halibut', 'bass', 'sole', 'haddock', 'pollock', 'swai', 'mahi',
  'salmon', 'tuna', 'mackerel', 'trout',
  'shrimp', 'crab', 'lobster', 'clam', 'scallop', 'calamari', 'squid', 'prawn',
  'tofu', 'tempeh', 'seitan',
  'egg', 'eggs', 'omelette', 'omelet', 'frittata', 'scramble', 'quiche',
  'falafel',
  'pasta', 'spaghetti', 'penne', 'fusilli', 'linguine', 'rigatoni', 'macaroni', 'lasagna', 'ravioli', 'tortellini', 'gnocchi',
  'noodle', 'noodles', 'ramen', 'udon',
  'pizza', 'calzone',
  'sandwich', 'wrap', 'panini', 'sub', 'melt', 'slider', 'sliders',
  'burrito', 'taco', 'tacos', 'enchilada', 'quesadilla', 'tamale',
  'bowl',
]);

function hasEntreeToken(name: string): boolean {
  const lower = name.toLowerCase();
  return Array.from(ENTREE_TOKENS).some(token => {
    const re = new RegExp(`\\b${token}\\b`);
    return re.test(lower);
  });
}

function makeItem(name: string): MenuItem {
  return { name, category: 'General', description: name, allergens: [], dietaryChoices: [] };
}

describe('headliner real-data guardrail', () => {
  it('should have < 5% false-negative rate on filtered high-rated dishes', () => {
    // Filter to dishes that contain an entree-looking token
    const filtered = highRatedDishes.filter(d => hasEntreeToken(d.name));

    let falseNegatives = 0;
    const failures: string[] = [];

    for (const dish of filtered) {
      const item = makeItem(dish.name);
      const result = classifyDish(item);
      if (!result.isHeadliner) {
        falseNegatives++;
        failures.push(`${dish.name} (rated ${dish.rating}): classified as non-headliner (score=${result.score}, reason=${result.reason})`);
      }
    }

    const rate = falseNegatives / filtered.length;
    console.log(`Filtered false-negative rate: ${falseNegatives}/${filtered.length} = ${(rate * 100).toFixed(1)}%`);
    if (failures.length > 0) {
      console.log('False negatives:', failures.join('\n  '));
    }
    expect(rate).toBeLessThan(0.05);
  });

  it('should log unfiltered false-negative rate (directional signal, no fail threshold)', () => {
    let falseNegatives = 0;
    const failures: string[] = [];

    for (const dish of highRatedDishes) {
      const item = makeItem(dish.name);
      const result = classifyDish(item);
      if (!result.isHeadliner) {
        falseNegatives++;
        failures.push(`${dish.name} (rated ${dish.rating})`);
      }
    }

    const rate = falseNegatives / highRatedDishes.length;
    console.log(`Unfiltered false-negative rate: ${falseNegatives}/${highRatedDishes.length} = ${(rate * 100).toFixed(1)}%`);
    if (failures.length > 0) {
      console.log('Non-headliner high-rated dishes (expected — sides/rice/etc):', failures.join(', '));
    }
    // No assertion — this is just directional logging
  });
});
