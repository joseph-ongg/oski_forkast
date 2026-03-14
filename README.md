# Oski's Forkast

Find the best UC Berkeley dining hall for every meal. Rate dishes you've tried, and Oski's Forkast scores each hall based on what's being served today.

## How It Works

1. **First time? Onboard** — tell us what foods you like, your dietary restrictions, and where you live on campus
2. **Open the app** — you'll see today's dining hall recommendations ranked by score
3. **Tap "Rate Dishes"** — rate dishes 1-10 based on how much you like them, or skip ones you'd never eat
4. **Check back daily** — as menus change, your ratings are used to score each hall and recommend the best one
5. **Switch meals** — tap Breakfast, Lunch, Dinner, or Brunch tabs to see recommendations for different meal periods

## Features

- **All 4 dining halls** — Crossroads, Cafe 3, Clark Kerr, and Foothill
- **Onboarding & settings** — rate food categories, set dietary restrictions, allergens, walk times, and more
- **Smart predictions** — unrated dishes get predicted ratings based on similar foods you've rated
- **Auto meal detection** — shows the right meal period based on time of day (including weekend brunch)
- **Dietary filters** — vegan, vegetarian, halal diet filters plus allergen exclusion
- **Walk time distance** — set your dorm and closer halls get a score boost (presets for Unit 1–3, Foothill, Clark Kerr)
- **Baseline score** — set a minimum score threshold; if no hall meets it, we suggest a cafe instead
- **3-day planner** — plan ahead by seeing recommendations for upcoming meals
- **Score breakdown** — see exactly which stations and dishes are driving each hall's score
- **Category filters** — hide entire categories you don't care about (e.g., Dessert, Soup)
- **Entrees-only mode** — auto-skip condiments, dressings, and non-entree items when rating
- **Search** — find and rate specific dishes on the rate page
- **Cloud sync** — create an account to sync your ratings across devices
- **Install on your phone** — add to home screen for a native app experience (works offline too)

## Scoring

Your ratings power a scoring algorithm that picks the best hall:

- Each station in a dining hall is scored based on your top-rated entrees there
- Rice dishes add a small bonus
- The best stations are combined into an overall hall score
- Walk time penalties are applied based on your dorm distance
- The hall with the highest score is your recommendation

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** for styling
- **Supabase** for auth and cloud sync
- **Vercel** for deployment
- **PWA** with service worker for offline support

## Local Development

```bash
cp .env.example .env.local  # fill in Supabase keys
npm install
npm run dev
```
