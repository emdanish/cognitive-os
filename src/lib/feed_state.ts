import { getServerSupabase } from "@/lib/supabase";
import { type TopicSearch } from "@/lib/sources";

export interface FeedSearchStateRow {
  query: string;
  order_kind: "relevance" | "viewCount" | "date";
  page_token: string | null;
  last_used_at: string;
  exhausted_at: string | null;
  yield_count: number;
}

export async function loadSearchState(queries: string[]): Promise<FeedSearchStateRow[]> {
  if (queries.length === 0) return [];
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("feed_search_state")
      .select("*")
      .in("query", queries);
    if (error || !data) return [];
    return data as FeedSearchStateRow[];
  } catch {
    return [];
  }
}

export async function saveSearchState(
  query: string,
  order: "relevance" | "viewCount" | "date",
  pageToken: string | null,
  yieldCount: number,
) {
  try {
    const supabase = getServerSupabase();
    const now = new Date().toISOString();
    const exhaustedAt = pageToken === null ? now : null;

    const { error } = await supabase
      .from("feed_search_state")
      .upsert(
        {
          query,
          order_kind: order,
          page_token: pageToken,
          last_used_at: now,
          exhausted_at: exhaustedAt,
          yield_count: yieldCount,
        },
        {
          onConflict: "query,order_kind",
        },
      );
    if (error) {
      console.error("saveSearchState error:", error.message);
    }
  } catch (err) {
    console.error("saveSearchState catch error:", err);
  }
}

export function getQuerySearchState(
  query: string,
  allRows: FeedSearchStateRow[],
): { order: "relevance" | "viewCount" | "date"; pageToken: string | null } {
  const rows = allRows.filter((r) => r.query === query);
  if (rows.length === 0) {
    return { order: "relevance", pageToken: null };
  }

  // Sort by last_used_at descending to find the most recently used row
  const sorted = [...rows].sort(
    (a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime(),
  );
  const lastUsed = sorted[0];

  // If the last used search has an active page token and is not exhausted, we continue paginating it
  const isExhausted =
    lastUsed.exhausted_at &&
    Date.now() - new Date(lastUsed.exhausted_at).getTime() < 7 * 86400000;
  if (lastUsed.page_token && !isExhausted) {
    return {
      order: lastUsed.order_kind,
      pageToken: lastUsed.page_token,
    };
  }

  // Otherwise, cycle to the next order kind
  const cycle: Array<"relevance" | "viewCount" | "date"> = ["relevance", "viewCount", "date"];
  const startIndex = cycle.indexOf(lastUsed.order_kind);

  for (let i = 1; i <= 3; i++) {
    const nextOrder = cycle[(startIndex + i) % 3];
    const match = rows.find((r) => r.order_kind === nextOrder);
    const matchExhausted =
      match?.exhausted_at &&
      Date.now() - new Date(match.exhausted_at).getTime() < 7 * 86400000;
    if (!matchExhausted) {
      return {
        order: nextOrder,
        pageToken: match?.page_token || null,
      };
    }
  }

  // If all are exhausted, default to relevance with null pageToken
  return { order: "relevance", pageToken: null };
}

export function pickQueries(
  searchStates: FeedSearchStateRow[],
  allQueries: TopicSearch[],
  count: number = 5,
): TopicSearch[] {
  const now = Date.now();
  const candidates = allQueries.map((q) => {
    const rows = searchStates.filter((r) => r.query === q.query);
    if (rows.length === 0) {
      return { query: q, weight: 1.0 };
    }

    const sorted = [...rows].sort(
      (a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime(),
    );
    const latest = sorted[0];

    const daysSinceLastUsed = (now - new Date(latest.last_used_at).getTime()) / (24 * 3600 * 1000);
    const yieldCount = latest.yield_count || 0;

    const recencyWeight = 1 / (1 + daysSinceLastUsed);
    const yieldWeight = 1 + Math.min(yieldCount, 20) / 20;
    const weight = recencyWeight * yieldWeight;

    return { query: q, weight };
  });

  const selected: TopicSearch[] = [];
  const pool = [...candidates];

  for (let step = 0; step < count; step++) {
    if (pool.length === 0) break;
    const totalWeight = pool.reduce((acc, c) => acc + c.weight, 0);
    if (totalWeight <= 0) {
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool[idx].query);
      pool.splice(idx, 1);
      continue;
    }

    let r = Math.random() * totalWeight;
    let index = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) {
        index = i;
        break;
      }
    }

    selected.push(pool[index].query);
    pool.splice(index, 1);
  }

  return selected;
}
