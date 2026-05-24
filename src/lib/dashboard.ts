import { getServerSupabase } from "@/lib/supabase";
import type { StreakRow, SummaryRow, FeedItemRow, ReflectionRow, SavedInsightRow } from "@/lib/types";
import { todayKey } from "@/lib/utils";

export interface DashboardData {
  totals: {
    summaries: number;
    saved: number;
    reflections: number;
    swipes: number;
  };
  xp: {
    total: number;
    today: number;
  };
  streak: {
    current: number;
    longest: number;
  };
  recentSummaries: SummaryRow[];
  recentSaved: SavedInsightRow[];
  recentReflections: ReflectionRow[];
  todaysUpgrade: SummaryRow | null;
  freshFeed: FeedItemRow[];
}

const EMPTY: DashboardData = {
  totals: { summaries: 0, saved: 0, reflections: 0, swipes: 0 },
  xp: { total: 0, today: 0 },
  streak: { current: 0, longest: 0 },
  recentSummaries: [],
  recentSaved: [],
  recentReflections: [],
  todaysUpgrade: null,
  freshFeed: [],
};

function computeStreak(rows: StreakRow[]): { current: number; longest: number } {
  if (!rows.length) return { current: 0, longest: 0 };
  const dates = new Set(rows.filter((r) => r.xp_earned > 0).map((r) => r.date));
  let longest = 0;
  let run = 0;
  const sorted = [...dates].sort();
  let prev: Date | null = null;
  for (const d of sorted) {
    const cur = new Date(d);
    if (prev && cur.getTime() - prev.getTime() === 86400000) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = cur;
  }
  let current = 0;
  const today = new Date(todayKey());
  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    if (dates.has(k)) current += 1;
    else break;
  }
  return { current, longest };
}

export async function getDashboardData(): Promise<DashboardData> {
  let supabase;
  try {
    supabase = getServerSupabase();
  } catch {
    return EMPTY;
  }
  try {
    const [summariesAll, summariesRecent, saved, reflections, streaks, feed, todaysUp] =
      await Promise.all([
        supabase.from("summaries").select("id", { count: "exact", head: true }),
        supabase.from("summaries").select("*").order("created_at", { ascending: false }).limit(6),
        supabase
          .from("saved_insights")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("daily_reflections")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("streaks")
          .select("*")
          .order("date", { ascending: true })
          .limit(365),
        supabase
          .from("generated_feeds")
          .select("*")
          .eq("consumed", false)
          .order("score", { ascending: false })
          .limit(8),
        supabase
          .from("summaries")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    const streakRows = (streaks.data || []) as StreakRow[];
    const today = todayKey();
    const todayRow = streakRows.find((r) => r.date === today);
    const totalXp = streakRows.reduce((acc, r) => acc + (r.xp_earned || 0), 0);
    const streak = computeStreak(streakRows);

    return {
      totals: {
        summaries: summariesAll.count || 0,
        saved: (saved.data?.length || 0) > 0 ? (saved.data?.length || 0) : 0,
        reflections: (reflections.data?.length || 0) > 0 ? (reflections.data?.length || 0) : 0,
        swipes: streakRows.reduce((a, r) => a + (r.swipes_count || 0), 0),
      },
      xp: { total: totalXp, today: todayRow?.xp_earned || 0 },
      streak,
      recentSummaries: (summariesRecent.data || []) as SummaryRow[],
      recentSaved: (saved.data || []) as SavedInsightRow[],
      recentReflections: (reflections.data || []) as ReflectionRow[],
      todaysUpgrade: ((todaysUp.data || [])[0] as SummaryRow) || null,
      freshFeed: (feed.data || []) as FeedItemRow[],
    };
  } catch {
    return EMPTY;
  }
}
