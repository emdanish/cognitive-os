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
  videoDuration?: "short" | "medium" | "long" | "any";
  videoCaption?: "closedCaption" | "any";
  order?: "relevance" | "date" | "viewCount";
  publishedAfter?: string;
  relevanceLanguage?: string;
  regionCode?: string;
}

export async function searchYouTube(opts: SearchOptions): Promise<YouTubeSearchHit[]> {
  const k = key();
  if (!k) return [];
  const params = new URLSearchParams({
    key: k,
    part: "snippet",
    type: "video",
    maxResults: String(Math.min(opts.maxResults ?? 15, 25)),
    q: opts.query,
    order: opts.order ?? "relevance",
    videoDuration: opts.videoDuration ?? "medium",
    videoCaption: opts.videoCaption ?? "closedCaption",
    relevanceLanguage: opts.relevanceLanguage ?? "en",
    regionCode: opts.regionCode ?? "US",
    safeSearch: "moderate",
  });
  if (opts.publishedAfter) params.set("publishedAfter", opts.publishedAfter);

  try {
    const res = await fetch(`${API_BASE}/search?${params.toString()}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
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
    return (json.items || [])
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
  } catch {
    return [];
  }
}

export async function fetchVideoDetails(ids: string[]): Promise<YouTubeVideoDetails[]> {
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
      });
      try {
        const res = await fetch(`${API_BASE}/videos?${params.toString()}`, {
          next: { revalidate: 3600 },
        });
        if (!res.ok) return;
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
  return all;
}
