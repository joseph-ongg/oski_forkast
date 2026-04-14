# TODO

## Rating UX (high priority — rating fatigue)
- [ ] **Station headliner detection** — per station, compute a "headliner score" using food-type keywords + cooking method + name length. Show only top 1-2 headliners per station in rate page by default; hide sides/toppings/garnishes behind an expandable "show all" link. Target: cut rating load from ~70 to ~10-15 items per meal.
- [ ] **Dish type classifier** — tag every dish as `entree | side | sauce | dessert | beverage | garnish` at parse time (~50 lines of keyword rules in `api/menus/route.ts`). Cleaner version of headliner detection. Scoring gives sides half-weight, sauces/garnishes zero.
- [ ] **Three-button rating mode** — replace 1-10 slider with `⭐ Love (9) | 👍 Fine (6) | 👎 Never (-1)`. Optional "precise mode" toggle for power users. Massively reduces cognitive load per rating.
- [ ] **Station-level bulk rating** — new tab on /rate showing all unique stations across halls. User rates each station 1-10, becomes a prior for every dish in that station. Cuts decision count from ~70 dishes to ~15-20 stations globally.
- [ ] **"Only what matters today" rate mode** — on load, compute which unrated dishes could plausibly change today's hall recommendation if rated 8+. Show only those. When no candidates, rate page says "nothing to rate — today's pick is locked."

## Scoring algorithm (adaptive, currently hardcoded top-2)
- [ ] **Configurable meal size** — add to onboarding/settings: "I usually grab → (1) one main (2) main + side (3) main + side + rice (4) full plate." Replaces the hardcoded top-2 in `scoring.ts` with top-N using diminishing weights `[1.0, 0.7, 0.5, 0.3]`. Default N=2 preserves current behavior.
- [ ] **Remove or replace the `+1` variety bonus** — once weighted top-N is in, the variety bonus becomes redundant. Delete `scoring.ts:130` in favor of the natural compounding from multi-station contributions.
- [ ] **Plate value scoring model (alternative)** — score = (avg of all dishes ≥ 7) × (1 - exp(-count/3)). Unbounded variety reward for grazers. Experimental — probably gated behind a "browsy" vs "decisive" eater toggle that swaps between this and top-N.
- [ ] **Auto-infer meal size from rating distribution (optional)** — use count of dishes rated ≥ 8 to suggest default N during onboarding. Magic, skippable.

## UX / Polish
- [ ] Edit/change existing ratings (currently once rated, you can't easily re-rate a dish)
- [ ] Loading skeleton states instead of spinner

## Features
- [ ] Notification/reminder when a highly-rated dish appears on today's menu
- [ ] Share a meal plan or ratings with friends (export link)
- [ ] Compare two halls side-by-side for a given meal
- [ ] Favorite dishes list — see when/where they're being served this week

## Nutrition & Diet
- [ ] Parse nutrition data from XML API (calories, protein, fat, carbs, sodium, sugar, fiber, serving size, ingredients) — prerequisite for all nutrition features
- [ ] Add Kosher to dietary filters (already in API, not surfaced)
- [ ] `/calories` page — meal logging where users log what they ate (dish + servings), daily calorie/macro summary
- [ ] Goal-based modes (Bulking / Cutting / Balanced) — user sets a fitness goal, app highlights relevant dishes/halls
- [ ] Sodium/sugar alerts — flag dishes with unusually high values
- [ ] "Better alternative" suggestions — find nutritionally superior dishes with similar taste scores
- [ ] Meal balance indicator — flag meals heavily skewed (all carbs, no protein)
- [ ] Taste + nutrition blended scoring — optional mode weighting taste with protein density or nutrition quality
- [ ] Protein-per-calorie hall ranking

## Data / Accuracy
- [ ] Parse nutrition/ingredients from XML (prerequisite for all nutrition features)
- [ ] Menu caching — avoid re-fetching the same day's menus repeatedly
- [ ] Handle dining hall closures/special events gracefully
- [ ] Show actual serving times per hall (not just meal period cutoffs)

## Technical
- [ ] E2E tests for rating flow and dashboard
- [ ] Better offline experience — show cached recommendations when offline
- [ ] Export/import rankings as JSON for backup

## Bugs
- [ ] "See Recommendations" after finishing rating in Rate All/Rate Week mode doesn't know which meal to redirect to (defaults to the original meal param)
