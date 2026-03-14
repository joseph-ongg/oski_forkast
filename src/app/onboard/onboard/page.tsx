'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CategoryPreferenceLevel, CategoryPreferences } from '@/lib/types';
import { DietaryPreferences } from '@/lib/types';
import {
  saveCategoryPreferences,
  saveIgnoredCategories,
  saveDietaryPreferences,
  setOnboardingComplete,
  saveAutoAccept,
  saveEntreesOnly,
  saveVeganMeatPref,
  saveHallDistances,
  saveBaselineScore,
  loadCategoryPreferences,
  loadIgnoredCategories,
  loadDietaryPreferences,
  loadAutoAccept,
  loadEntreesOnly,
  loadVeganMeatPref,
  loadHallDistances,
  loadBaselineScore,
  isOnboardingComplete,
} from '@/lib/storage';
import { HallDistances } from '@/lib/types';
import { ONBOARDING_GROUPS, COMMON_SKIPPABLE_STATIONS } from '@/lib/onboarding';
import { Utensils, ChevronRight, Sparkles, Zap, Leaf, Shield, MapPin, Store } from 'lucide-react';

const DINING_HALLS = ['Crossroads', 'Cafe 3', 'Clark Kerr', 'Foothill'];

// Approximate walk times (minutes) from each dorm to each dining hall
const DORM_PRESETS: Record<string, HallDistances> = {
  'Unit 1': { 'Crossroads': 2, 'Cafe 3': 5, 'Foothill': 15, 'Clark Kerr': 20 },
  'Unit 2': { 'Crossroads': 3, 'Cafe 3': 3, 'Foothill': 12, 'Clark Kerr': 18 },
  'Unit 3': { 'Crossroads': 5, 'Cafe 3': 2, 'Foothill': 10, 'Clark Kerr': 15 },
  'Foothill': { 'Crossroads': 12, 'Cafe 3': 10, 'Foothill': 2, 'Clark Kerr': 10 },
  'Clark Kerr': { 'Crossroads': 18, 'Cafe 3': 15, 'Foothill': 10, 'Clark Kerr': 2 },
};

// Common dietary labels and allergens in Berkeley dining menus
// Hardcoded since onboarding runs before menus are fetched
const COMMON_DIETS = ['Vegan Option', 'Vegetarian Option', 'Halal'];
const COMMON_ALLERGENS = ['Milk', 'Egg', 'Wheat', 'Soy', 'Peanut', 'Tree Nut', 'Fish', 'Shellfish', 'Sesame', 'Gluten'];

const LEVELS: { key: CategoryPreferenceLevel; label: string; color: string }[] = [
  { key: 'love', label: 'Love', color: 'bg-berkeley-gold text-berkeley-blue' },
  { key: 'good', label: 'Good', color: 'bg-blue-600/60 text-blue-100' },
  { key: 'fine', label: 'Fine', color: 'bg-slate-600/60 text-slate-200' },
  { key: 'meh', label: 'Meh', color: 'bg-orange-600/50 text-orange-200' },
  { key: 'skip', label: 'Skip', color: 'bg-red-600/50 text-red-200' },
];

