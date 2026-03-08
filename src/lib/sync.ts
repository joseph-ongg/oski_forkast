import { Rankings } from './types';
import { loadRankings, saveRankings, loadIgnoredCategories, saveIgnoredCategories } from './storage';
import { getSupabase } from './supabase';

/**
 * Get the current Supabase session access token for API auth.
 */
async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Pull rankings from Supabase and merge with localStorage.
 * Cloud data wins for conflicts (it's the source of truth when logged in).
 */
export async function pullFromCloud(): Promise<{
  rankings: Rankings;
  ignoredCategories: string[];
}> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch('/api/rankings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch rankings from cloud');
  }

  const cloud = await res.json();
  const cloudRankings: Rankings = cloud.rankings || {};
  const cloudIgnored: string[] = cloud.ignored_categories || [];

  const localRankings = loadRankings();
  const localIgnored = loadIgnoredCategories();

  // Merge: cloud wins on conflicts, local-only entries are kept
  const merged: Rankings = { ...localRankings, ...cloudRankings };

  // Merge ignored categories (union)
  const mergedIgnoredSet = new Set([
    ...localIgnored.map((c) => c.toLowerCase()),
    ...cloudIgnored.map((c) => c.toLowerCase()),
  ]);
  const mergedIgnored = Array.from(mergedIgnoredSet);

  // Save merged data locally
  saveRankings(merged);
  saveIgnoredCategories(mergedIgnored);

  return { rankings: merged, ignoredCategories: mergedIgnored };
}

/**
 * Push current localStorage rankings to Supabase.
 */
export async function pushToCloud(): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const rankings = loadRankings();
  const ignoredCategories = loadIgnoredCategories();

  const res = await fetch('/api/rankings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rankings, ignored_categories: ignoredCategories }),
  });

  if (!res.ok) {
    throw new Error('Failed to sync rankings to cloud');
  }
}

/**
 * Full sync: pull from cloud, merge, then push merged result back.
 */
export async function syncWithCloud(): Promise<{
  rankings: Rankings;
  ignoredCategories: string[];
}> {
  const merged = await pullFromCloud();
  await pushToCloud();
  return merged;
}
