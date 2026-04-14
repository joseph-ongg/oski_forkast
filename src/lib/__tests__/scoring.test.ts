import { describe, it, expect } from 'vitest';
import { calculateStationScore, calculateHallScore } from '../scoring';
import { MenuItem, MenuData } from '../types';

function makeItem(name: string, category: string): MenuItem {
  return { name, category, description: name, allergens: [], dietaryChoices: [] };
}

function makeMenu(location: string, mealPeriod: string, items: MenuItem[]): MenuData {
  return { location, date: '20260413', meals: { [mealPeriod]: items } };
}

describe('calculateStationScore — weighted top-N', () => {
  const items = [
    makeItem('Grilled Chicken', 'Grill'),
    makeItem('Beef Burger', 'Grill'),
    makeItem('Chicken Tenders', 'Grill'),
    makeItem('Fish Tacos', 'Grill'),
  ];
  const rankings = {
    'Grilled Chicken': 9,
    'Beef Burger': 8,
    'Chicken Tenders': 7,
    'Fish Tacos': 6,
  };

  it('mealSize=1: uses only the best entree', () => {
    const result = calculateStationScore(items, rankings, 1);
    expect(result.entree_avg).toBe(9);
    expect(result.details).toHaveLength(1);
  });

  it('mealSize=2: weighted average of top 2 with [1.0, 0.7]', () => {
    const result = calculateStationScore(items, rankings, 2);
    // (9*1.0 + 8*0.7) / (1.0+0.7) = (9+5.6)/1.7 ≈ 8.588
    expect(result.entree_avg).toBeCloseTo(8.588, 2);
    expect(result.details).toHaveLength(2);
  });

  it('mealSize=3: weighted average of top 3 with [1.0, 0.7, 0.5]', () => {
    const result = calculateStationScore(items, rankings, 3);
    // (9*1.0 + 8*0.7 + 7*0.5) / (1.0+0.7+0.5) = (9+5.6+3.5)/2.2 ≈ 8.227
    expect(result.entree_avg).toBeCloseTo(8.227, 2);
    expect(result.details).toHaveLength(3);
  });

  it('mealSize=4: weighted average of all 4 with [1.0, 0.7, 0.5, 0.3]', () => {
    const result = calculateStationScore(items, rankings, 4);
    // (9*1.0 + 8*0.7 + 7*0.5 + 6*0.3) / (1.0+0.7+0.5+0.3) = (9+5.6+3.5+1.8)/2.5 = 7.96
    expect(result.entree_avg).toBeCloseTo(7.96, 2);
    expect(result.details).toHaveLength(4);
  });

  it('rice bonus still works', () => {
    const withRice = [...items, makeItem('Jasmine Rice', 'Grill')];
    const withRiceRankings = { ...rankings, 'Jasmine Rice': 9 };
    const result = calculateStationScore(withRice, withRiceRankings, 1);
    expect(result.rice_bonus).toBeCloseTo(0.9, 2);
    expect(result.score).toBeCloseTo(9.9, 2);
  });

  it('score caps at 10', () => {
    const withRice = [...items, makeItem('Jasmine Rice', 'Grill')];
    const highRankings = { 'Grilled Chicken': 10, 'Jasmine Rice': 10 };
    const result = calculateStationScore(withRice, highRankings, 1);
    expect(result.score).toBe(10);
  });

  it('returns 0 for no rated items', () => {
    const result = calculateStationScore(items, {}, 2);
    expect(result.score).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it('skips dishes with rating -1', () => {
    const result = calculateStationScore(items, { 'Grilled Chicken': -1, 'Beef Burger': 8 }, 2);
    expect(result.entree_avg).toBe(8);
    expect(result.details).toHaveLength(1);
  });

  it('defaults to mealSize=2 when not specified', () => {
    const result = calculateStationScore(items, rankings);
    const explicit = calculateStationScore(items, rankings, 2);
    expect(result.entree_avg).toBeCloseTo(explicit.entree_avg, 5);
  });
});

describe('calculateHallScore — weighted top-N stations', () => {
  const grillItems = [
    makeItem('Grilled Chicken', 'Grill'),
    makeItem('Beef Burger', 'Grill'),
  ];
  const pastaItems = [
    makeItem('Penne Marinara', 'Pasta'),
    makeItem('Fettuccine Alfredo', 'Pasta'),
  ];
  const saladItems = [
    makeItem('Caesar Salad', 'Salad Bar'),
  ];

  const allItems = [...grillItems, ...pastaItems, ...saladItems];
  const menu = makeMenu('Crossroads', 'Dinner', allItems);

  const rankings = {
    'Grilled Chicken': 9,
    'Beef Burger': 8,
    'Penne Marinara': 8,
    'Fettuccine Alfredo': 7,
    'Caesar Salad': 6,
  };

  it('mealSize=1: uses only the best station', () => {
    const result = calculateHallScore(menu, rankings, 'Dinner', new Set(), new Set(), 1);
    expect(result.stations).toHaveLength(1);
    expect(result.stations[0].name).toBe('Grill');
    expect(result.total_score).toBe(result.stations[0].score);
  });

  it('mealSize=2: considers 2 stations with diminishing weights', () => {
    const result = calculateHallScore(menu, rankings, 'Dinner', new Set(), new Set(), 2);
    expect(result.stations).toHaveLength(2);
    // Should be weighted avg of 2 station scores
    const s1 = result.stations[0].score;
    const s2 = result.stations[1].score;
    const expected = (s1 * 1.0 + s2 * 0.7) / 1.7;
    expect(result.total_score).toBeCloseTo(expected, 5);
  });

  it('mealSize=4: considers all 3 available stations', () => {
    const result = calculateHallScore(menu, rankings, 'Dinner', new Set(), new Set(), 4);
    expect(result.stations).toHaveLength(3);
  });

  it('no +1 variety bonus (regression)', () => {
    // With old algorithm: if stn2 >= 8, score = avg(s1, s2) + 1
    // With new algorithm: no +1 bonus, just weighted avg
    const result = calculateHallScore(menu, rankings, 'Dinner', new Set(), new Set(), 2);
    const s1 = result.stations[0].score;
    const s2 = result.stations[1].score;
    const expectedWeighted = (s1 * 1.0 + s2 * 0.7) / 1.7;
    // Total should be the weighted avg — no +1 bonus
    expect(result.total_score).toBeCloseTo(expectedWeighted, 5);
    // And specifically less than what the old algorithm would give (avg + 1)
    expect(result.total_score).toBeLessThan((s1 + s2) / 2 + 1);
  });

  it('returns 0 for missing meal period', () => {
    const result = calculateHallScore(menu, rankings, 'Breakfast', new Set(), new Set(), 2);
    expect(result.total_score).toBe(0);
    expect(result.stations).toHaveLength(0);
  });

  it('respects ignored categories', () => {
    const ignored = new Set(['grill']);
    const result = calculateHallScore(menu, rankings, 'Dinner', ignored, new Set(), 2);
    // Grill station should be excluded
    expect(result.stations.every(s => s.name !== 'Grill')).toBe(true);
  });

  it('respects excluded items', () => {
    const excluded = new Set(['Grilled Chicken', 'Beef Burger']);
    const result = calculateHallScore(menu, rankings, 'Dinner', new Set(), excluded, 2);
    // Grill items are excluded, so no Grill station
    expect(result.stations.every(s => s.name !== 'Grill')).toBe(true);
  });

  it('defaults to mealSize=2 when not specified', () => {
    const result = calculateHallScore(menu, rankings, 'Dinner');
    const explicit = calculateHallScore(menu, rankings, 'Dinner', new Set(), new Set(), 2);
    expect(result.total_score).toBeCloseTo(explicit.total_score, 5);
  });
});
