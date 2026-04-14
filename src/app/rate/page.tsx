'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/app/providers';
import { MenuData, MenuItem, Rankings, DietaryPreferences } from '@/lib/types';
import { getCurrentMealPeriod, resolveActivePeriod } from '@/lib/scoring';
import {
  loadRankings,
  saveRankings,
  loadIgnoredCategories,
  saveIgnoredCategories,
  loadDietaryPreferences,
  saveDietaryPreferences,
  loadCategoryPreferences,
  loadAutoAccept,
  saveAutoAccept,
  loadHeadlinersOnly,
  saveHeadlinersOnly,
  loadPreciseMode,
  savePreciseMode,
  loadVeganMeatPref,
} from '@/lib/storage';
import { CategoryPreferences } from '@/lib/types';
import { shouldExcludeDish } from '@/lib/dietary';
import { pushToCloud, syncWithCloud } from '@/lib/sync';
import { filterToHeadliners, classifyDish } from '@/lib/headliner';
import Link from 'next/link';
import { ArrowLeft, SkipForward, Check, Star, Filter, X, ChevronLeft, Layers, CalendarRange, Sparkles, Search, Zap, Shield, SlidersHorizontal } from 'lucide-react';
import { predict, predictAll, tokenize, scoreDishUsefulness } from '@/lib/prediction';
import { Prediction } from '@/lib/types';
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
  allergens: string[];
  dietaryChoices: string[];
}

// ─── 5-Button Rating Config ────────────────────────────────────────────────

const RATING_BUTTONS = [
  { label: 'Love', emoji: '\u2B50', value: 10, defaultBg: 'bg-berkeley-gold/20', activeBg: 'bg-berkeley-gold text-berkeley-blue', activeRing: 'ring-berkeley-gold/50' },
  { label: 'Good', emoji: '\uD83D\uDC4D', value: 8, defaultBg: 'bg-blue-600/20', activeBg: 'bg-blue-600 text-white', activeRing: 'ring-blue-500/50' },
  { label: 'Fine', emoji: '\uD83D\uDE10', value: 6, defaultBg: 'bg-slate-700/50', activeBg: 'bg-slate-600 text-white', activeRing: 'ring-slate-500/50' },
  { label: 'Meh', emoji: '\uD83D\uDE15', value: 4, defaultBg: 'bg-orange-600/20', activeBg: 'bg-orange-700 text-white', activeRing: 'ring-orange-600/50' },
  { label: 'Skip', emoji: '\u274C', value: -1, defaultBg: 'bg-red-600/20', activeBg: 'bg-red-700 text-white', activeRing: 'ring-red-600/50' },
] as const;

function ratingToBucket(rating: number): number {
  if (rating === -1) return -1;
  if (rating >= 9) return 10;    // Love
  if (rating >= 7) return 8;     // Good
  if (rating >= 5) return 6;     // Fine
  return 4;                      // Meh
}

