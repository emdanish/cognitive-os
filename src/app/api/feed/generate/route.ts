import { NextResponse } from "next/server";
import Parser from "rss-parser";
import {
  CREATOR_SOURCES,
  TOPIC_SEARCHES,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  MIN_VIEW_COUNT,
  isLikelyFluff,
  type RawCandidate,
} from "@/lib/sources";
import {
  fetchVideoDetails,
  isYouTubeApiAvailable,
  searchYouTube,
} from "@/lib/youtube";
import { getServerSupabase } from "@/lib/supabase";
import { decodeHtmlEntities, todayKey } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOPIC_SEARCH_THRESHOLD = 25;
const MAX_INSERTS = 40;

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  id?: string;
  ["yt:videoId"]?: string;
}

const rssParser: Parser<unknown, RssItem> = new Parser({
  customFields: { item: ["yt:videoId"] },
});

async function fetchChannelRss(
  source: (typeof CREATOR_SOURCES)[number],
): Promise<RawCandidate[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      headers: { "User-Agent": "Mozilla/5.0 CognitiveOS/1.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const feed = await rssParser.parseString(xml);
    return ((feed.items as RssItem[]) || []).slice(0, 6).map((item) => {
      const videoId =
        item["yt:videoId"] ||
        item.id?.replace("yt:video:", "") ||
        item.link?.split("v=")[1]?.split("&")[0] ||
        "";
      return {
        source_type: "youtube" as const,
        source_url: item.link || `https://youtube.com/watch?v=${videoId}`,
        source_id: videoId,
        title: item.title || "Untitled",
        author: source.name,
        thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "",
        description: item.contentSnippet || "",
        published: item.isoDate || item.pubDate || null,
        topics: source.topics,
      } satisfies RawCandidate;
    });
  } catch {
    return [];
  }
}

async function fetchTopicCandidates(): Promise<RawCandidate[]> {
  if (!isYouTubeApiAvailable()) return [];
  const results = await Promise.all(
    TOPIC_SEARCHES.map(async (t) => {
      const hits = await searchYouTube({
        query: t.query,
        maxResults: 25,
        videoDuration: "medium",
        videoCaption: "closedCaption",
        order: "relevance",
      });
      return hits.map<RawCandidate>((h) => ({
        source_type: "youtube",
        source_url: `https://www.youtube.com/watch?v=${h.videoId}`,
        source_id: h.videoId,
        title: h.title,
        author: h.channelTitle,
        thumbnail: h.thumbnail,
        description: h.description,
        published: h.publishedAt || null,
        topics: t.topics,
      }));
    }),
  );
  return results.flat();
}

interface ScoredCandidate extends RawCandidate {
  score: number;
}

function scoreCandidate(
  c: RawCandidate,
  prefs: Record<string, number>,
): number {
  if (isLikelyFluff(c.title)) return 0;

  let s = 50;
  for (const t of c.topics) {
    s += Math.max(-15, Math.min(40, prefs[t] || 0));
  }

  if (c.published) {
    const ageDays = (Date.now() - new Date(c.published).getTime()) / 86400000;
    if (ageDays < 2) s += 18;
    else if (ageDays < 7) s += 12;
    else if (ageDays < 30) s += 6;
    else if (ageDays < 90) s += 1;
    else if (ageDays < 365) s -= 4;
    else s -= 10;
  }

  if (c.view_count !== undefined && c.view_count > 0) {
    const log = Math.log10(c.view_count);
    if (log >= 6) s += 12;
    else if (log >= 5) s += 8;
    else if (log >= 4) s += 5;
    else if (log >= 3) s += 1;
    else s -= 6;
  }

  if (c.has_captions) s += 8;
  else if (c.has_captions === false) s -= 4;

  if (
    c.duration_seconds !== undefined &&
    c.duration_seconds >= 480 &&
    c.duration_seconds <= 1800
  ) {
    s += 4;
  }

  if (c.title.length > 110) s -= 4;

  return Math.max(0, Math.min(100, Math.round(s)));
}

function deduplicateBySourceId(items: RawCandidate[]): RawCandidate[] {
  const seen = new Set<string>();
  const out: RawCandidate[] = [];
  for (const c of items) {
    if (!c.source_id || seen.has(c.source_id)) continue;
    seen.add(c.source_id);
    out.push(c);
  }
  return out;
}

