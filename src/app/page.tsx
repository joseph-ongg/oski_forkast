'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './providers';
import { MenuData, Rankings, HallResult, DietaryPreferences, HallDistances } from '@/lib/types';
import { calculateHallScore, getCurrentMealPeriod, resolveActivePeriod, getEarlierMealItems } from '@/lib/scoring';
import { loadRankings, loadIgnoredCategories, loadDietaryPreferences, loadHallDistances, loadBaselineScore, isOnboardingComplete } from '@/lib/storage';
import { getExcludedDishNames, shouldExcludeDish } from '@/lib/dietary';
import { syncWithCloud } from '@/lib/sync';
import UserMenu from '@/components/UserMenu';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Utensils,
  Star,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarDays,
  Settings,
} from 'lucide-react';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function parseDate(dateStr: string): Date {
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(4, 6)) - 1;
  const d = parseInt(dateStr.slice(6, 8));
  return new Date(y, m, d);
}

function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function displayDate(dateStr: string): string {
  const date = parseDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function shortDisplayDate(dateStr: string): string {
  const date = parseDate(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function toInputDate(dateStr: string): string {
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

function fromInputDate(input: string): string {
  return input.replace(/-/g, '');
}

function getMealPeriodsForDate(dateStr: string): string[] {
  const date = parseDate(dateStr);
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  return isWeekend ? ['Brunch', 'Dinner'] : ['Breakfast', 'Lunch', 'Dinner'];
}

function getMealPeriodsForDateStr(dateStr: string): string[] {
  const date = parseDate(dateStr);
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  return isWeekend ? ['Brunch', 'Dinner'] : ['Breakfast', 'Lunch', 'Dinner'];
}

interface DayPlan {
  dateStr: string;
  mealPeriod: string;
  results: HallResult[];
  loading: boolean;
}

// Points deducted per minute of walk time
const DISTANCE_PENALTY_PER_MIN = 0.05;

function computeResults(
  menus: MenuData[],
  rankings: Rankings,
  mealPeriod: string,
  ignoredCategories: string[],
  dietaryPrefs?: DietaryPreferences,
  hallDistances?: HallDistances
): HallResult[] {
  const ignored = new Set(ignoredCategories.map((c) => c.toLowerCase()));
  const results: HallResult[] = [];
  for (const menu of menus) {
    const activePeriod = resolveActivePeriod(menu, mealPeriod);
    if (!activePeriod) continue;
    const earlierItems = getEarlierMealItems(menu, activePeriod);
    // Merge earlier-meal exclusions with dietary exclusions
    const excludeItems = new Set(earlierItems);
    if (dietaryPrefs && (dietaryPrefs.diets.length > 0 || dietaryPrefs.allergens.length > 0)) {
      const mealItems = menu.meals[activePeriod] || [];
      const dietaryExcluded = getExcludedDishNames(mealItems, dietaryPrefs);
      dietaryExcluded.forEach((name) => excludeItems.add(name));
    }
    const score = calculateHallScore(menu, rankings, activePeriod, ignored, excludeItems);
    // Apply distance penalty if set
    if (hallDistances && hallDistances[menu.location] != null && score.total_score > 0) {
      const penalty = hallDistances[menu.location] * DISTANCE_PENALTY_PER_MIN;
      score.total_score = Math.max(0, score.total_score - penalty);
    }
    results.push({ location: menu.location, score, activePeriod });
  }
  results.sort((a, b) => b.score.total_score - a.score.total_score);
  return results;
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center py-20">
          <p className="text-slate-400">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <Suspense fallback={<main className="max-w-2xl mx-auto px-4 py-6"><div className="text-center py-20"><p className="text-slate-400">Loading...</p></div></main>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get('date') || formatDate(new Date());
  const initialMeal = searchParams.get('meal') || getCurrentMealPeriod();
  const [menus, setMenus] = useState<MenuData[]>([]);
  const [rankings, setRankings] = useState<Rankings>({});
  const [mealPeriod, setMealPeriod] = useState<string>(initialMeal);
  const [dateStr, setDateStr] = useState<string>(initialDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hallResults, setHallResults] = useState<HallResult[]>([]);
  const [ignoredCategories, setIgnoredCategories] = useState<string[]>([]);
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPreferences>({ diets: [], allergens: [] });
  const [hallDistances, setHallDistances] = useState<HallDistances>({});
  const [baselineScore, setBaselineScore] = useState<number | null>(null);
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerData, setPlannerData] = useState<DayPlan[]>([]);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  const fetchMenus = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/menus?date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch menus');
      const data = await res.json();
      setMenus(data.menus || []);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch menus');
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync with cloud when user signs in
  useEffect(() => {
    const loadData = (r: Rankings, ic: string[]) => {
      setRankings(r);
      setIgnoredCategories(ic);
      setDietaryPrefs(loadDietaryPreferences());
      setHallDistances(loadHallDistances());
      setBaselineScore(loadBaselineScore());
      // Redirect first-time users to onboarding
      if (Object.keys(r).length === 0 && !isOnboardingComplete()) {
        router.push('/onboard');
      }
      setCheckedOnboarding(true);
    };

    if (user) {
      syncWithCloud()
        .then(({ rankings: r, ignoredCategories: ic }) => loadData(r, ic))
        .catch(() => loadData(loadRankings(), loadIgnoredCategories()));
    } else {
      loadData(loadRankings(), loadIgnoredCategories());
    }
  }, [user, router]);

  useEffect(() => {
    fetchMenus(dateStr);
    // Auto-switch meal period if current one isn't valid for this date
    const validPeriods = getMealPeriodsForDateStr(dateStr);
    if (!validPeriods.includes(mealPeriod)) {
      setMealPeriod(validPeriods[0]);
    }
  }, [dateStr, fetchMenus, mealPeriod]);

  useEffect(() => {
    if (menus.length === 0) {
      setHallResults([]);
      return;
    }
    setHallResults(computeResults(menus, rankings, mealPeriod, ignoredCategories, dietaryPrefs, hallDistances));
  }, [menus, rankings, mealPeriod, ignoredCategories, dietaryPrefs, hallDistances]);

  useEffect(() => {
    const onStorage = () => {
      setRankings(loadRankings());
      setIgnoredCategories(loadIgnoredCategories());
      setDietaryPrefs(loadDietaryPreferences());
      setHallDistances(loadHallDistances());
      setBaselineScore(loadBaselineScore());
    };
    window.addEventListener('storage', onStorage);
    const onFocus = () => {
      setRankings(loadRankings());
      setIgnoredCategories(loadIgnoredCategories());
      setDietaryPrefs(loadDietaryPreferences());
      setHallDistances(loadHallDistances());
      setBaselineScore(loadBaselineScore());
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Multi-day planner
  const loadPlanner = useCallback(async () => {
    setShowPlanner(true);
    setPlannerLoading(true);
    const today = formatDate(new Date());
    const days: DayPlan[] = [];

    for (let i = 0; i < 3; i++) {
      const d = addDays(today, i);
      const meals = getMealPeriodsForDate(d);
      for (const meal of meals) {
        days.push({ dateStr: d, mealPeriod: meal, results: [], loading: true });
      }
    }
    setPlannerData(days);

    // Fetch all dates in parallel
    const uniqueDates = Array.from(new Set(days.map((d) => d.dateStr)));
    const menuCache: Record<string, MenuData[]> = {};

    await Promise.all(
      uniqueDates.map(async (d) => {
        try {
          const res = await fetch(`/api/menus?date=${d}`);
          const data = await res.json();
          menuCache[d] = data.menus || [];
        } catch {
          menuCache[d] = [];
        }
      })
    );

    const currentRankings = loadRankings();
    const currentIgnored = loadIgnoredCategories();
    const currentDietary = loadDietaryPreferences();
    const currentDistances = loadHallDistances();

    const updatedDays = days.map((day) => {
      const dayMenus = menuCache[day.dateStr] || [];
      const results = computeResults(dayMenus, currentRankings, day.mealPeriod, currentIgnored, currentDietary, currentDistances);
      return { ...day, results, loading: false };
    });

    setPlannerData(updatedDays);
    setPlannerLoading(false);
  }, []);

  const ratedCount = Object.values(rankings).filter((r) => r > 0).length;
  const bestHall = hallResults.length > 0 ? hallResults[0] : null;
  const isToday = dateStr === formatDate(new Date());
  const todayStr = formatDate(new Date());
  const maxDateStr = addDays(todayStr, 7);
  const canGoForward = dateStr < maxDateStr;

  // Count unrated dishes for the current meal to show warning
  const unratedMealCount = useMemo(() => {
    if (menus.length === 0) return 0;
    const ignoredLower = new Set(ignoredCategories.map((c) => c.toLowerCase()));
    const itemNames = new Set<string>();
    for (const menu of menus) {
      const period = resolveActivePeriod(menu, mealPeriod);
      if (!period || !menu.meals[period]) continue;
      for (const item of menu.meals[period]) {
        if (ignoredLower.has(item.category.toLowerCase())) continue;
        if (shouldExcludeDish(item, dietaryPrefs)) continue;
        itemNames.add(item.name);
      }
    }
    let unrated = 0;
    itemNames.forEach((name) => {
      if (!(name in rankings)) unrated++;
    });
    return unrated;
  }, [menus, rankings, mealPeriod, ignoredCategories, dietaryPrefs]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-berkeley-gold flex items-center gap-2">
            <Utensils className="w-6 h-6" />
            Oski's Forkast
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/onboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-600 transition-colors text-slate-400 hover:text-slate-200"
          >
            <Settings className="w-4 h-4" />
            <span className="text-xs font-medium">Settings</span>
          </Link>
          <UserMenu />
          <Link
            href={`/rate?date=${dateStr}&meal=${mealPeriod}`}
            className="bg-berkeley-gold text-berkeley-blue font-semibold px-4 py-2 rounded-lg text-sm hover:bg-berkeley-lightgold transition-colors flex items-center gap-1"
          >
            Rate Dishes
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setDateStr(addDays(dateStr, -1))}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
        <div className="flex-1 relative">
          <input
            type="date"
            value={toInputDate(dateStr)}
            max={toInputDate(maxDateStr)}
            onChange={(e) => {
              if (e.target.value) setDateStr(fromInputDate(e.target.value));
            }}
            className="w-full bg-[#111827] border border-slate-800 rounded-lg px-4 py-2 text-white text-center text-sm font-medium focus:outline-none focus:border-berkeley-gold transition-colors cursor-pointer [color-scheme:dark]"
          />
        </div>
        <button
          onClick={() => canGoForward && setDateStr(addDays(dateStr, 1))}
          disabled={!canGoForward}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
        {!isToday && (
          <button
            onClick={() => setDateStr(formatDate(new Date()))}
            className="px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-600 transition-colors text-xs text-slate-400"
          >
            Today
          </button>
        )}
      </div>

      <p className="text-sm text-slate-400 mb-4 text-center">{displayDate(dateStr)}</p>

      {/* Meal Period Tabs */}
      <div className="flex gap-1 mb-4 bg-[#111827] rounded-lg p-1">
        {getMealPeriodsForDateStr(dateStr).map((mp) => (
          <button
            key={mp}
            onClick={() => setMealPeriod(mp)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mealPeriod === mp
                ? 'bg-berkeley-blue text-berkeley-gold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a2035]'
            }`}
          >
            {mp}
          </button>
        ))}
      </div>

      {/* Planner toggle */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => (showPlanner ? setShowPlanner(false) : loadPlanner())}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showPlanner
              ? 'bg-berkeley-gold text-berkeley-blue'
              : 'bg-[#111827] border border-slate-800 text-slate-400 hover:border-slate-600'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          {showPlanner ? 'Hide 3-Day Planner' : 'Show 3-Day Planner'}
        </button>
      </div>

      {/* 3-Day Planner */}
      {showPlanner && (
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Next 3 Days
          </h3>
          {plannerLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-berkeley-gold animate-spin" />
              <span className="ml-2 text-slate-400 text-sm">Loading planner...</span>
            </div>
          )}
          {!plannerLoading &&
            plannerData.map((day, i) => {
              const best = day.results.length > 0 && day.results[0].score.total_score > 0
                ? day.results[0]
                : null;
              const belowBaseline = best && baselineScore !== null && best.score.total_score < baselineScore;
              const isFirst = i === 0 || plannerData[i - 1].dateStr !== day.dateStr;
              return (
                <div key={`${day.dateStr}-${day.mealPeriod}`}>
                  {isFirst && (
                    <p className="text-xs text-berkeley-gold font-semibold mt-3 mb-1">
                      {shortDisplayDate(day.dateStr)}
                    </p>
                  )}
                  <div className={`bg-[#111827] rounded-lg p-3 border flex items-center justify-between ${
                    belowBaseline ? 'border-amber-700/40' : 'border-slate-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-500 w-16">
                        {day.mealPeriod}
                      </span>
                      {best ? (
                        <div>
                          <span className={`text-sm font-semibold ${belowBaseline ? 'text-amber-300' : 'text-white'}`}>
                            {best.location}
                          </span>
                          {belowBaseline && (
                            <p className="text-xs text-amber-400/70">Try a cafe instead</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-600">No data</span>
                      )}
                    </div>
                    {best && (
                      <span className={`text-sm font-bold ${
                        belowBaseline ? 'text-amber-400' : 'text-berkeley-gold'
                      }`}>
                        {best.score.total_score.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-berkeley-gold animate-spin" />
          <span className="ml-3 text-slate-400">Fetching menus...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-300 font-medium">Error fetching menus</p>
            <p className="text-red-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* No menus */}
      {!loading && !error && hallResults.length === 0 && (
        <div className="text-center py-16">
          <Utensils className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No menus found for this meal period</p>
          <p className="text-slate-500 text-sm mt-2">Try a different meal period or date</p>
        </div>
      )}

      {/* Unrated dishes warning */}
      {!loading && unratedMealCount > 0 && ratedCount > 0 && menus.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-300 text-sm font-medium">
              {unratedMealCount} unrated dish{unratedMealCount !== 1 ? 'es' : ''} for {mealPeriod}
            </p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Rate them for accurate scores — predictions can speed things up
            </p>
          </div>
          <Link
            href={`/rate?date=${dateStr}&meal=${mealPeriod}`}
            className="text-xs text-amber-300 hover:text-amber-200 whitespace-nowrap font-medium"
          >
            Rate now →
          </Link>
        </div>
      )}

      {/* Recommendation Banner */}
      {bestHall && bestHall.score.total_score > 0 && (
        <div className={`rounded-xl p-5 mb-6 border ${
          baselineScore !== null && bestHall.score.total_score < baselineScore
            ? 'bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-amber-700/40'
            : 'bg-gradient-to-r from-berkeley-blue to-[#004080] border-berkeley-gold/30'
        }`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
            baselineScore !== null && bestHall.score.total_score < baselineScore
              ? 'text-amber-400'
              : 'text-berkeley-gold'
          }`}>
            {baselineScore !== null && bestHall.score.total_score < baselineScore
              ? 'Use a meal swipe elsewhere'
              : 'Recommended'}
          </p>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">{bestHall.location}</h2>
            <div className="text-right">
              <p className="text-3xl font-bold text-berkeley-gold">
                {bestHall.score.total_score.toFixed(1)}
              </p>
              <p className="text-xs text-slate-400">score</p>
            </div>
          </div>
          {bestHall.score.stations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {bestHall.score.stations.map((stn) => (
                <span
                  key={stn.name}
                  className="bg-berkeley-gold/15 text-berkeley-gold text-xs px-2 py-1 rounded-full"
                >
                  {stn.name} ({stn.score.toFixed(1)})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No ratings notice */}
      {!loading && ratedCount === 0 && menus.length > 0 && (
        <div className="bg-[#111827] border border-slate-700 rounded-lg p-4 mb-6 text-center">
          <p className="text-slate-300">You haven&apos;t rated any dishes yet!</p>
          <Link
            href={`/rate?date=${dateStr}&meal=${mealPeriod}`}
            className="text-berkeley-gold hover:underline text-sm mt-1 inline-block"
          >
            Rate dishes to see recommendations →
          </Link>
        </div>
      )}

      {/* All Hall Cards */}
      {!loading && hallResults.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            All Dining Halls
          </h3>
          {hallResults.map((hall, idx) => (
            <div
              key={hall.location}
              className={`bg-[#111827] rounded-lg p-4 border ${
                idx === 0 && hall.score.total_score > 0
                  ? 'border-berkeley-gold/30'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0 && hall.score.total_score > 0
                        ? 'bg-berkeley-gold text-berkeley-blue'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{hall.location}</h4>
                    <p className="text-xs text-slate-500">
                      {hall.activePeriod}
                      {hall.activePeriod !== mealPeriod && ` (showing ${hall.activePeriod})`}
                      {hallDistances[hall.location] != null && ` · ${hallDistances[hall.location]} min walk`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xl font-bold ${
                      hall.score.total_score > 0 ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {hall.score.total_score > 0 ? hall.score.total_score.toFixed(1) : '—'}
                  </p>
                </div>
              </div>

              {/* Station breakdown */}
              {hall.score.stations.length > 0 && (
                <div className="mt-3 space-y-2">
                  {hall.score.stations.map((stn) => (
                    <div
                      key={stn.name}
                      className="bg-[#0a0f1a] rounded-md p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-300">{stn.name}</span>
                        <span className="text-sm font-semibold text-berkeley-gold">
                          {stn.score.toFixed(1)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Entrees: {stn.entree_avg.toFixed(1)}
                        {stn.rice_bonus > 0 && ` + Rice: ${stn.rice_bonus.toFixed(1)}`}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {stn.details.map((item) => (
                          <span
                            key={item.name}
                            className="text-xs bg-[#1a2035] text-slate-400 px-2 py-0.5 rounded"
                          >
                            {item.name}
                            {rankings[item.name] != null && rankings[item.name] > 0 && (
                              <span className="text-berkeley-gold ml-1">
                                <Star className="w-3 h-3 inline -mt-0.5" />{' '}
                                {rankings[item.name]}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hall.score.stations.length === 0 && (
                <p className="text-xs text-slate-600 mt-2">No rated dishes at this hall</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats footer */}
      {ratedCount > 0 && (
        <div className="mt-6 text-center text-xs text-slate-600">
          {ratedCount} dish{ratedCount !== 1 ? 'es' : ''} rated
        </div>
      )}
    </main>
  );
}
