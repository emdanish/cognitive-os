import { NextResponse } from "next/server";
import { loadSearchState, saveSearchState, getQuerySearchState, pickQueries } from "@/lib/feed_state";
import {
  getOrResolveCreator,
  fetchUploadsPlaylist,
  type ResolvedCreator,
} from "@/lib/creators";
import {
  CREATOR_SOURCES,
  TOPIC_SEARCHES,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  MIN_VIEW_COUNT,
  isLikelyFluff,
  type RawCandidate,
  type TopicSearch,
} from "@/lib/sources";
import {
  fetchVideoDetails,
  isYouTubeApiAvailable,
  searchYouTube,
} from "@/lib/youtube";
import { getServerSupabase } from "@/lib/supabase";
import { decodeHtmlEntities, todayKey, extractYouTubeId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPIC_SEARCH_THRESHOLD = 30;
const MAX_INSERTS = 40;

async function fetchCreatorCandidates(
  noStore?: boolean,
): Promise<{
  candidates: RawCandidate[];
  creatorsResolved: number;
  resolutionFailures: Array<{ handle: string; error: string }>;
}> {
  if (!isYouTubeApiAvailable()) {
    return { candidates: [], creatorsResolved: 0, resolutionFailures: [] };
  }
  const resolutionFailures: Array<{ handle: string; error: string }> = [];
  const resolved = await Promise.all(
    CREATOR_SOURCES.map(async (s) => {
      const r = await getOrResolveCreator(s.handle, s.name, noStore);
      if (!r) {
        resolutionFailures.push({ handle: s.handle, error: "resolution_failed" });
        return null;
      }
      return { source: s, resolved: r };
    }),
  );
  const valid = resolved.filter(
    (x): x is { source: (typeof CREATOR_SOURCES)[number]; resolved: ResolvedCreator } => x !== null,
  );
  const allVideos = await Promise.all(
    valid.map(async ({ source, resolved }) => {
      const videos = await fetchUploadsPlaylist(
        resolved.uploadsPlaylistId,
        50,
        noStore,
      );
      const uploadsCandidates = videos.map<RawCandidate>((v) => ({
        source_type: "youtube",
        source_url: `https://www.youtube.com/watch?v=${v.videoId}`,
        source_id: v.videoId,
        title: v.title,
        author: source.name,
        thumbnail: v.thumbnail,
        description: v.description,
        published: v.publishedAt || null,
        topics: source.topics,
      }));

      const topCandidates = (resolved.topVideoIds || []).map<RawCandidate>((vid) => ({
        source_type: "youtube",
        source_url: `https://www.youtube.com/watch?v=${vid}`,
        source_id: vid,
        title: "",
        author: source.name,
        thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        description: "",
        published: null,
        topics: source.topics,
      }));

      const combined = [...uploadsCandidates, ...topCandidates];
      const seen = new Set<string>();
      const unique: RawCandidate[] = [];
      for (const c of combined) {
        if (!c.source_id || seen.has(c.source_id)) continue;
        seen.add(c.source_id);
        unique.push(c);
      }
      return unique;
    }),
  );
  return {
    candidates: allVideos.flat(),
    creatorsResolved: valid.length,
    resolutionFailures,
  };
}

async function fetchTopicCandidates(
  queries: TopicSearch[],
  noStore?: boolean,
): Promise<{ candidates: RawCandidate[]; pageTokensAdvanced: number }> {
  if (!isYouTubeApiAvailable()) return { candidates: [], pageTokensAdvanced: 0 };

  const QUERY_SUFFIXES = [
    "framework",
    "masterclass",
    "lessons",
    "mindset",
    "blueprint",
    "guide",
    "strategy",
    "habits",
    "system",
  ];

  const queryStrings = queries.map((q) => q.query);
  const searchStates = await loadSearchState(queryStrings);

  const results = await Promise.all(
    queries.map(async (t) => {
      const { order, pageToken: savedPageToken } = getQuerySearchState(t.query, searchStates);
      const pageToken = Math.random() < 0.25 ? null : savedPageToken;
      const duration: "medium" | "long" = Math.random() < 0.5 ? "medium" : "long";

      // Append random suffix to vary search results sometimes
      const useSuffix = Math.random() < 0.25;
      const suffix = useSuffix
        ? QUERY_SUFFIXES[Math.floor(Math.random() * QUERY_SUFFIXES.length)]
        : "";
      const finalQuery = suffix ? `${t.query} ${suffix}` : t.query;

      const { items, nextPageToken } = await searchYouTube({
        query: finalQuery,
        maxResults: 50,
        videoDuration: duration,
        videoCaption: "closedCaption",
        order: order,
        noStore: noStore,
        pageToken: pageToken || undefined,
      });

      await saveSearchState(t.query, order, nextPageToken, items.length);

      const candidates = items.map<RawCandidate>((h) => ({
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

      return { candidates, pageTokenUsed: Boolean(pageToken) };
    }),
  );

  const candidates = results.flatMap((r) => r.candidates);
  const pageTokensAdvanced = results.filter((r) => r.pageTokenUsed).length;
  return { candidates, pageTokensAdvanced };
}

async function fetchFallbackCandidates(
  queries: TopicSearch[],
  noStore?: boolean,
): Promise<{ candidates: RawCandidate[]; pageTokensAdvanced: number }> {
  if (!isYouTubeApiAvailable()) return { candidates: [], pageTokensAdvanced: 0 };

  const QUERY_SUFFIXES = [
    "framework",
    "masterclass",
    "lessons",
    "mindset",
    "blueprint",
    "guide",
    "strategy",
  ];

  const queryStrings = queries.map((q) => q.query);
  const searchStates = await loadSearchState(queryStrings);

  const results = await Promise.all(
    queries.map(async (t) => {
      const useSuffix = Math.random() < 0.25;
      const suffix = useSuffix
        ? QUERY_SUFFIXES[Math.floor(Math.random() * QUERY_SUFFIXES.length)]
        : "";
      const finalQuery = suffix ? `${t.query} ${suffix}` : t.query;

      const { order, pageToken: savedPageToken } = getQuerySearchState(t.query, searchStates);
      const pageToken = Math.random() < 0.25 ? null : savedPageToken;
      const duration: "medium" | "long" = Math.random() < 0.5 ? "medium" : "long";

      const { items, nextPageToken } = await searchYouTube({
        query: finalQuery,
        maxResults: 50,
        videoDuration: duration,
        videoCaption: "closedCaption",
        order: order,
        noStore: noStore,
        pageToken: pageToken || undefined,
      });

      await saveSearchState(t.query, order, nextPageToken, items.length);

      const candidates = items.map<RawCandidate>((h) => ({
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

      return { candidates, pageTokenUsed: Boolean(pageToken) };
    }),
  );

  const candidates = results.flatMap((r) => r.candidates);
  const pageTokensAdvanced = results.filter((r) => r.pageTokenUsed).length;
  return { candidates, pageTokensAdvanced };
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
  // Topic preferences weights
  for (const t of c.topics) {
    s += Math.max(-20, Math.min(40, prefs[t] || 0));
  }

  // Freshness weight
  if (c.published) {
    const ageDays = (Date.now() - new Date(c.published).getTime()) / 86400000;
    if (ageDays < 7) s += 18;      // very fresh
    else if (ageDays < 30) s += 10; // recent
    else if (ageDays < 90) s += 3;
    else if (ageDays < 365) s -= 5;
    else s -= 12;
  }

  // Engagement views weight (log scale)
  if (c.view_count !== undefined && c.view_count > 0) {
    const logViews = Math.log10(c.view_count);
    s += Math.round(logViews * 4);
  }

  if (c.has_captions) s += 6;

  if (
    c.duration_seconds !== undefined &&
    c.duration_seconds >= 180 &&
    c.duration_seconds <= 3600
  ) {
    s += 4;
  }

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

function calculateTitleSimilarity(t1: string, t2: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  const w1 = new Set(normalize(t1));
  const w2 = new Set(normalize(t2));
  if (w1.size === 0 && w2.size === 0) return 0;
  
  const intersection = new Set([...w1].filter((x) => w2.has(x)));
  const union = new Set([...w1, ...w2]);
  return intersection.size / union.size;
}

export async function POST(req: Request) {
  (globalThis as any).quotaExhausted = false;
  (globalThis as any).hasLoggedQuota = false;
  (globalThis as any).pipedFallbackUsed = false;
  (globalThis as any).pipedLastInstance = null;
  (globalThis as any).invidiousFallbackUsed = false;
  (globalThis as any).invidiousLastInstance = null;
  let noStore = true;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.noStore === false) {
      noStore = false;
    }
  } catch {}

  let supabase;
  let prefMap: Record<string, number> = {};
  let alreadyKnown = new Set<string>();
  let unconsumedCount = 0;
  let recentTitles: string[] = [];
  let pageTokensAdvanced = 0;
  let shortsBlocked = 0;
  const relaxationApplied = false;

  try {
    supabase = getServerSupabase();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    
    // Load preferences, history, and unconsumed list
    const [prefsRes, seenRes, unconsumedRes, recentSwipesRes, activeFeedsRes] = await Promise.all([
      supabase.from("user_preferences").select("topic, weight"),
      supabase
        .from("generated_feeds")
        .select("source_id")
        .or(`consumed.eq.true,created_at.gt.${thirtyDaysAgo}`),
      supabase
        .from("generated_feeds")
        .select("id", { count: "exact", head: true })
        .eq("consumed", false),
      supabase
        .from("swipe_history")
        .select("source_url")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("generated_feeds")
        .select("title")
        .eq("consumed", false)
        .limit(200),
    ]);

    prefMap = Object.fromEntries(
      (prefsRes.data || []).map((p) => [p.topic, p.weight || 0]),
    );

    // Build the already known set from swipes + seen DB rows
    const swipedSourceIds = new Set(
      (recentSwipesRes.data || [])
        .map((s) => extractYouTubeId(s.source_url))
        .filter(Boolean) as string[]
    );
    const seenSourceIds = (seenRes.data || []).map((r) => r.source_id).filter(Boolean) as string[];

    alreadyKnown = new Set([...swipedSourceIds, ...seenSourceIds]);
    unconsumedCount = unconsumedRes.count || 0;
    
    recentTitles = [
      ...(activeFeedsRes.data || []).map((f) => f.title),
    ].filter(Boolean) as string[];

  } catch {
    /* DB unavailable — continue ephemeral */
  }

  const creatorRes = await fetchCreatorCandidates(noStore);
  const rssCandidates = creatorRes.candidates;
  const creatorsResolved = creatorRes.creatorsResolved;
  const creatorResolutionFailures = creatorRes.resolutionFailures;

  const userTriggered = noStore === true;
  const needsTopicSearch =
    isYouTubeApiAvailable() && (userTriggered || unconsumedCount < TOPIC_SEARCH_THRESHOLD);

  let topicCandidates: RawCandidate[] = [];
  let queriesUsed: string[] = [];
  if (needsTopicSearch) {
    let picked: TopicSearch[] = [];
    if (supabase) {
      const allSearchStates = await loadSearchState(TOPIC_SEARCHES.map(ts => ts.query));
      picked = pickQueries(allSearchStates, TOPIC_SEARCHES, 8);
    } else {
      picked = pickQueries([], TOPIC_SEARCHES, 8);
    }
    queriesUsed = picked.map((q) => q.query);
    const topicRes = await fetchTopicCandidates(picked, noStore);
    topicCandidates = topicRes.candidates;
    pageTokensAdvanced += topicRes.pageTokensAdvanced;
  }

  const fresh = deduplicateBySourceId([...rssCandidates, ...topicCandidates])
    .filter((c) => {
      if (!c.source_url) return false;
      const url = c.source_url.toLowerCase();
      if (url.includes("/shorts/")) {
        shortsBlocked++;
        return false;
      }
      return true;
    })
    .filter((c) => c.source_id && !alreadyKnown.has(c.source_id))
    .slice(0, 120);

  const youtubeApi = isYouTubeApiAvailable();
  if (youtubeApi && fresh.length > 0) {
    const details = await fetchVideoDetails(fresh.map((c) => c.source_id), noStore);
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
        if ((!c.title || c.title === "") && d.title) {
          c.title = d.title;
        }
      }
    }
  }

  // Jaccard similarity filter against recent generated titles
  // Checked AFTER enrichment so that top video candidates (whose titles were empty) are also verified!
  const similarityFiltered = fresh.filter((c) => {
    if (!c.title) return true;
    for (const t of recentTitles) {
      if (calculateTitleSimilarity(c.title, t) > 0.78) {
        return false;
      }
    }
    return true;
  });

  let droppedDuration = 0;
  let droppedViews = 0;

  // Diversity Balancing & Multi-Pass Scoring Helper
  let scored: ScoredCandidate[] = [];
  const creatorCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};

  const processCandidates = (
    candidates: RawCandidate[],
    viewFloor: number,
    scoreFloor: number,
    checkCreatorLimit: boolean = true,
    checkTopicDiversity: boolean = true,
  ) => {
    const filteredCandidates = candidates.filter((c) => {
      if (c.duration_seconds === undefined) {
        droppedDuration++;
        shortsBlocked++;
        return false;
      }
      if (
        c.duration_seconds < MIN_DURATION_SECONDS ||
        c.duration_seconds > MAX_DURATION_SECONDS
      ) {
        droppedDuration++;
        if (c.duration_seconds < MIN_DURATION_SECONDS) {
          shortsBlocked++;
        }
        return false;
      }
      if (youtubeApi) {
        if (c.view_count === undefined || c.view_count < 1_000_000) {
          droppedViews++;
          return false;
        }
      }
      return true;
    });

    const sorted = filteredCandidates
      .map((c) => ({ ...c, score: scoreCandidate(c, prefMap) }))
      .sort((a, b) => b.score - a.score);

    for (const c of sorted) {
      if (scored.length >= MAX_INSERTS) break;
      if (c.score < scoreFloor) continue;

      // Avoid inserting duplicates of already added source_ids in scored
      if (scored.some((existing) => existing.source_id === c.source_id)) continue;

      const creatorKey = c.author || "unknown";
      const currentCreatorCount = creatorCounts[creatorKey] || 0;
      const maxCreatorCount = checkCreatorLimit ? 3 : 5;
      if (currentCreatorCount >= maxCreatorCount) continue;

      let skipTopicCap = false;
      for (const t of c.topics) {
        const currentTopicCount = topicCounts[t] || 0;
        if (currentTopicCount >= 8) {
          skipTopicCap = true;
          break;
        }
      }
      if (skipTopicCap) continue;

      if (checkTopicDiversity) {
        let skipTopic = false;
        for (const t of c.topics) {
          const currentTopicCount = topicCounts[t] || 0;
          if (scored.length > 4 && currentTopicCount / scored.length > 0.25) {
            skipTopic = true;
            break;
          }
        }
        if (skipTopic) continue;
      }

      scored.push(c);
      creatorCounts[creatorKey] = currentCreatorCount + 1;
      for (const t of c.topics) {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      }
    }
  };

  // PASS 1: Strict Constraints (1M views, 25 score floor, check diversity & creator limit)
  processCandidates(similarityFiltered, 1_000_000, 25, true, true);

  // PASS 2: Relax constraints slightly (1M views, 15 score floor, check diversity & creator limit)
  if (scored.length < 15) {
    processCandidates(similarityFiltered, 1_000_000, 15, true, true);
  }

  // PASS 3: Relax further (1M views, 0 score floor, check creator limit, NO topic diversity check)
  if (scored.length < 15) {
    processCandidates(similarityFiltered, 1_000_000, 0, true, false);
  }

  // Dynamic Score Floor Fallback (uses random queries with NO date restriction)
  if (scored.length < 10 && youtubeApi) {
    const fallbackQueries = [...TOPIC_SEARCHES]
      .sort(() => 0.5 - Math.random())
      .slice(0, 4);
    queriesUsed = [...queriesUsed, ...fallbackQueries.map((q) => q.query)];
    const fallbackRes = await fetchFallbackCandidates(fallbackQueries, noStore);
    const fallbackCandidates = fallbackRes.candidates;
    pageTokensAdvanced += fallbackRes.pageTokensAdvanced;
    const freshFallback = deduplicateBySourceId(fallbackCandidates)
      .filter((c) => {
        if (!c.source_url) return false;
        const url = c.source_url.toLowerCase();
        if (url.includes("/shorts/")) {
          shortsBlocked++;
          return false;
        }
        return true;
      })
      .filter((c) => c.source_id && !alreadyKnown.has(c.source_id))
      .filter((c) => {
        for (const t of recentTitles) {
          if (calculateTitleSimilarity(c.title, t) > 0.78) {
            return false;
          }
        }
        return true;
      })
      .slice(0, 120);

    if (freshFallback.length > 0) {
      const details = await fetchVideoDetails(freshFallback.map((c) => c.source_id), noStore);
      const detailById = new Map(details.map((d) => [d.id, d]));
      for (const c of freshFallback) {
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

      // Fallback pass: strict 1M view count, loosen score and diversity
      processCandidates(freshFallback, 1_000_000, 0, true, false);
    }
  }

  // Stage counters for observability
  let count_rss_raw = rssCandidates.length;
  let count_topic_raw = topicCandidates.length;
  let count_after_dedup = fresh.length;
  let count_after_duration = 0;
  let count_after_views = 0;
  let count_after_fluff = 0;
  let count_after_diversity = 0;
  let count_scored_passing = 0;

  // 1. Duration check
  const durationPassed = fresh.filter((c) => {
    if (c.duration_seconds === undefined) return false;
    return c.duration_seconds >= MIN_DURATION_SECONDS && c.duration_seconds <= MAX_DURATION_SECONDS;
  });
  count_after_duration = durationPassed.length;

  // 2. Views check
  const viewsPassed = durationPassed.filter((c) => {
    if (!youtubeApi) return true;
    return c.view_count !== undefined && c.view_count >= 1_000_000;
  });
  count_after_views = viewsPassed.length;

  // 3. Fluff check
  const fluffPassed = viewsPassed.filter((c) => !isLikelyFluff(c.title));
  count_after_fluff = fluffPassed.length;

  // 4. Diversity & Scored Passing Simulation (simulates Pass 1)
  const simScored: RawCandidate[] = [];
  const simCreatorCounts: Record<string, number> = {};
  const simTopicCounts: Record<string, number> = {};
  let diversityPassedCount = 0;
  let scoredPassingCount = 0;

  const sortedSim = fluffPassed
    .map((c) => ({ ...c, score: scoreCandidate(c, prefMap) }))
    .sort((a, b) => b.score - a.score);

  for (const c of sortedSim) {
    // Check creator limit (max 3)
    const creatorKey = c.author || "unknown";
    const currentCreatorCount = simCreatorCounts[creatorKey] || 0;
    if (currentCreatorCount >= 3) continue;

    // Check topic cap (max 8)
    let skipTopicCap = false;
    for (const t of c.topics) {
      if ((simTopicCounts[t] || 0) >= 8) {
        skipTopicCap = true;
        break;
      }
    }
    if (skipTopicCap) continue;

    // Check topic diversity ratio (max 25% if scored.length > 4)
    let skipTopicDiversity = false;
    for (const t of c.topics) {
      if (simScored.length > 4 && (simTopicCounts[t] || 0) / simScored.length > 0.25) {
        skipTopicDiversity = true;
        break;
      }
    }
    if (skipTopicDiversity) continue;

    diversityPassedCount++;

    if (c.score >= 25) {
      scoredPassingCount++;
      simScored.push(c);
      simCreatorCounts[creatorKey] = currentCreatorCount + 1;
      for (const t of c.topics) {
        simTopicCounts[t] = (simTopicCounts[t] || 0) + 1;
      }
    }
  }

  count_after_diversity = diversityPassedCount;
  count_scored_passing = scoredPassingCount;

  const stages = {
    rss_raw: count_rss_raw,
    topic_raw: count_topic_raw,
    after_dedup: count_after_dedup,
    after_duration: count_after_duration,
    after_views: count_after_views,
    after_fluff: count_after_fluff,
    after_diversity: count_after_diversity,
    scored_passing: count_scored_passing,
  };

  const funnel_summary = {
    creators_total: CREATOR_SOURCES.length,
    creators_resolved: creatorsResolved,
    creator_resolution_failures: creatorResolutionFailures,
    rss_candidates_raw: rssCandidates.length,
    topic_queries_pulled: queriesUsed.length,
    topic_candidates_raw: topicCandidates.length,
    fresh_after_dedup: fresh.length,
    scored_inserted: scored.length,
    quota_exhausted: Boolean((globalThis as any).quotaExhausted),
    fallback_used: Boolean((globalThis as any).pipedFallbackUsed) || Boolean((globalThis as any).invidiousFallbackUsed),
    fallback_provider: (globalThis as any).pipedFallbackUsed ? "piped" : ((globalThis as any).invidiousFallbackUsed ? "invidious" : null),
    fallback_instance: (globalThis as any).pipedLastInstance || (globalThis as any).invidiousLastInstance || null,
    invidious_used: Boolean((globalThis as any).invidiousFallbackUsed),
    invidious_instance: (globalThis as any).invidiousLastInstance || null,
  };

  let recycledCount = 0;
  if (supabase && scored.length === 0 && unconsumedCount < 10) {
    try {
      const { data: consumedFallback } = await supabase
        .from("generated_feeds")
        .select("id")
        .eq("consumed", true)
        .order("created_at", { ascending: false })
        .limit(30);

      if (consumedFallback && consumedFallback.length > 0) {
        const idsToRecycle = consumedFallback.map((r) => r.id);
        const { error: recycleError } = await supabase
          .from("generated_feeds")
          .update({ consumed: false })
          .in("id", idsToRecycle);

        if (!recycleError) {
          recycledCount = idsToRecycle.length;
        }

        // Re-fetch count to reflect recycled cards
        const { count: refetchedCount } = await supabase
          .from("generated_feeds")
          .select("id", { count: "exact", head: true })
          .eq("consumed", false);
        if (refetchedCount !== null) {
          unconsumedCount = refetchedCount;
        }
      }
    } catch (err) {
      console.error("Recycling fallback failed:", err);
    }
  }

  const recycledHappened = recycledCount > 0;

  if (!supabase) {
    const exhausted = scored.length === 0 && !recycledHappened;
    const meta = {
      rss_candidates: rssCandidates.length,
      topic_candidates: topicCandidates.length,
      accepted: scored.length,
      exhausted,
      recycled_count: recycledCount,
      quota_exhausted: Boolean((globalThis as any).quotaExhausted),
      fallback_used: Boolean((globalThis as any).pipedFallbackUsed) || Boolean((globalThis as any).invidiousFallbackUsed),
      fallback_provider: (globalThis as any).pipedFallbackUsed ? "piped" : ((globalThis as any).invidiousFallbackUsed ? "invidious" : null),
      fallback_instance: (globalThis as any).pipedLastInstance || (globalThis as any).invidiousLastInstance || null,
      invidious_used: Boolean((globalThis as any).invidiousFallbackUsed),
      invidious_instance: (globalThis as any).invidiousLastInstance || null,
      fresh_inserted: 0,
      queue_returned: 0,
      page_tokens_advanced: pageTokensAdvanced,
      dropped_duration: droppedDuration,
      dropped_low_views: droppedViews,
      shorts_blocked: shortsBlocked,
      min_view_count: youtubeApi ? MIN_VIEW_COUNT : 0,
      topic_search_used: needsTopicSearch,
      youtube_api: youtubeApi,
      stages,
      queries_used: queriesUsed,
      funnel_summary,
      creators_resolved: creatorsResolved,
      creator_resolution_failures: creatorResolutionFailures,
    };
    (globalThis as any).lastGenerateMeta = meta;

    return NextResponse.json({
      data: scored.map((c, i) => ({
        id: `local-${i}-${c.source_id}`,
        ...c,
        consumed: false,
        generated_for: todayKey(),
        created_at: new Date().toISOString(),
      })),
      meta,
    });
  }

  try {
    const today = todayKey();
    let inserted: any[] = [];
    if (scored.length > 0) {
      const { data, error } = await supabase
        .from("generated_feeds")
        .upsert(
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
          { onConflict: "source_id" }
        )
        .select("*");
      if (error) throw error;
      inserted = data || [];
    }

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

    const insertedIds = new Set((inserted || []).map((r) => r.id));
    const queueReturned = (full || []).filter((r) => !insertedIds.has(r.id)).length;

    const exhausted = scored.length === 0 && !recycledHappened && (full?.length ?? 0) === 0;

    const meta = {
      rss_candidates: rssCandidates.length,
      topic_candidates: topicCandidates.length,
      accepted: scored.length,
      exhausted,
      recycled_count: recycledCount,
      quota_exhausted: Boolean((globalThis as any).quotaExhausted),
      fallback_used: Boolean((globalThis as any).pipedFallbackUsed) || Boolean((globalThis as any).invidiousFallbackUsed),
      fallback_provider: (globalThis as any).pipedFallbackUsed ? "piped" : ((globalThis as any).invidiousFallbackUsed ? "invidious" : null),
      fallback_instance: (globalThis as any).pipedLastInstance || (globalThis as any).invidiousLastInstance || null,
      invidious_used: Boolean((globalThis as any).invidiousFallbackUsed),
      invidious_instance: (globalThis as any).invidiousLastInstance || null,
      fresh_inserted: (inserted || []).length,
      queue_returned: queueReturned,
      page_tokens_advanced: pageTokensAdvanced,
      dropped_duration: droppedDuration,
      dropped_low_views: droppedViews,
      shorts_blocked: shortsBlocked,
      min_view_count: youtubeApi ? MIN_VIEW_COUNT : 0,
      topic_search_used: needsTopicSearch,
      youtube_api: youtubeApi,
      stages,
      queries_used: queriesUsed,
      funnel_summary,
      creators_resolved: creatorsResolved,
      creator_resolution_failures: creatorResolutionFailures,
    };
    (globalThis as any).lastGenerateMeta = meta;

    return NextResponse.json({
      data: rows,
      meta,
    });
  } catch (e) {
    const exhausted = scored.length === 0 && !recycledHappened;
    const meta = {
      rss_candidates: rssCandidates.length,
      topic_candidates: topicCandidates.length,
      accepted: scored.length,
      exhausted,
      recycled_count: recycledCount,
      quota_exhausted: Boolean((globalThis as any).quotaExhausted),
      fallback_used: Boolean((globalThis as any).pipedFallbackUsed) || Boolean((globalThis as any).invidiousFallbackUsed),
      fallback_provider: (globalThis as any).pipedFallbackUsed ? "piped" : ((globalThis as any).invidiousFallbackUsed ? "invidious" : null),
      fallback_instance: (globalThis as any).pipedLastInstance || (globalThis as any).invidiousLastInstance || null,
      invidious_used: Boolean((globalThis as any).invidiousFallbackUsed),
      invidious_instance: (globalThis as any).invidiousLastInstance || null,
      fresh_inserted: 0,
      queue_returned: 0,
      page_tokens_advanced: pageTokensAdvanced,
      dropped_duration: droppedDuration,
      dropped_low_views: droppedViews,
      shorts_blocked: shortsBlocked,
      min_view_count: youtubeApi ? MIN_VIEW_COUNT : 0,
      topic_search_used: needsTopicSearch,
      youtube_api: youtubeApi,
      stages,
      queries_used: queriesUsed,
      funnel_summary,
      creators_resolved: creatorsResolved,
      creator_resolution_failures: creatorResolutionFailures,
    };
    (globalThis as any).lastGenerateMeta = meta;

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
        meta,
      },
      { status: 200 },
    );
  }
}
