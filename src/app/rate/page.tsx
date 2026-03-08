'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/app/providers';
import { MenuData, MenuItem, Rankings } from '@/lib/types';
import { getCurrentMealPeriod, resolveActivePeriod } from '@/lib/scoring';
import {
  loadRankings,
  saveRankings,
  loadIgnoredCategories,
  saveIgnoredCategories,
} from '@/lib/storage';
import { pushToCloud, syncWithCloud } from '@/lib/sync';
import Link from 'next/link';
import { ArrowLeft, SkipForward, Check, Star, Filter, X, ChevronLeft, Layers, CalendarRange } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

interface UniqueItem {
  name: string;
  description: string;
  categories: string[];
}

export default function RatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>}>
      <RatePageContent />
    </Suspense>
  );
}

function RatePageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date') || formatDate(new Date());
  const mealParam = searchParams.get('meal') || getCurrentMealPeriod();

  const [menus, setMenus] = useState<MenuData[]>([]);
  const [rankings, setRankings] = useState<Rankings>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratingInput, setRatingInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [ignoredCategories, setIgnoredCategories] = useState<string[]>([]);
  const [rateAll, setRateAll] = useState(false);
  const [rateWeek, setRateWeek] = useState(false);
  const [weekMenus, setWeekMenus] = useState<MenuData[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [history, setHistory] = useState<{ name: string; rating: number }[]>([]);
  const [lastAction, setLastAction] = useState<number | null>(null); // rating shown after going back
  const syncTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced cloud sync — pushes to cloud 2s after last rating action
  const scheduleCloudSync = useCallback(() => {
    if (!user) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      pushToCloud().catch(() => {});
    }, 2000);
  }, [user]);

  useEffect(() => {
    if (user) {
      syncWithCloud()
        .then(({ rankings: r, ignoredCategories: ic }) => {
          setRankings(r);
          setIgnoredCategories(ic);
        })
        .catch(() => {
          setRankings(loadRankings());
          setIgnoredCategories(loadIgnoredCategories());
        });
    } else {
      setRankings(loadRankings());
      setIgnoredCategories(loadIgnoredCategories());
    }
  }, [user]);

  useEffect(() => {
    async function fetchMenus() {
      setLoading(true);
      try {
        const res = await fetch(`/api/menus?date=${dateParam}`);
        const data = await res.json();
        setMenus(data.menus || []);
      } catch {
        setMenus([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMenus();
  }, [dateParam]);

  // Fetch menus for the upcoming week (7 days)
  const loadWeekMenus = useCallback(async () => {
    setRateWeek(true);
    setWeekLoading(true);
    setCurrentIndex(0);
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(formatDate(d));
    }
    const allMenus: MenuData[] = [];
    await Promise.all(
      dates.map(async (d) => {
        try {
          const res = await fetch(`/api/menus?date=${d}`);
          const data = await res.json();
          if (data.menus) allMenus.push(...data.menus);
        } catch {}
      })
    );
    setWeekMenus(allMenus);
    setWeekLoading(false);
  }, []);

  // Collect all unique items — either current meal, all meals, or full week
  const { allItems, allCategories } = useMemo(() => {
    const itemMap = new Map<string, UniqueItem>();
    const catSet = new Set<string>();
    const ignoredLower = new Set(ignoredCategories.map((c) => c.toLowerCase()));

    const sourceMenus = rateWeek ? weekMenus : menus;
    const iterateAllPeriods = rateAll || rateWeek;

    for (const menu of sourceMenus) {
      if (iterateAllPeriods) {
        for (const period of Object.keys(menu.meals)) {
          for (const item of menu.meals[period]) {
            catSet.add(item.category);
            if (ignoredLower.has(item.category.toLowerCase())) continue;
            const existing = itemMap.get(item.name);
            if (existing) {
              if (!existing.categories.includes(item.category)) {
                existing.categories.push(item.category);
              }
            } else {
              itemMap.set(item.name, {
                name: item.name,
                description: item.description,
                categories: [item.category],
              });
            }
          }
        }
      } else {
        const activePeriod = resolveActivePeriod(menu, mealParam);
        if (!activePeriod || !menu.meals[activePeriod]) continue;

        for (const item of menu.meals[activePeriod]) {
          catSet.add(item.category);
          if (ignoredLower.has(item.category.toLowerCase())) continue;

          const existing = itemMap.get(item.name);
          if (existing) {
            if (!existing.categories.includes(item.category)) {
              existing.categories.push(item.category);
            }
          } else {
            itemMap.set(item.name, {
              name: item.name,
              description: item.description,
              categories: [item.category],
            });
          }
        }
      }
    }

    return {
      allItems: Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      allCategories: Array.from(catSet).sort(),
    };
  }, [menus, weekMenus, mealParam, ignoredCategories, rateAll, rateWeek]);

  // Unrated items
  const unratedItems = useMemo(
    () => allItems.filter((item) => !(item.name in rankings)),
    [allItems, rankings]
  );

  const currentItem = unratedItems[currentIndex] || null;
  const totalUnrated = unratedItems.length;
  const totalItems = allItems.length;
  const ratedCount = totalItems - totalUnrated;

  const handleRate = useCallback(
    (rating: number) => {
      if (!currentItem) return;
      const newRankings = { ...rankings, [currentItem.name]: rating };
      setRankings(newRankings);
      saveRankings(newRankings);
      scheduleCloudSync();
      setHistory((prev) => [...prev, { name: currentItem.name, rating }]);
      setRatingInput('');
      setLastAction(null);
    },
    [currentItem, rankings, scheduleCloudSync]
  );

  const handleSkip = useCallback(() => {
    if (!currentItem) return;
    const newRankings = { ...rankings, [currentItem.name]: -1 };
    setRankings(newRankings);
    saveRankings(newRankings);
    scheduleCloudSync();
    setHistory((prev) => [...prev, { name: currentItem.name, rating: -1 }]);
    setRatingInput('');
    setLastAction(null);
  }, [currentItem, rankings, scheduleCloudSync]);

  const handleBack = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    // Remove the rating so it shows as unrated again
    const newRankings = { ...rankings };
    delete newRankings[prev.name];
    setRankings(newRankings);
    saveRankings(newRankings);
    setHistory((h) => h.slice(0, -1));
    // Restore the previous rating/skip state for highlighting
    setLastAction(prev.rating);
    setRatingInput(prev.rating > 0 ? String(prev.rating) : '');
    setCurrentIndex(0);
  }, [history, rankings]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(ratingInput);
      if (!isNaN(val) && val >= 1 && val <= 10) {
        handleRate(val);
      }
    },
    [ratingInput, handleRate]
  );

  const toggleCategory = useCallback(
    (cat: string) => {
      const lower = cat.toLowerCase();
      let newIgnored: string[];
      if (ignoredCategories.map((c) => c.toLowerCase()).includes(lower)) {
        newIgnored = ignoredCategories.filter((c) => c.toLowerCase() !== lower);
      } else {
        newIgnored = [...ignoredCategories, cat];
      }
      setIgnoredCategories(newIgnored);
      saveIgnoredCategories(newIgnored);
      scheduleCloudSync();
      setCurrentIndex(0);
    },
    [ignoredCategories, scheduleCloudSync]
  );

  const progressPercent = totalItems > 0 ? Math.round((ratedCount / totalItems) * 100) : 0;

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Rate Dishes</h1>
          <p className="text-xs text-slate-500">
            {rateWeek ? 'Upcoming Week' : rateAll ? 'All Meals' : mealParam} · {ratedCount}/{totalItems} rated
          </p>
        </div>
        <button
          onClick={() => {
            if (rateWeek) {
              setRateWeek(false);
              setCurrentIndex(0);
            } else {
              setRateAll(false);
              loadWeekMenus();
            }
          }}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
            rateWeek
              ? 'bg-berkeley-gold text-berkeley-blue border-berkeley-gold'
              : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-600'
          }`}
          title={rateWeek ? 'Rating upcoming week' : 'Rate upcoming week'}
        >
          <CalendarRange className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setRateAll(!rateAll); setRateWeek(false); setCurrentIndex(0); }}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
            rateAll && !rateWeek
              ? 'bg-berkeley-gold text-berkeley-blue border-berkeley-gold'
              : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-600'
          }`}
          title={rateAll ? 'Rating all meals' : 'Rate all meals'}
        >
          <Layers className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
            showFilters
              ? 'bg-berkeley-gold text-berkeley-blue border-berkeley-gold'
              : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-600'
          }`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-1.5 bg-[#111827] rounded-full overflow-hidden">
          <div
            className="h-full bg-berkeley-gold rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-slate-600 mt-1 text-right">{progressPercent}%</p>
      </div>

      {/* Category Filters */}
      {showFilters && (
        <div className="bg-[#111827] rounded-lg p-4 mb-6 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Filter Categories</h3>
            <button onClick={() => setShowFilters(false)}>
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Toggle off categories you don&apos;t care about
          </p>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat) => {
              const isIgnored = ignoredCategories
                .map((c) => c.toLowerCase())
                .includes(cat.toLowerCase());
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isIgnored
                      ? 'bg-slate-800 text-slate-600 line-through'
                      : 'bg-berkeley-blue/50 text-berkeley-gold border border-berkeley-gold/30'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {(loading || weekLoading) && (
        <div className="text-center py-20">
          <p className="text-slate-400">{weekLoading ? 'Loading week menus...' : 'Loading menus...'}</p>
        </div>
      )}

      {/* All rated */}
      {!loading && !weekLoading && totalUnrated === 0 && totalItems > 0 && (
        <div className="text-center py-16">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">All Done!</h2>
          <p className="text-slate-400 mb-6">
            You&apos;ve rated all {ratedCount} dishes for this meal.
          </p>
          <Link
            href="/"
            className="bg-berkeley-gold text-berkeley-blue font-semibold px-6 py-3 rounded-lg hover:bg-berkeley-lightgold transition-colors inline-block"
          >
            See Recommendations
          </Link>
        </div>
      )}

      {/* No items */}
      {!loading && !weekLoading && totalItems === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-lg">No dishes found</p>
          <p className="text-slate-500 text-sm mt-2">
            No menus available for this meal period, or all categories are filtered out.
          </p>
        </div>
      )}

      {/* Current dish card */}
      {!loading && !weekLoading && currentItem && (
        <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              {currentItem.categories.map((cat) => (
                <span
                  key={cat}
                  className="text-xs bg-berkeley-blue/50 text-berkeley-gold px-2 py-0.5 rounded-full"
                >
                  {cat}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{currentItem.name}</h2>
            {currentItem.description && currentItem.description !== currentItem.name && (
              <p className="text-sm text-slate-400">{currentItem.description}</p>
            )}
          </div>

          {/* Rating input */}
          <div className="border-t border-slate-800 p-6">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={ratingInput}
                onChange={(e) => setRatingInput(e.target.value)}
                placeholder="1-10"
                autoFocus
                className="flex-1 bg-[#0a0f1a] border border-slate-700 rounded-lg px-4 py-3 text-white text-center text-lg font-semibold placeholder-slate-600 focus:outline-none focus:border-berkeley-gold transition-colors"
              />
              <button
                type="submit"
                disabled={!ratingInput}
                className="bg-berkeley-gold text-berkeley-blue font-semibold px-6 py-3 rounded-lg hover:bg-berkeley-lightgold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Star className="w-4 h-4" />
                Rate
              </button>
            </form>

            {/* Quick rating buttons */}
            <div className="flex gap-1.5 mt-3 justify-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => handleRate(n)}
                  className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                    lastAction === n
                      ? 'bg-berkeley-gold text-berkeley-blue border border-berkeley-gold'
                      : 'bg-[#0a0f1a] border border-slate-700 text-slate-400 hover:border-berkeley-gold hover:text-berkeley-gold'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Skip and Back buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleBack}
                disabled={history.length === 0}
                className="flex-1 py-2.5 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleSkip}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  lastAction === -1
                    ? 'text-red-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <SkipForward className="w-4 h-4" />
                {lastAction === -1 ? 'Skipped' : 'Skip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remaining count */}
      {!loading && !weekLoading && currentItem && (
        <p className="text-center text-xs text-slate-600 mt-4">
          {totalUnrated - currentIndex} dish{totalUnrated - currentIndex !== 1 ? 'es' : ''}{' '}
          remaining
        </p>
      )}
    </main>
  );
}
