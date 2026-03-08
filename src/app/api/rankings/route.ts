import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * Verify Supabase Auth token from Authorization header.
 * Returns the authenticated user's ID or null.
 */
async function getAuthUserId(request: Request): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// GET /api/rankings — fetch user's rankings from Supabase
export async function GET(request: Request) {
  const db = getSupabase();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const userId = await getAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Get rankings
  const { data: rankings } = await db
    .from('rankings')
    .select('dish_name, rating')
    .eq('user_id', userId);

  const rankingsMap: Record<string, number> = {};
  if (rankings) {
    for (const r of rankings) {
      rankingsMap[r.dish_name] = r.rating;
    }
  }

  // Get ignored categories
  const { data: ignored } = await db
    .from('ignored_categories')
    .select('category')
    .eq('user_id', userId);

  const ignoredList = ignored ? ignored.map((i: any) => i.category) : [];

  return NextResponse.json({ rankings: rankingsMap, ignored_categories: ignoredList });
}

// POST /api/rankings — sync rankings to Supabase
export async function POST(request: Request) {
  const db = getSupabase();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const userId = await getAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { rankings, ignored_categories } = body as {
    rankings: Record<string, number>;
    ignored_categories: string[];
  };

  // Upsert rankings
  if (rankings && Object.keys(rankings).length > 0) {
    const rows = Object.entries(rankings).map(([dish_name, rating]) => ({
      user_id: userId,
      dish_name,
      rating,
    }));

    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await db
        .from('rankings')
        .upsert(chunk, { onConflict: 'user_id,dish_name' });

      if (error) {
        console.error('Error upserting rankings:', error);
      }
    }
  }

  // Replace ignored categories
  if (ignored_categories !== undefined) {
    // Delete existing
    await db
      .from('ignored_categories')
      .delete()
      .eq('user_id', userId);

    // Insert new
    if (ignored_categories.length > 0) {
      const catRows = ignored_categories.map((category: string) => ({
        user_id: userId,
        category,
      }));
      await db.from('ignored_categories').insert(catRows);
    }
  }

  return NextResponse.json({ success: true });
}
