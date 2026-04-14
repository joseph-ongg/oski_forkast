import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { MenuItem, MenuData } from '@/lib/types';
import { classifyDish } from '@/lib/headliner';

const BASE_URL = 'https://dining.berkeley.edu/wp-content/uploads/menus-exportimport/';

const LOCATIONS: Record<string, string> = {
  'Crossroads': 'Crossroads',
  'Cafe 3': 'Cafe_3',
  'Clark Kerr': 'Clark_Kerr_Campus',
  'Foothill': 'Foothill',
};

function parseAllergens(allergensData: any): string[] {
  if (!allergensData?.allergen) return [];
  const allergens = Array.isArray(allergensData.allergen)
    ? allergensData.allergen
    : [allergensData.allergen];
  return allergens
    .filter((a: any) => a['#text'] === 'Yes')
    .map((a: any) => a['@_id'] || '');
}

function parseDietaryChoices(dietaryData: any): string[] {
  if (!dietaryData?.dietaryChoice) return [];
  const choices = Array.isArray(dietaryData.dietaryChoice)
    ? dietaryData.dietaryChoice
    : [dietaryData.dietaryChoice];
  return choices
    .filter((c: any) => c['#text'] === 'Yes')
    .map((c: any) => c['@_id'] || '');
}

function parseMenu(xmlContent: string, locationName: string, dateStr: string): MenuData | null {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  try {
    const parsed = parser.parse(xmlContent);
    const root = parsed.EatecExchange;
    if (!root || !root.menu) return null;

    const menuData: MenuData = {
      location: locationName,
      date: dateStr,
      meals: {},
    };

    const menus = Array.isArray(root.menu) ? root.menu : [root.menu];

    for (const menuEl of menus) {
      let mealPeriod: string = menuEl['@_mealperiodname'] || 'Unknown';
      // Normalize: "Spring - Lunch" -> "Lunch"
      if (mealPeriod.includes(' - ')) {
        mealPeriod = mealPeriod.split(' - ').pop()!;
      }

      const items: MenuItem[] = [];
      const recipes = menuEl.recipes?.recipe;
      if (!recipes) continue;

      const recipeList = Array.isArray(recipes) ? recipes : [recipes];

      for (const recipe of recipeList) {
        const name = recipe['@_shortName'] || recipe['@_description'] || 'Unknown Item';
        const category = recipe['@_category'] || 'General';
        const description = recipe['@_description'] || '';
        const allergens = parseAllergens(recipe.allergens);
        const dietaryChoices = parseDietaryChoices(recipe.dietaryChoices);

        items.push({ name, category, description, allergens, dietaryChoices });
      }

      for (const item of items) {
        item.dishType = classifyDish(item).dishType;
      }

      menuData.meals[mealPeriod] = items;
    }

    return menuData;
  } catch (e) {
    console.error(`Error parsing XML for ${locationName}:`, e);
    return null;
  }
}

async function fetchMenuForLocation(
  locationName: string,
  dateStr: string
): Promise<MenuData | null> {
  const filePrefix = LOCATIONS[locationName];
  if (!filePrefix) return null;

  const url = `${BASE_URL}${filePrefix}_${dateStr}.xml`;

  try {
    const response = await fetch(url, { next: { revalidate: 300 } }); // cache 5 min
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('text/html')) return null; // likely a 404 page

    const xmlText = await response.text();
    return parseMenu(xmlText, locationName, dateStr);
  } catch (e) {
    console.error(`Error fetching menu for ${locationName}:`, e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get('date');

  if (!date || !/^\d{8}$/.test(date)) {
    return NextResponse.json(
      { error: 'date parameter required in YYYYMMDD format' },
      { status: 400 }
    );
  }

  const location = searchParams.get('location');

  if (location) {
    if (!LOCATIONS[location]) {
      return NextResponse.json(
        { error: `Unknown location. Available: ${Object.keys(LOCATIONS).join(', ')}` },
        { status: 400 }
      );
    }
    const menu = await fetchMenuForLocation(location, date);
    return NextResponse.json({ menus: menu ? [menu] : [] });
  }

  // Fetch all locations in parallel
  const results = await Promise.all(
    Object.keys(LOCATIONS).map((loc) => fetchMenuForLocation(loc, date))
  );

  const menus = results.filter((m): m is MenuData => m !== null);
  return NextResponse.json({ menus });
}
