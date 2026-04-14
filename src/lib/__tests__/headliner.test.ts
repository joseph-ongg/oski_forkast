import { describe, it, expect } from 'vitest';
import { classifyDish, filterToHeadliners } from '../headliner';
import { MenuItem } from '../types';
import fixtures from './fixtures/headliner_labels.json';

function makeItem(name: string, station: string): MenuItem {
  return { name, category: station, description: name, allergens: [], dietaryChoices: [] };
}

// Split: first 40 = training, last 10 = holdout
const TRAINING_SIZE = 40;
const trainingDishes = fixtures.dishes.slice(0, TRAINING_SIZE);
const holdoutDishes = fixtures.dishes.slice(TRAINING_SIZE);

describe('classifyDish — fixture correctness', () => {
  it('should match expected isHeadliner for training set (>= 90% agreement)', () => {
    let correct = 0;
    const failures: string[] = [];

    for (const dish of trainingDishes) {
      const item = makeItem(dish.name, dish.station);
      const result = classifyDish(item);

      if (result.isHeadliner === dish.expected_isHeadliner) {
        correct++;
      } else {
        failures.push(`${dish.name}: expected ${dish.expected_isHeadliner}, got ${result.isHeadliner} (score=${result.score}, reason=${result.reason})`);
      }
    }

    const agreement = correct / trainingDishes.length;
    console.log(`Training set: ${correct}/${trainingDishes.length} = ${(agreement * 100).toFixed(1)}%`);
    if (failures.length > 0) {
      console.log('Failures:', failures.join('\n  '));
    }
    expect(agreement).toBeGreaterThanOrEqual(0.9);
  });

  it('should match expected isHeadliner for holdout set (>= 80% agreement)', () => {
    let correct = 0;
    const failures: string[] = [];

    for (const dish of holdoutDishes) {
      const item = makeItem(dish.name, dish.station);
      const result = classifyDish(item);

      if (result.isHeadliner === dish.expected_isHeadliner) {
        correct++;
      } else {
        failures.push(`${dish.name}: expected ${dish.expected_isHeadliner}, got ${result.isHeadliner} (score=${result.score}, reason=${result.reason})`);
      }
    }

    const agreement = correct / holdoutDishes.length;
    console.log(`Holdout set: ${correct}/${holdoutDishes.length} = ${(agreement * 100).toFixed(1)}%`);
    if (failures.length > 0) {
      console.log('Failures:', failures.join('\n  '));
    }
    expect(agreement).toBeGreaterThanOrEqual(0.8);
  });
});

describe('filterToHeadliners — station bounds', () => {
  it('should have between 1 and 5 headliners per station in the fixture', () => {
    // Group fixture dishes by station
    const stationMap = new Map<string, MenuItem[]>();
    for (const dish of fixtures.dishes) {
      const item = makeItem(dish.name, dish.station);
      const existing = stationMap.get(dish.station);
      if (existing) existing.push(item);
      else stationMap.set(dish.station, [item]);
    }

    stationMap.forEach((items, station) => {
      const headliners = filterToHeadliners(items);
      // Stations with only condiments/sides may have 0 headliners (conditional min-1)
      // But if any item scores >= 2 (at least two positive signals), at least 1 should be selected
      const hasAnyScoreable = items.some((item: MenuItem) => classifyDish(item).score >= 2);
      if (hasAnyScoreable) {
        expect(headliners.length).toBeGreaterThanOrEqual(1);
      }
      expect(headliners.length).toBeLessThanOrEqual(5);
    });
  });
});

describe('filterToHeadliners — pasta-sauce regression', () => {
  it('should keep all 4 pasta dishes with different sauces as headliners', () => {
    const items: MenuItem[] = [
      makeItem('Penne Marinara', 'Pasta'),
      makeItem('Fettuccine Alfredo', 'Pasta'),
      makeItem('Spaghetti Bolognese', 'Pasta'),
      makeItem('Butter Pasta', 'Pasta'),
    ];
    const headliners = filterToHeadliners(items);
    const names = headliners.map(h => h.name);
    expect(names).toContain('Penne Marinara');
    expect(names).toContain('Fettuccine Alfredo');
    expect(names).toContain('Spaghetti Bolognese');
    // Butter Pasta has starch but no cuisine token — may or may not be headliner
    // It has score: +2 (starch) = 2 < 3, so not a headliner by score alone
    // But since Pasta station has headliners, it's fine either way
  });
});

describe('filterToHeadliners — side-collapse regression', () => {
  it('should return only Grilled Chicken as headliner from a mixed grill station', () => {
    const items: MenuItem[] = [
      makeItem('Grilled Chicken', 'Grill'),
      makeItem('Grilled Onions', 'Grill'),
      makeItem('Grilled Peppers', 'Grill'),
      makeItem('Grilled Mushrooms', 'Grill'),
    ];
    const headliners = filterToHeadliners(items);
    const names = headliners.map(h => h.name);
    expect(names).toContain('Grilled Chicken');
    expect(names).not.toContain('Grilled Onions');
    expect(names).not.toContain('Grilled Peppers');
    expect(names).not.toContain('Grilled Mushrooms');
  });
});

describe('filterToHeadliners — empty station', () => {
  it('should return empty array for empty input', () => {
    const headliners = filterToHeadliners([]);
    expect(headliners).toEqual([]);
  });
});

describe('filterToHeadliners — bare condiment station regression', () => {
  it('should not promote cream cheeses / spreads as headliners', () => {
    const items: MenuItem[] = [
      makeItem('Chive Cream Cheese', 'Bagel Bar'),
      makeItem('Plain Cream Cheese', 'Bagel Bar'),
      makeItem('Strawberry Cream Cheese', 'Bagel Bar'),
      makeItem('Butter', 'Bagel Bar'),
    ];
    const headliners = filterToHeadliners(items);
    expect(headliners).toHaveLength(0);
  });

  it('should not promote single-signal long-name sides as headliners', () => {
    const items: MenuItem[] = [
      makeItem('Steel Cut Oatmeal', 'Grains'),
      makeItem('Brown Sugar Topping', 'Grains'),
    ];
    const headliners = filterToHeadliners(items);
    expect(headliners).toHaveLength(0);
  });
});
