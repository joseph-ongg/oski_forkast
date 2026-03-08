import { Rankings } from './types';

const RANKINGS_KEY = 'croads_rankings';
const IGNORED_CATEGORIES_KEY = 'croads_ignored_categories';

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
