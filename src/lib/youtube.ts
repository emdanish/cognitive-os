import { decodeHtmlEntities } from "@/lib/utils";

const API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeSearchHit {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

export interface YouTubeVideoDetails {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  hasCaptions: boolean;
}

function key(): string | null {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

export function isYouTubeApiAvailable(): boolean {
  return Boolean(key());
}

export function parseISO8601Duration(s?: string): number {
  if (!s) return 0;
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (
    parseInt(m[1] || "0", 10) * 3600 +
    parseInt(m[2] || "0", 10) * 60 +
    parseInt(m[3] || "0", 10)
  );
}

interface SearchOptions {
  query: string;
  maxResults?: number;
  videoDuration?: "medium" | "long";
  videoCaption?: "closedCaption" | "any";
  order?: "relevance" | "date" | "viewCount";
  publishedAfter?: string;
  relevanceLanguage?: string;
  regionCode?: string;
  noStore?: boolean;
  pageToken?: string;
}

export async function searchYouTube(
  opts: SearchOptions,
): Promise<{ items: YouTubeSearchHit[]; nextPageToken: string | null }> {
  const k = key();
  if (!k) return { items: [], nextPageToken: null };

  const durationVal =
    opts.videoDuration === "medium" || opts.videoDuration === "long"
      ? opts.videoDuration
      : "long";

  const params = new URLSearchParams({
    key: k,
    part: "snippet",
    type: "video",
    maxResults: String(Math.min(opts.maxResults ?? 15, 50)),
    q: opts.query,
    order: opts.order ?? "relevance",
    videoDuration: durationVal,
    videoCaption: opts.videoCaption ?? "closedCaption",
    relevanceLanguage: opts.relevanceLanguage ?? "en",
    regionCode: opts.regionCode ?? "US",
    safeSearch: "moderate",
    quotaUser: "cogos-personal",
  });
  if (opts.publishedAfter) params.set("publishedAfter", opts.publishedAfter);
  if (opts.pageToken) params.set("pageToken", opts.pageToken);

  try {
    const fetchOpts: RequestInit = opts.noStore
      ? { cache: "no-store" }
      : { next: { revalidate: 1800 } };
    const res = await fetch(`${API_BASE}/search?${params.toString()}`, fetchOpts);
    if (!res.ok) {
      if (res.status === 403) {
        try {
          const body = await res.json();
          if (body?.error?.errors?.some((e: any) => e.reason === "quotaExceeded")) {
            (globalThis as any).quotaExhausted = true;
            if (!(globalThis as any).hasLoggedQuota) {
              console.error("YouTube API quota exceeded (quotaExceeded)");
              (globalThis as any).hasLoggedQuota = true;
            }
            try {
              const { pipedSearch } = await import("@/lib/piped");
              const pipedHits = await pipedSearch(opts.query, opts.maxResults ?? 15);
              if (pipedHits.length > 0) {
                return { items: pipedHits, nextPageToken: null };
              }
            } catch { /* fall through */ }
            try {
              const { invidiousSearch } = await import("@/lib/invidious");
              const invHits = await invidiousSearch(opts.query, opts.maxResults ?? 15);
              if (invHits.length > 0) {
                return { items: invHits, nextPageToken: null };
              }
            } catch { /* fall through */ }
          }
        } catch { /* fall through */ }
      }
      return { items: [], nextPageToken: null };
    }
    const json = (await res.json()) as {
      nextPageToken?: string;
      items?: Array<{
        id?: { videoId?: string };
        snippet?: {
          channelId?: string;
          channelTitle?: string;
          title?: string;
          description?: string;
          publishedAt?: string;
          thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
        };
      }>;
    };
    const items = (json.items || [])
      .map((it) => {
        const vid = it.id?.videoId;
        if (!vid) return null;
        const sn = it.snippet || {};
        const thumb =
          sn.thumbnails?.high?.url ||
          sn.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        return {
          videoId: vid,
          channelId: sn.channelId || "",
          channelTitle: decodeHtmlEntities(sn.channelTitle || ""),
          title: decodeHtmlEntities(sn.title || ""),
          description: decodeHtmlEntities(sn.description || ""),
          thumbnail: thumb,
          publishedAt: sn.publishedAt || "",
        } satisfies YouTubeSearchHit;
      })
      .filter((x): x is YouTubeSearchHit => Boolean(x));
    return { items, nextPageToken: json.nextPageToken || null };
  } catch {
    return { items: [], nextPageToken: null };
  }
}

export async function fetchVideoDetails(
  ids: string[],
  noStore?: boolean,
): Promise<YouTubeVideoDetails[]> {
  const k = key();
  if (!k || ids.length === 0) return [];
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 50) {
    chunks.push(unique.slice(i, i + 50));
  }
  const all: YouTubeVideoDetails[] = [];
  await Promise.all(
    chunks.map(async (chunk) => {
      const params = new URLSearchParams({
        key: k,
        part: "snippet,contentDetails,statistics",
        id: chunk.join(","),
        maxResults: "50",
        quotaUser: "cogos-personal",
      });
      try {
        const fetchOpts: RequestInit = noStore
          ? { cache: "no-store" }
          : { next: { revalidate: 3600 } };
        const res = await fetch(`${API_BASE}/videos?${params.toString()}`, fetchOpts);
        if (!res.ok) {
          if (res.status === 403) {
            try {
              const body = await res.json();
              if (body?.error?.errors?.some((e: any) => e.reason === "quotaExceeded")) {
                (globalThis as any).quotaExhausted = true;
                if (!(globalThis as any).hasLoggedQuota) {
                  console.error("YouTube API quota exceeded (quotaExceeded)");
                  (globalThis as any).hasLoggedQuota = true;
                }
              }
            } catch {}
          }
          return;
        }
        const json = (await res.json()) as {
          items?: Array<{
            id?: string;
            snippet?: {
              channelId?: string;
              channelTitle?: string;
              title?: string;
              description?: string;
              publishedAt?: string;
              thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
            };
            contentDetails?: { duration?: string; caption?: string };
            statistics?: { viewCount?: string; likeCount?: string };
          }>;
        };
        for (const it of json.items || []) {
          if (!it.id) continue;
          const sn = it.snippet || {};
          const thumb =
            sn.thumbnails?.high?.url ||
            sn.thumbnails?.medium?.url ||
            `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`;
          all.push({
            id: it.id,
            channelId: sn.channelId || "",
            channelTitle: decodeHtmlEntities(sn.channelTitle || ""),
            title: decodeHtmlEntities(sn.title || ""),
            description: decodeHtmlEntities(sn.description || ""),
            publishedAt: sn.publishedAt || "",
            thumbnail: thumb,
            durationSeconds: parseISO8601Duration(it.contentDetails?.duration),
            viewCount: Number(it.statistics?.viewCount || 0),
            likeCount: Number(it.statistics?.likeCount || 0),
            hasCaptions: it.contentDetails?.caption === "true",
          });
        }
      } catch {
        /* ignore */
      }
    }),
  );
  if ((globalThis as any).quotaExhausted) {
    try {
      const haveIds = new Set(all.map((d) => d.id));
      const missing = unique.filter((id) => !haveIds.has(id));
      if (missing.length > 0) {
        const { pipedVideoDetails } = await import("@/lib/piped");
        const fromPiped = await pipedVideoDetails(missing);
        all.push(...fromPiped);

        const updatedHaveIds = new Set(all.map((d) => d.id));
        const stillMissing = unique.filter((id) => !updatedHaveIds.has(id));
        if (stillMissing.length > 0) {
          const { invidiousVideoDetails } = await import("@/lib/invidious");
          const fromInvidious = await invidiousVideoDetails(stillMissing);
          all.push(...fromInvidious);
        }
      }
    } catch { /* ignore */ }
  }
  return all;
}
