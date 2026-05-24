import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { decodeHtmlEntities } from "@/lib/utils";

export const runtime = "nodejs";

interface WatchlistItem {
  id: string;
  source_url: string;
  source_id: string | null;
  title: string;
  author: string | null;
  thumbnail: string | null;
  topics: string[];
  direction: "right" | "super";
  swiped_at: string;
  summarized: boolean;
  summary_id: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);

  try {
    const supabase = getServerSupabase();

    const { data: swipes, error } = await supabase
      .from("swipe_history")
      .select("id, feed_item_id, source_url, direction, topics, created_at")
      .in("direction", ["right", "super"])
      .order("created_at", { ascending: false })
      .limit(limit * 2);
    if (error) throw error;

    const seenUrls = new Set<string>();
    const dedupedSwipes = (swipes || []).filter((s) => {
      if (!s.source_url) return false;
      if (seenUrls.has(s.source_url)) return false;
      seenUrls.add(s.source_url);
      return true;
    });

    const feedIds = dedupedSwipes
      .map((s) => s.feed_item_id)
      .filter((x): x is string => Boolean(x));
    const feedById = new Map<
      string,
      {
        id: string;
        source_id: string | null;
        title: string;
        author: string | null;
        thumbnail: string | null;
        topics: string[];
      }
    >();
    if (feedIds.length > 0) {
      const { data: feedRows } = await supabase
        .from("generated_feeds")
        .select("id, source_id, title, author, thumbnail, topics")
        .in("id", feedIds);
      for (const r of feedRows || []) feedById.set(r.id, r);
    }

    const sourceUrls = dedupedSwipes.map((s) => s.source_url);
    const summarizedByUrl = new Map<string, string>();
    if (sourceUrls.length > 0) {
      const { data: summaries } = await supabase
        .from("summaries")
        .select("id, source_url")
        .in("source_url", sourceUrls);
      for (const r of summaries || []) {
        if (r.source_url) summarizedByUrl.set(r.source_url, r.id);
      }
    }

    const items: WatchlistItem[] = dedupedSwipes
      .slice(0, limit)
      .map((s) => {
        const feed = s.feed_item_id ? feedById.get(s.feed_item_id) : null;
        const summaryId = summarizedByUrl.get(s.source_url) || null;
        return {
          id: s.id,
          source_url: s.source_url,
          source_id: feed?.source_id ?? null,
          title: decodeHtmlEntities(feed?.title ?? s.source_url),
          author: feed?.author ? decodeHtmlEntities(feed.author) : null,
          thumbnail: feed?.thumbnail ?? null,
          topics: feed?.topics ?? s.topics ?? [],
          direction: s.direction as "right" | "super",
          swiped_at: s.created_at,
          summarized: Boolean(summaryId),
          summary_id: summaryId,
        };
      });

    return NextResponse.json({ data: items });
  } catch (e) {
    return NextResponse.json(
      { data: [], error: e instanceof Error ? e.message : "load failed" },
      { status: 200 },
    );
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    const supabase = getServerSupabase();
    await supabase.from("swipe_history").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "delete failed" },
      { status: 500 },
    );
  }
}