function predictionToBucket(pred: Prediction): typeof RATING_BUTTONS[number] | null {
  if (pred.predictedSkip) return RATING_BUTTONS[4]; // Skip
  return RATING_BUTTONS.find(b => b.value === ratingToBucket(pred.rating)) || null;
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
  const [showFilters, setShowFilters] = useState(false);
  const [ignoredCategories, setIgnoredCategories] = useState<string[]>([]);
  const [rateAll, setRateAll] = useState(false);
  const [rateWeek, setRateWeek] = useState(false);
  const [weekMenus, setWeekMenus] = useState<MenuData[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [history, setHistory] = useState<{ name: string; rating: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [headlinersOnly, setHeadlinersOnlyState] = useState(false);
  const [preciseMode, setPreciseModeState] = useState(false);
  const [showDietary, setShowDietary] = useState(false);
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPreferences>({ diets: [], allergens: [] });
  const [categoryPrefs, setCategoryPrefs] = useState<CategoryPreferences>({});
  const [veganMeatPref, setVeganMeatPref] = useState<boolean | null>(null);
  const [expandedSearchItem, setExpandedSearchItem] = useState<string | null>(null);
  const [searchRatingInput, setSearchRatingInput] = useState('');
  const [autoAccept, setAutoAcceptState] = useState(false);
  const [pendingAutoAccept, setPendingAutoAccept] = useState<{ name: string; rating: number }[]>([]);
  const [autoAcceptedItems, setAutoAcceptedItems] = useState<{ name: string; rating: number }[]>([]);
  const [showAutoAcceptReview, setShowAutoAcceptReview] = useState(false);
  const [ratingInput, setRatingInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const syncTimer = useRef<NodeJS.Timeout | null>(null);
  const undoneItemsRef = useRef<Set<string>>(new Set());

  // Persist-aware setters
  const setAutoAccept = useCallback((val: boolean) => {
    setAutoAcceptState(val);
    saveAutoAccept(val);
    if (!val) {
      setPendingAutoAccept([]);
      setAutoAcceptedItems([]);
      undoneItemsRef.current.clear();
    }
  }, []);

  const setHeadlinersOnly = useCallback((val: boolean) => {
    setHeadlinersOnlyState(val);
    saveHeadlinersOnly(val);
  }, []);

  const setPreciseMode = useCallback((val: boolean) => {
    setPreciseModeState(val);
    savePreciseMode(val);
  }, []);

  // Debounced cloud sync
  const scheduleCloudSync = useCallback(() => {
    if (!user) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      pushToCloud().catch(() => {});
    }, 2000);
  }, [user]);

  useEffect(() => {
    const loadExtras = () => {
      setDietaryPrefs(loadDietaryPreferences());
      setCategoryPrefs(loadCategoryPreferences());
      setAutoAcceptState(loadAutoAccept());
      setHeadlinersOnlyState(loadHeadlinersOnly());
      setPreciseModeState(loadPreciseMode());
      setVeganMeatPref(loadVeganMeatPref());
    };
    if (user) {
      syncWithCloud()
        .then(({ rankings: r, ignoredCategories: ic }) => {
          setRankings(r);
          setIgnoredCategories(ic);
          loadExtras();
        })
        .catch(() => {
          setRankings(loadRankings());
          setIgnoredCategories(loadIgnoredCategories());
          loadExtras();
        });
    } else {
      setRankings(loadRankings());
      setIgnoredCategories(loadIgnoredCategories());
      loadExtras();
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

  // Collect all unique items
  const { allAllergens, allDiets } = useMemo(() => {
    const allergenSet = new Set<string>();
    const dietSet = new Set<string>();
    const sourceMenus = rateWeek ? weekMenus : menus;
    for (const menu of sourceMenus) {
      for (const period of Object.keys(menu.meals)) {
        for (const item of menu.meals[period]) {
          for (const a of item.allergens) allergenSet.add(a);
          for (const d of item.dietaryChoices) dietSet.add(d);
        }
      }
    }
    return {
      allAllergens: Array.from(allergenSet).sort(),
      allDiets: Array.from(dietSet).sort(),
    };
  }, [menus, weekMenus, rateWeek]);

  const { allItems, allCategories } = useMemo(() => {
    const itemMap = new Map<string, UniqueItem>();
    const catSet = new Set<string>();
    const ignoredLower = new Set(ignoredCategories.map((c) => c.toLowerCase()));

    const sourceMenus = rateWeek ? weekMenus : menus;
    const iterateAllPeriods = rateAll || rateWeek;

    const addItem = (item: MenuItem) => {
      catSet.add(item.category);
      if (ignoredLower.has(item.category.toLowerCase())) return;
      if (shouldExcludeDish(item, dietaryPrefs)) return;
      const existing = itemMap.get(item.name);
      if (existing) {
        if (!existing.categories.includes(item.category)) {
          existing.categories.push(item.category);
        }
        for (const a of item.allergens) {
          if (!existing.allergens.includes(a)) existing.allergens.push(a);
        }
        for (const d of item.dietaryChoices) {
          if (!existing.dietaryChoices.includes(d)) existing.dietaryChoices.push(d);
        }
      } else {
        itemMap.set(item.name, {
          name: item.name,
          description: item.description,
          categories: [item.category],
          allergens: [...item.allergens],
          dietaryChoices: [...item.dietaryChoices],
        });
      }
    };

    for (const menu of sourceMenus) {
      if (iterateAllPeriods) {
        for (const period of Object.keys(menu.meals)) {
          for (const item of menu.meals[period]) {
            addItem(item);
          }
        }
      } else {
        const activePeriod = resolveActivePeriod(menu, mealParam);
        if (!activePeriod || !menu.meals[activePeriod]) continue;
        for (const item of menu.meals[activePeriod]) {
          addItem(item);
        }
      }
    }

    return {
      allItems: Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      allCategories: Array.from(catSet).sort(),
    };
  }, [menus, weekMenus, mealParam, ignoredCategories, rateAll, rateWeek, dietaryPrefs]);

  // Filter to headliners when toggle is on (client-side classification)
  const filteredItems = useMemo(() => {
    if (!headlinersOnly) return allItems;
    // Convert UniqueItems to MenuItems for headliner classification
    const asMenuItems: MenuItem[] = allItems.map(item => ({
      name: item.name,
      category: item.categories[0] || '',
      description: item.description,
      allergens: item.allergens,
      dietaryChoices: item.dietaryChoices,
    }));
    const headliners = filterToHeadliners(asMenuItems);
    const headlinerNames = new Set(headliners.map(h => h.name));
    return allItems.filter(item => headlinerNames.has(item.name));
  }, [allItems, headlinersOnly]);

  // Unrated items, sorted by station then by keyword similarity within each station.
  const unratedItems = useMemo(() => {
    const unrated = filteredItems.filter((item) => !(item.name in rankings));
    return unrated.sort((a, b) => {
      const catA = (a.categories[0] || '').toLowerCase();
      const catB = (b.categories[0] || '').toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB);
      const tokensA = tokenize(a.name);
      const tokensB = tokenize(b.name);
      const keyA = tokensA[0] || '';
      const keyB = tokensB[0] || '';
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      return a.name.localeCompare(b.name);
    });
  }, [filteredItems, rankings]);

  const currentItem = unratedItems[currentIndex] || null;
  const totalUnrated = unratedItems.length;
  const totalItems = filteredItems.length;
  const ratedCount = filteredItems.filter((item) => item.name in rankings).length;
  const totalAllItems = allItems.length;

  // Predict rating for current dish
  const currentPrediction: Prediction | null = useMemo(() => {
    if (!currentItem) return null;
    const allDishNames = [...allItems.map((i) => i.name), ...Object.keys(rankings)];
    const dishCategories: Record<string, string> = {};
    for (const item of allItems) {
      if (item.categories.length > 0) {
        dishCategories[item.name] = item.categories[0];
      }
    }
    return predict(
      { name: currentItem.name, category: currentItem.categories[0] },
      rankings,
      allDishNames,
      dishCategories,
      categoryPrefs
    );
  }, [currentItem, rankings, allItems, categoryPrefs]);

  // Auto-skip vegan meat dishes when user said "no" to vegan meat
  const isVeganMeatDish = useCallback((name: string): boolean => {
    const lower = name.toLowerCase();
    const veganMarkers = ['vegan', 'plant', 'impossible', 'beyond', 'meatless', 'veggie'];
    const meatWords = ['chicken', 'turkey', 'beef', 'burger', 'sausage', 'meatball', 'bacon', 'ham', 'pork', 'steak', 'patty', 'tender', 'nugget', 'wing'];
    const hasVeganMarker = veganMarkers.some(m => lower.includes(m));
    const hasMeatWord = meatWords.some(m => lower.includes(m));
    return hasVeganMarker && hasMeatWord;
  }, []);

  useEffect(() => {
    if (veganMeatPref !== false || loading || weekLoading) return;
    let changed = false;
    const newRankings = { ...rankings };
    for (const item of unratedItems) {
      if (isVeganMeatDish(item.name)) {
        newRankings[item.name] = -1;
        changed = true;
      }
    }
    if (changed) {
      setRankings(newRankings);
      saveRankings(newRankings);
      scheduleCloudSync();
    }
  }, [veganMeatPref, unratedItems, loading, weekLoading]);

  // Auto-accept: collect pending predictions
  useEffect(() => {
    if (!autoAccept || loading || weekLoading) return;
    if (unratedItems.length === 0) { setPendingAutoAccept([]); return; }

    const dishContexts = unratedItems
      .filter((item) => !undoneItemsRef.current.has(item.name))
      .map((item) => ({
        name: item.name,
        category: item.categories[0],
      }));
    if (dishContexts.length === 0) { setPendingAutoAccept([]); return; }

    const dishCategories: Record<string, string> = {};
    for (const item of allItems) {
      if (item.categories.length > 0) dishCategories[item.name] = item.categories[0];
    }

    const predictions = predictAll(dishContexts, rankings, dishCategories, categoryPrefs);
    const pending: { name: string; rating: number }[] = [];

    for (const [name, pred] of Array.from(predictions.entries())) {
      if (undoneItemsRef.current.has(name)) continue;
      if (pred.similarDishes.length < 3) continue;
      if (pred.predictedSkip && pred.confidence >= 0.70) {
        pending.push({ name, rating: -1 });
      } else if (!pred.predictedSkip && pred.confidence >= 0.65) {
        pending.push({ name, rating: pred.rating });
      }
    }

    setPendingAutoAccept(pending);
  }, [autoAccept, unratedItems, loading, weekLoading, allItems, rankings, categoryPrefs]);

  const applyPendingAutoAccept = useCallback(() => {
    if (pendingAutoAccept.length === 0) return;
    const newRankings = { ...rankings };
    for (const item of pendingAutoAccept) {
      newRankings[item.name] = item.rating;
    }
    setRankings(newRankings);
    saveRankings(newRankings);
    scheduleCloudSync();
    setAutoAcceptedItems((prev) => [...prev, ...pendingAutoAccept]);
    setPendingAutoAccept([]);
  }, [pendingAutoAccept, rankings, scheduleCloudSync]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allItems.filter((item) => {
      const inName = item.name.toLowerCase().includes(q);
      const inCat = item.categories.some(c => c.toLowerCase().includes(q));
      return inName || inCat;
    });
  }, [searchQuery, allItems]);

  const unratedSearchResults = useMemo(
    () => searchResults.filter((item) => !(item.name in rankings)),
    [searchResults, rankings]
  );

  const searchPredictions = useMemo(() => {
    const preds = new Map<string, Prediction>();
    if (!searchQuery.trim()) return preds;
    const allDishNames = [...allItems.map((i) => i.name), ...Object.keys(rankings)];
    const dishCategories: Record<string, string> = {};
    for (const item of allItems) {
      if (item.categories.length > 0) dishCategories[item.name] = item.categories[0];
    }
    for (const item of unratedSearchResults) {
      const pred = predict(
        { name: item.name, category: item.categories[0] },
        rankings,
        allDishNames,
        dishCategories,
        categoryPrefs
      );
      if (pred) preds.set(item.name, pred);
    }
    return preds;
  }, [searchQuery, unratedSearchResults, rankings, allItems, categoryPrefs]);

  const handleMassSkip = useCallback(() => {
    if (unratedSearchResults.length === 0) return;
    const newRankings = { ...rankings };
    for (const item of unratedSearchResults) {
      newRankings[item.name] = -1;
    }
    setRankings(newRankings);
    saveRankings(newRankings);
    scheduleCloudSync();
    setSearchQuery('');
    setSearchOpen(false);
  }, [unratedSearchResults, rankings, scheduleCloudSync]);

  const handleSearchRate = useCallback(
    (name: string, rating: number) => {
      const newRankings = { ...rankings, [name]: rating };
      setRankings(newRankings);
      saveRankings(newRankings);
      scheduleCloudSync();
    },
    [rankings, scheduleCloudSync]
  );

  // Rate a dish — for 5-button mode. Auto-advances for new dishes.
  const handleRate = useCallback(
    (rating: number) => {
      if (!currentItem) return;
      const wasAlreadyRated = currentItem.name in rankings;
      const newRankings = { ...rankings, [currentItem.name]: rating };
      setRankings(newRankings);
      saveRankings(newRankings);
      scheduleCloudSync();
      if (!wasAlreadyRated) {
        setHistory((prev) => [...prev, { name: currentItem.name, rating }]);
      }
      setRatingInput('');
    },
    [currentItem, rankings, scheduleCloudSync]
  );

  const handleSkip = useCallback(() => {
    if (!currentItem) return;
    const wasAlreadyRated = currentItem.name in rankings;
    const newRankings = { ...rankings, [currentItem.name]: -1 };
    setRankings(newRankings);
    saveRankings(newRankings);
    scheduleCloudSync();
    if (!wasAlreadyRated) {
      setHistory((prev) => [...prev, { name: currentItem.name, rating: -1 }]);
    }
    setRatingInput('');
  }, [currentItem, rankings, scheduleCloudSync]);

  const handleBack = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    const newRankings = { ...rankings };
    delete newRankings[prev.name];
    setRankings(newRankings);
    saveRankings(newRankings);
    setHistory((h) => h.slice(0, -1));
    setRatingInput('');
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

  // Get existing rating bucket for current dish (for re-rate highlighting)
  const existingRating = currentItem ? rankings[currentItem.name] : undefined;
  const existingBucket = existingRating !== undefined ? ratingToBucket(existingRating) : null;

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
            {headlinersOnly && totalAllItems > totalItems && (
              <span className="text-slate-600"> ({totalAllItems} total)</span>
            )}
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
          onClick={() => { setSearchOpen(!searchOpen); setSearchQuery(''); setTimeout(() => searchInputRef.current?.focus(), 100); }}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
            searchOpen
              ? 'bg-berkeley-gold text-berkeley-blue border-berkeley-gold'
              : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-600'
          }`}
          title="Search & mass skip"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={() => setAutoAccept(!autoAccept)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
            autoAccept
              ? 'bg-purple-600 text-white border-purple-500'
              : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-600'
          }`}
          title={autoAccept ? 'Auto-accept predictions: ON' : 'Auto-accept predictions: OFF'}
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <button
          onClick={() => setHeadlinersOnly(!headlinersOnly)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
            headlinersOnly
              ? 'bg-berkeley-gold text-berkeley-blue border-berkeley-gold'
              : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-600'
          }`}
          title={headlinersOnly ? 'Headliners only: ON' : 'Headliners only: OFF (showing all items)'}
        >
          <Zap className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowDietary(!showDietary)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors relative ${
            showDietary
              ? 'bg-berkeley-gold text-berkeley-blue border-berkeley-gold'
              : dietaryPrefs.diets.length + dietaryPrefs.allergens.length > 0
              ? 'bg-green-900/50 border-green-500/50 text-green-400'
              : 'bg-[#111827] border-slate-800 text-slate-400 hover:border-slate-600'
          }`}
          title="Dietary restrictions & allergen filters"
        >
          <Shield className="w-4 h-4" />
          {dietaryPrefs.diets.length + dietaryPrefs.allergens.length > 0 && !showDietary && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center">
              {dietaryPrefs.diets.length + dietaryPrefs.allergens.length}
            </span>
          )}
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

      {/* Pending Auto-Accept Banner */}
      {pendingAutoAccept.length > 0 && (
        <div className="bg-purple-900/20 rounded-lg border border-purple-500/30 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-200">
                {pendingAutoAccept.length} dish{pendingAutoAccept.length !== 1 ? 'es' : ''} ready
                {' '}({pendingAutoAccept.filter(i => i.rating > 0).length} rated, {pendingAutoAccept.filter(i => i.rating === -1).length} skipped)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAutoAcceptReview(!showAutoAcceptReview)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                {showAutoAcceptReview ? 'Hide' : 'Review'}
              </button>
              <button
                onClick={applyPendingAutoAccept}
                className="text-xs px-3 py-1 rounded bg-purple-600/40 text-purple-100 hover:bg-purple-600/60 font-medium transition-colors"
              >
                Apply All
              </button>
            </div>
          </div>
          {showAutoAcceptReview && (
            <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
              {pendingAutoAccept.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm px-2 py-1.5 rounded bg-purple-900/20">
                  <span className="text-purple-200 truncate mr-2 flex-1 min-w-0">{item.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {RATING_BUTTONS.slice(0, 4).map((btn) => (
                      <button
                        key={btn.value}
                        onClick={() => setPendingAutoAccept((prev) =>
                          prev.map((p) => p.name === item.name ? { ...p, rating: btn.value } : p)
                        )}
                        className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                          ratingToBucket(item.rating) === btn.value
                            ? 'bg-purple-500 text-white'
                            : 'bg-purple-900/30 text-purple-400/60 hover:text-purple-300'
                        }`}
                        title={btn.label}
                      >
                        {btn.emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => setPendingAutoAccept((prev) =>
                        prev.map((p) => p.name === item.name
                          ? { ...p, rating: p.rating === -1 ? 6 : -1 }
                          : p
                        )
                      )}
                      className={`px-1.5 h-7 rounded text-xs font-medium transition-colors ${
                        item.rating === -1
                          ? 'bg-red-600/40 text-red-200'
                          : 'bg-red-900/20 text-red-400/60 hover:text-red-300'
                      }`}
                    >
                      {RATING_BUTTONS[4].emoji}
                    </button>
                    <button
                      onClick={() => {
                        undoneItemsRef.current.add(item.name);
                        setPendingAutoAccept((prev) => prev.filter((p) => p.name !== item.name));
                      }}
                      className="w-6 h-6 rounded text-xs text-slate-600 hover:text-slate-300 transition-colors"
                    >
                      <X className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Applied Auto-Accept Review */}
      {autoAcceptedItems.length > 0 && (
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-3 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {autoAcceptedItems.length} auto-applied
            </span>
            <button
              onClick={() => {
                const newRankings = { ...rankings };
                for (const item of autoAcceptedItems) {
                  delete newRankings[item.name];
                  undoneItemsRef.current.add(item.name);
                }
                setRankings(newRankings);
                saveRankings(newRankings);
                scheduleCloudSync();
                setAutoAcceptedItems([]);
              }}
              className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Undo All
            </button>
          </div>
        </div>
      )}

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

      {/* Dietary Restrictions Panel */}
      {showDietary && (
        <div className="bg-[#111827] rounded-lg p-4 mb-6 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Dietary Restrictions</h3>
            <button onClick={() => setShowDietary(false)}>
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {allDiets.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-2">Dietary requirements (only show matching dishes)</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {allDiets.map((diet) => {
                  const active = dietaryPrefs.diets.includes(diet);
                  return (
                    <button
                      key={diet}
                      onClick={() => {
                        const newDiets = active
                          ? dietaryPrefs.diets.filter((d) => d !== diet)
                          : [...dietaryPrefs.diets, diet];
                        const newPrefs = { ...dietaryPrefs, diets: newDiets };
                        setDietaryPrefs(newPrefs);
                        saveDietaryPreferences(newPrefs);
                        setCurrentIndex(0);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        active
                          ? 'bg-green-600/40 text-green-200 border border-green-500/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {diet.replace(' Option', '')}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {allAllergens.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-2">Allergens to avoid (hide dishes containing these)</p>
              <div className="flex flex-wrap gap-2">
                {allAllergens.map((allergen) => {
                  const active = dietaryPrefs.allergens.includes(allergen);
                  return (
                    <button
                      key={allergen}
                      onClick={() => {
                        const newAllergens = active
                          ? dietaryPrefs.allergens.filter((a) => a !== allergen)
                          : [...dietaryPrefs.allergens, allergen];
                        const newPrefs = { ...dietaryPrefs, allergens: newAllergens };
                        setDietaryPrefs(newPrefs);
                        saveDietaryPreferences(newPrefs);
                        setCurrentIndex(0);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        active
                          ? 'bg-red-600/40 text-red-200 border border-red-500/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {allergen}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {allDiets.length === 0 && allAllergens.length === 0 && (
            <p className="text-xs text-slate-500">No dietary or allergen data available in current menus.</p>
          )}
        </div>
      )}

      {/* Search Panel */}
      {searchOpen && (
        <div className="bg-[#111827] rounded-lg border border-slate-800 mb-6 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes (e.g. carrots, soup, pizza)..."
                className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
                <X className="w-4 h-4 text-slate-500 hover:text-slate-300" />
              </button>
            </div>

            {searchQuery.trim() && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">
                    {searchResults.length} found · {unratedSearchResults.length} unrated
                  </span>
                  {unratedSearchResults.length > 0 && (
                    <button
                      onClick={handleMassSkip}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-red-600/30 border border-red-500/40 text-red-200 hover:bg-red-600/50 transition-colors"
                    >
                      <SkipForward className="w-3 h-3" />
                      Skip All {unratedSearchResults.length}
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1">
                  {searchResults.map((item) => {
                    const rated = item.name in rankings;
                    const rating = rankings[item.name];
                    const pred = searchPredictions.get(item.name);
                    const isExpanded = expandedSearchItem === item.name;
                    return (
                      <div key={item.name} className={`rounded-lg text-sm ${
                        rated ? 'bg-slate-800/30 text-slate-500' : 'bg-[#0a0f1a] text-white'
                      }`}>
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="flex-1 min-w-0 mr-2">
                            <span className="truncate block">{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600">{item.categories.join(', ')}</span>
                              {!rated && pred && pred.confidence >= 0.5 && (
                                <span className={`text-xs ${pred.predictedSkip ? 'text-red-400' : 'text-purple-400'}`}>
                                  {pred.predictedSkip ? 'skip' : `~${pred.rating}`}
                                </span>
                              )}
                            </div>
                          </div>
                          {rated && !isExpanded ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs">{rating === -1 ? 'skipped' : rating}</span>
                              <button
                                onClick={() => {
                                  setExpandedSearchItem(isExpanded ? null : item.name);
                                  setSearchRatingInput('');
                                }}
                                className="px-1.5 py-0.5 rounded text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                              >
                                edit
                              </button>
                            </div>
                          ) : !isExpanded ? (
                            <div className="flex items-center gap-1 shrink-0">
                              {pred && pred.confidence >= 0.5 && !pred.predictedSkip && (
                                <button
                                  onClick={() => handleSearchRate(item.name, pred.rating)}
                                  className="px-2 py-1 rounded text-xs bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 transition-colors"
                                >
                                  {pred.rating}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setExpandedSearchItem(isExpanded ? null : item.name);
                                  setSearchRatingInput('');
                                }}
                                className="px-2 py-1 rounded text-xs bg-berkeley-gold/20 text-berkeley-gold hover:bg-berkeley-gold/40 transition-colors"
                              >
                                Rate
                              </button>
                              <button
                                onClick={() => handleSearchRate(item.name, -1)}
                                className="px-2 py-1 rounded text-xs bg-red-600/20 text-red-300 hover:bg-red-600/40 transition-colors"
                              >
                                Skip
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-2 flex gap-1 items-center flex-wrap">
                            {RATING_BUTTONS.map((btn) => (
                              <button
                                key={btn.value}
                                onClick={() => { handleSearchRate(item.name, btn.value); setExpandedSearchItem(null); }}
                                className={`h-8 px-2.5 rounded text-xs font-medium transition-colors ${btn.defaultBg} text-slate-300 hover:opacity-80`}
                              >
                                <span>{btn.emoji}</span>
                                <span className="hidden sm:inline ml-1">{btn.label}</span>
                              </button>
                            ))}
                            <form onSubmit={(e) => {
                              e.preventDefault();
                              const val = parseFloat(searchRatingInput);
                              if (!isNaN(val) && val >= 1 && val <= 10) {
                                handleSearchRate(item.name, val);
                                setExpandedSearchItem(null);
                              }
                            }} className="flex gap-1 ml-1">
                              <input
                                type="number"
                                min="1"
                                max="10"
                                step="0.5"
                                value={searchRatingInput}
                                onChange={(e) => setSearchRatingInput(e.target.value)}
                                placeholder="0.5"
                                className="w-12 bg-[#111827] border border-slate-700 rounded px-1 py-1 text-white text-xs text-center placeholder-slate-600 focus:outline-none focus:border-berkeley-gold"
                              />
                            </form>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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
          {headlinersOnly && totalAllItems > totalItems && (
            <button
              onClick={() => setHeadlinersOnly(false)}
              className="text-sm text-slate-500 hover:text-slate-300 mb-4 block mx-auto transition-colors"
            >
              Show all {totalAllItems - totalItems} hidden items
            </button>
          )}
          <Link
            href={`/?date=${dateParam}&meal=${mealParam}`}
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
              {currentItem.dietaryChoices.map((diet) => (
                <span
                  key={diet}
                  className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full"
                >
                  {diet.replace(' Option', '')}
                </span>
              ))}
              {currentItem.allergens.map((allergen) => (
                <span
                  key={allergen}
                  className="text-xs bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded-full"
                >
                  {allergen}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{currentItem.name}</h2>
            {currentItem.description && currentItem.description !== currentItem.name && (
              <p className="text-sm text-slate-400">{currentItem.description}</p>
            )}
            {/* Show existing rating if re-rating */}
            {existingRating !== undefined && (
              <p className="text-xs text-slate-500 mt-2">
                Previously rated: {existingRating === -1 ? 'Skipped' : existingRating}
              </p>
            )}
          </div>

          {/* Prediction */}
          {currentPrediction && currentPrediction.confidence >= 0.5 && existingRating === undefined && (
            <div className={`border-t border-slate-800 px-6 py-4 ${
              currentPrediction.predictedSkip ? 'bg-red-900/10' : 'bg-purple-900/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-4 h-4 ${currentPrediction.predictedSkip ? 'text-red-400' : 'text-purple-400'}`} />
                  <span className={`text-sm ${currentPrediction.predictedSkip ? 'text-red-300' : 'text-purple-300'}`}>
                    {currentPrediction.predictedSkip ? (
                      <>Predicted: <span className="font-bold text-red-200">Skip</span></>
                    ) : (
                      <>Predicted: <span className="font-bold text-purple-200">{currentPrediction.rating}</span></>
                    )}
                  </span>
                  <span className={`text-xs ${currentPrediction.predictedSkip ? 'text-red-400/60' : 'text-purple-400/60'}`}>
                    ({Math.round(currentPrediction.confidence * 100)}%)
                  </span>
                </div>
                <button
                  onClick={() => currentPrediction.predictedSkip ? handleSkip() : handleRate(currentPrediction.rating)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPrediction.predictedSkip
                      ? 'bg-red-600/30 border border-red-500/40 text-red-200 hover:bg-red-600/50'
                      : 'bg-purple-600/30 border border-purple-500/40 text-purple-200 hover:bg-purple-600/50'
                  }`}
                >
                  {currentPrediction.predictedSkip ? (
                    <><SkipForward className="w-3.5 h-3.5" /> Skip</>
                  ) : (
                    <><Check className="w-3.5 h-3.5" /> Accept</>
                  )}
                </button>
              </div>
              {currentPrediction.similarDishes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentPrediction.similarDishes.slice(0, 3).map((d) => (
                    <span
                      key={d.name}
                      className={`text-xs px-2 py-0.5 rounded ${
                        currentPrediction.predictedSkip
                          ? 'bg-red-900/30 text-red-300/70'
                          : 'bg-purple-900/30 text-purple-300/70'
                      }`}
                    >
                      {d.name} ({d.rating === -1 ? 'skip' : d.rating})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rating input */}
          <div className="border-t border-slate-800 p-6">
            {preciseMode ? (
              /* Precise mode: original slider + 1-10 buttons */
              <>
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
                <div className="flex gap-1.5 mt-3 justify-center">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleRate(n)}
                      className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                        existingRating === n
                          ? 'bg-berkeley-gold text-berkeley-blue border border-berkeley-gold'
                          : 'bg-[#0a0f1a] border border-slate-700 text-slate-400 hover:border-berkeley-gold hover:text-berkeley-gold'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
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
                    className="flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300"
                  >
                    <SkipForward className="w-4 h-4" />
                    Skip
                  </button>
                </div>
              </>
            ) : (
              /* 5-button mode (default) */
              <>
                {/* Predicted bucket highlight */}
                {currentPrediction && currentPrediction.confidence >= 0.5 && existingRating === undefined && (() => {
                  const predBucket = predictionToBucket(currentPrediction);
                  if (!predBucket) return null;
                  return null; // prediction indicator handled via ring below
                })()}

                {/* 5-button row */}
                <div className="flex gap-2 justify-center" role="radiogroup" aria-label="Rate this dish">
                  {RATING_BUTTONS.map((btn) => {
                    const isActive = existingBucket === btn.value;
                    const isPredicted = existingRating === undefined && currentPrediction && currentPrediction.confidence >= 0.5
                      && predictionToBucket(currentPrediction)?.value === btn.value;

                    return (
                      <button
                        key={btn.value}
                        role="radio"
                        aria-checked={isActive}
                        aria-label={`${btn.label}, rating ${btn.value === -1 ? 'skip' : btn.value}`}
                        onClick={() => btn.value === -1 ? handleSkip() : handleRate(btn.value)}
                        className={`flex-1 min-w-0 h-14 rounded-xl text-sm font-semibold transition-all flex flex-col items-center justify-center gap-0.5 ${
                          isActive
                            ? `${btn.activeBg} ring-2 ${btn.activeRing}`
                            : isPredicted
                            ? `${btn.defaultBg} ring-2 ring-dashed ring-purple-400/60 text-slate-300`
                            : `${btn.defaultBg} text-slate-400 hover:opacity-80`
                        }`}
                      >
                        <span className="text-base">{btn.emoji}</span>
                        <span className="hidden sm:block text-[10px] leading-none">{btn.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Back button */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleBack}
                    disabled={history.length === 0}
                    className="flex-1 py-2.5 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                </div>
              </>
            )}

            {/* Precise mode toggle */}
            <button
              onClick={() => setPreciseMode(!preciseMode)}
              className="mt-3 text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1 mx-auto"
            >
              <SlidersHorizontal className="w-3 h-3" />
              {preciseMode ? 'Switch to quick mode' : 'Switch to precise mode'}
            </button>
          </div>
        </div>
      )}

      {/* Headliner expand toggle */}
      {!loading && !weekLoading && headlinersOnly && totalAllItems > totalItems && currentItem && (
        <button
          onClick={() => setHeadlinersOnly(false)}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors mt-3 block mx-auto"
        >
          Showing {totalItems} headliners — show all {totalAllItems} items
        </button>
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