export async function POST() {
  let supabase;
  let prefMap: Record<string, number> = {};
  let alreadyKnown = new Set<string>();
  let unconsumedCount = 0;

  try {
    supabase = getServerSupabase();
    const [prefsRes, seenRes, unconsumedRes] = await Promise.all([
      supabase.from("user_preferences").select("topic, weight"),
      supabase
        .from("generated_feeds")
        .select("source_id")
        .order("created_at", { ascending: false })
        .limit(800),
      supabase
        .from("generated_feeds")
        .select("id", { count: "exact", head: true })
        .eq("consumed", false),
    ]);
    prefMap = Object.fromEntries(
      (prefsRes.data || []).map((p) => [p.topic, p.weight || 0]),
    );
    alreadyKnown = new Set(
      (seenRes.data || []).map((r) => r.source_id).filter(Boolean) as string[],
    );
    unconsumedCount = unconsumedRes.count || 0;
  } catch {
    /* DB unavailable — continue ephemeral */
  }

  const rssCandidates = (
    await Promise.all(CREATOR_SOURCES.map(fetchChannelRss))
  ).flat();

  const needsTopicSearch =
    isYouTubeApiAvailable() && unconsumedCount < TOPIC_SEARCH_THRESHOLD;

  const topicCandidates = needsTopicSearch ? await fetchTopicCandidates() : [];

  const fresh = deduplicateBySourceId([...rssCandidates, ...topicCandidates])
    .filter((c) => c.source_id && !alreadyKnown.has(c.source_id))
    .slice(0, 120);

  if (isYouTubeApiAvailable() && fresh.length > 0) {
    const details = await fetchVideoDetails(fresh.map((c) => c.source_id));
    const detailById = new Map(details.map((d) => [d.id, d]));
    for (const c of fresh) {
      const d = detailById.get(c.source_id);
      if (d) {
        c.duration_seconds = d.durationSeconds;
        c.view_count = d.viewCount;
        c.has_captions = d.hasCaptions;
        if (!c.published && d.publishedAt) c.published = d.publishedAt;
        if (!c.thumbnail && d.thumbnail) c.thumbnail = d.thumbnail;
        if (!c.description && d.description) {
          c.description = d.description.slice(0, 280);
        }
        if ((!c.author || c.author === "") && d.channelTitle) {
          c.author = d.channelTitle;
        }
      }
    }
  }

  const youtubeApi = isYouTubeApiAvailable();
  let droppedDuration = 0;
  let droppedViews = 0;

  const filtered = fresh.filter((c) => {
    if (c.duration_seconds !== undefined) {
      if (
        c.duration_seconds < MIN_DURATION_SECONDS ||
        c.duration_seconds > MAX_DURATION_SECONDS
      ) {
        droppedDuration++;
        return false;
      }
    }
    // Hard view-count floor — only enforced when we have a real number to check
    // against (i.e. YouTube API enriched it). Without the API we keep candidates
    // rather than empty the feed.
    if (youtubeApi && MIN_VIEW_COUNT > 0) {
      if (c.view_count === undefined || c.view_count < MIN_VIEW_COUNT) {
        droppedViews++;
        return false;
      }
    }
    return true;
  });

  const scored: ScoredCandidate[] = filtered
    .map((c) => ({ ...c, score: scoreCandidate(c, prefMap) }))
    .filter((c) => c.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INSERTS);

  if (!supabase || scored.length === 0) {
    return NextResponse.json({
      data: scored.map((c, i) => ({
        id: `local-${i}-${c.source_id}`,
        ...c,
        consumed: false,
        generated_for: todayKey(),
        created_at: new Date().toISOString(),
      })),
      meta: {
        rss_candidates: rssCandidates.length,
        topic_candidates: topicCandidates.length,
        accepted: scored.length,
        dropped_duration: droppedDuration,
        dropped_low_views: droppedViews,
        min_view_count: youtubeApi ? MIN_VIEW_COUNT : 0,
        topic_search_used: needsTopicSearch,
        youtube_api: youtubeApi,
      },
    });
  }

  try {
    const today = todayKey();
    const { data: inserted, error } = await supabase
      .from("generated_feeds")
      .insert(
        scored.map((c) => ({
          source_type: c.source_type,
          source_url: c.source_url,
          source_id: c.source_id,
          title: c.title,
          author: c.author,
          thumbnail: c.thumbnail,
          description: c.description,
          topics: c.topics,
          score: c.score,
          generated_for: today,
          consumed: false,
        })),
      )
      .select("*");
    if (error) throw error;

    const { data: full } = await supabase
      .from("generated_feeds")
      .select("*")
      .eq("consumed", false)
      .order("score", { ascending: false })
      .limit(60);

    const rows = (full || inserted || []).map((r) => ({
      ...r,
      title: decodeHtmlEntities(r.title ?? ""),
      author: r.author ? decodeHtmlEntities(r.author) : r.author,
      description: r.description ? decodeHtmlEntities(r.description) : r.description,
    }));

    return NextResponse.json({
      data: rows,
      meta: {
        rss_candidates: rssCandidates.length,
        topic_candidates: topicCandidates.length,
        accepted: (inserted || []).length,
        dropped_duration: droppedDuration,
        dropped_low_views: droppedViews,
        min_view_count: youtubeApi ? MIN_VIEW_COUNT : 0,
        topic_search_used: needsTopicSearch,
        youtube_api: youtubeApi,
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        data: scored.map((c, i) => ({
          id: `local-${i}-${c.source_id}`,
          ...c,
          consumed: false,
          generated_for: todayKey(),
          created_at: new Date().toISOString(),
        })),
        error: e instanceof Error ? e.message : "DB insert failed",
      },
      { status: 200 },
    );
  }
}