export default function OnboardPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<CategoryPreferences>({});
  const [ignoredStations, setIgnoredStations] = useState<Set<string>>(new Set());
  const [enableAutoAccept, setEnableAutoAccept] = useState(true);
  const [enableEntreesOnly, setEnableEntreesOnly] = useState(true);
  const [veganMeat, setVeganMeat] = useState<boolean | null>(null); // null = not answered
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPreferences>({ diets: [], allergens: [] });
  const [hallDists, setHallDists] = useState<HallDistances>({});
  const [baseline, setBaseline] = useState<string>('');
  const [isReturning, setIsReturning] = useState(false);

  // Load existing settings when returning to onboarding
  useEffect(() => {
    if (isOnboardingComplete()) {
      setIsReturning(true);
      setPrefs(loadCategoryPreferences());
      const saved = loadIgnoredCategories();
      if (saved.length > 0) setIgnoredStations(new Set(saved));
      setEnableAutoAccept(loadAutoAccept());
      setEnableEntreesOnly(loadEntreesOnly());
      const vm = loadVeganMeatPref();
      if (vm !== null) setVeganMeat(vm);
      setDietaryPrefs(loadDietaryPreferences());
      setHallDists(loadHallDistances());
      const bs = loadBaselineScore();
      if (bs !== null) setBaseline(String(bs));
    }
  }, []);

  const ratedCount = Object.keys(prefs).length;
  const canContinue = isReturning || ratedCount >= 8;

  const handleSelect = (groupName: string, level: CategoryPreferenceLevel) => {
    setPrefs((prev) => {
      if (prev[groupName] === level) {
        const next = { ...prev };
        delete next[groupName];
        return next;
      }
      return { ...prev, [groupName]: level };
    });
  };

  const toggleStation = (station: string) => {
    setIgnoredStations((prev) => {
      const next = new Set(prev);
      if (next.has(station)) {
        next.delete(station);
      } else {
        next.add(station);
      }
      return next;
    });
  };

  const handleComplete = () => {
    saveCategoryPreferences(prefs);
    if (ignoredStations.size > 0) {
      saveIgnoredCategories(Array.from(ignoredStations));
    }
    saveAutoAccept(enableAutoAccept);
    saveEntreesOnly(enableEntreesOnly);
    if (dietaryPrefs.diets.length > 0 || dietaryPrefs.allergens.length > 0) {
      saveDietaryPreferences(dietaryPrefs);
    }
    if (veganMeat !== null) {
      saveVeganMeatPref(veganMeat);
    }
    if (Object.keys(hallDists).length > 0) {
      saveHallDistances(hallDists);
    }
    const bsNum = parseFloat(baseline);
    saveBaselineScore(isNaN(bsNum) ? null : bsNum);
    setOnboardingComplete();
    router.push('/');
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <Utensils className="w-10 h-10 text-berkeley-gold mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-white mb-2">
          {isReturning ? 'Settings' : 'What do you like to eat?'}
        </h1>
        <p className="text-sm text-slate-400">
          {isReturning
            ? 'Update your food preferences, distances, and settings.'
            : <>Rate these food categories so we can predict your preferences.<br />You can fine-tune individual dishes later.</>
          }
        </p>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {ONBOARDING_GROUPS.map((group) => {
          const selected = prefs[group.displayName];
          return (
            <div
              key={group.displayName}
              className={`bg-[#111827] rounded-lg p-4 border transition-colors ${
                selected ? 'border-slate-600' : 'border-slate-800'
              }`}
            >
              <h3 className="text-sm font-semibold text-white mb-2">{group.displayName}</h3>
              <div className="flex gap-1">
                {LEVELS.map((level) => {
                  const isActive = selected === level.key;
                  return (
                    <button
                      key={level.key}
                      onClick={() => handleSelect(group.displayName, level.key)}
                      className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                        isActive
                          ? level.color
                          : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Vegan Meat Question */}
      <div className="bg-[#111827] rounded-lg p-4 border border-slate-800 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Leaf className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">Would you eat vegan/plant-based meat?</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Things like Impossible Burger, Vegan Chicken Tenders, Beyond Sausage, etc.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setVeganMeat(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              veganMeat === true
                ? 'bg-green-600/50 text-green-100 border border-green-500/50'
                : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            Yes, I&apos;d try it
          </button>
          <button
            onClick={() => setVeganMeat(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              veganMeat === false
                ? 'bg-red-600/40 text-red-200 border border-red-500/40'
                : 'bg-slate-800/50 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            No, skip those
          </button>
        </div>
      </div>

      {/* Dietary Restrictions */}
      <div className="bg-[#111827] rounded-lg p-4 border border-slate-800 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">Dietary restrictions</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">Only show dishes matching your diet, and hide allergens.</p>

        <p className="text-xs text-slate-500 mb-2">Diet (only show matching)</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {COMMON_DIETS.map((diet) => {
            const active = dietaryPrefs.diets.includes(diet);
            return (
              <button
                key={diet}
                onClick={() => {
                  const newDiets = active
                    ? dietaryPrefs.diets.filter((d) => d !== diet)
                    : [...dietaryPrefs.diets, diet];
                  setDietaryPrefs({ ...dietaryPrefs, diets: newDiets });
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

        <p className="text-xs text-slate-500 mb-2">Allergens to avoid (hide dishes with these)</p>
        <div className="flex flex-wrap gap-2">
          {COMMON_ALLERGENS.map((allergen) => {
            const active = dietaryPrefs.allergens.includes(allergen);
            return (
              <button
                key={allergen}
                onClick={() => {
                  const newAllergens = active
                    ? dietaryPrefs.allergens.filter((a) => a !== allergen)
                    : [...dietaryPrefs.allergens, allergen];
                  setDietaryPrefs({ ...dietaryPrefs, allergens: newAllergens });
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
      </div>

      {/* Station Filters */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Stations to skip</h2>
        <p className="text-xs text-slate-400 mb-3">
          Tap to exclude entire stations you don&apos;t care about. You can change this later.
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMON_SKIPPABLE_STATIONS.map((station) => {
            const isIgnored = ignoredStations.has(station);
            return (
              <button
                key={station}
                onClick={() => toggleStation(station)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isIgnored
                    ? 'bg-slate-800 text-slate-600 line-through'
                    : 'bg-berkeley-blue/50 text-berkeley-gold border border-berkeley-gold/30'
                }`}
              >
                {station}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hall Distances */}
      <div className="bg-[#111827] rounded-lg p-4 border border-slate-800 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-berkeley-gold" />
          <h3 className="text-sm font-semibold text-white">Where do you live?</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Pick your dorm or enter walk times manually. Closer halls get a score boost.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.keys(DORM_PRESETS).map((dorm) => {
            const isActive = JSON.stringify(hallDists) === JSON.stringify(DORM_PRESETS[dorm]);
            return (
              <button
                key={dorm}
                onClick={() => setHallDists(DORM_PRESETS[dorm])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-berkeley-gold text-berkeley-blue'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
                }`}
              >
                {dorm}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DINING_HALLS.map((hall) => (
            <div key={hall} className="flex items-center gap-2">
              <label className="text-sm text-slate-300 flex-1 truncate">{hall}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={60}
                  placeholder="—"
                  value={hallDists[hall] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHallDists((prev) => {
                      if (val === '') {
                        const next = { ...prev };
                        delete next[hall];
                        return next;
                      }
                      return { ...prev, [hall]: Math.max(0, parseInt(val) || 0) };
                    });
                  }}
                  className="w-14 bg-[#0a0f1a] border border-slate-700 rounded px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-berkeley-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-slate-500">min</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Baseline Score */}
      <div className="bg-[#111827] rounded-lg p-4 border border-slate-800 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Store className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Minimum dining hall score</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          If no dining hall scores above this, the planner suggests using your meal swipe at a cafe instead (e.g., Golden Bear).
          Leave blank to disable.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={10}
            step={0.5}
            placeholder="e.g. 7"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            className="w-20 bg-[#0a0f1a] border border-slate-700 rounded px-3 py-1.5 text-sm text-white text-center focus:outline-none focus:border-berkeley-gold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-slate-500">out of 10</span>
        </div>
      </div>

      {/* Quick Settings */}
      <div className="mb-24">
        <h2 className="text-lg font-semibold text-white mb-3">Quick settings</h2>
        <div className="space-y-3">
          <button
            onClick={() => setEnableAutoAccept(!enableAutoAccept)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
              enableAutoAccept
                ? 'bg-purple-900/20 border-purple-500/30'
                : 'bg-[#111827] border-slate-800'
            }`}
          >
            <Sparkles className={`w-5 h-5 shrink-0 ${enableAutoAccept ? 'text-purple-400' : 'text-slate-600'}`} />
            <div className="flex-1">
              <span className={`text-sm font-medium ${enableAutoAccept ? 'text-purple-200' : 'text-slate-400'}`}>
                Smart predictions
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Suggest batch ratings based on your preferences. You review before applying.
              </p>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${
              enableAutoAccept ? 'bg-purple-500 justify-end' : 'bg-slate-700 justify-start'
            }`}>
              <div className="w-4 h-4 bg-white rounded-full mx-1" />
            </div>
          </button>

          <button
            onClick={() => setEnableEntreesOnly(!enableEntreesOnly)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
              enableEntreesOnly
                ? 'bg-berkeley-gold/10 border-berkeley-gold/30'
                : 'bg-[#111827] border-slate-800'
            }`}
          >
            <Zap className={`w-5 h-5 shrink-0 ${enableEntreesOnly ? 'text-berkeley-gold' : 'text-slate-600'}`} />
            <div className="flex-1">
              <span className={`text-sm font-medium ${enableEntreesOnly ? 'text-berkeley-gold' : 'text-slate-400'}`}>
                Entrees only
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Auto-skip condiments, dressings, toppings, and non-entree items. Only rate actual dishes.
              </p>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center ${
              enableEntreesOnly ? 'bg-berkeley-gold justify-end' : 'bg-slate-700 justify-start'
            }`}>
              <div className="w-4 h-4 bg-white rounded-full mx-1" />
            </div>
          </button>
        </div>
      </div>

      {/* Bottom sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0f1a]/95 backdrop-blur border-t border-slate-800 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              {ratedCount}/{ONBOARDING_GROUPS.length} rated
            </span>
            {!canContinue && (
              <span className="text-xs text-slate-600">
                (need {8 - ratedCount} more)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setOnboardingComplete();
                router.push('/');
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={handleComplete}
              disabled={!canContinue}
              className="bg-berkeley-gold text-berkeley-blue font-semibold px-5 py-2.5 rounded-lg hover:bg-berkeley-lightgold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isReturning ? 'Save Settings' : 'Get Recommendations'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
