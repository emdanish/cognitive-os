import { decodeHtmlEntities } from "@/lib/utils";
import type { YouTubeSearchHit, YouTubeVideoDetails } from "@/lib/youtube";

const KNOWN_INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.nosebs.ru",
  "https://pipedapi-libre.kavin.rocks",
  "https://piped-api.privacy.com.de",
  "https://pipedapi.adminforge.de",
  "https://api.piped.yt",
  "https://pipedapi.drgns.space",
  "https://pipedapi.owo.si",
  "https://pipedapi.ducks.party",
  "https://piped-api.codespace.cz",
  "https://pipedapi.reallyaweso.me",
  "https://pipedapi.darkness.services",
  "https://pipedapi.orangenet.cc",
];

const REQUEST_TIMEOUT_MS = 5000;
const RACE_BATCH_SIZE = 3;
const PIPED_USER_AGENT = "Mozilla/5.0 cogos-personal/1.0";

function getInstancePool(): string[] {
  const override = process.env.PIPED_API_BASE_OVERRIDE?.trim();
  if (override) return [override.replace(/\/$/, "")];
  const shuffled = [...KNOWN_INSTANCES].sort(() => Math.random() - 0.5);
  return shuffled;
}

async function tryOneInstance<T>(inst: string, path: string): Promise<T | null> {
  try {
    const url = `${inst.replace(/\/$/, "")}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": PIPED_USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.startsWith("<")) return null;
    try {
      const json = JSON.parse(text) as T;
      (globalThis as any).pipedFallbackUsed = true;
      (globalThis as any).pipedLastInstance = inst;
      return json;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function pipedFetch<T>(path: string): Promise<T | null> {
  const instances = getInstancePool();
  for (let i = 0; i < instances.length; i += RACE_BATCH_SIZE) {
    const batch = instances.slice(i, i + RACE_BATCH_SIZE);
    const results = await Promise.all(batch.map((inst) => tryOneInstance<T>(inst, path)));
    const winner = results.find((r) => r !== null);
    if (winner) return winner;
  }
  return null;
}

function extractVideoIdFromPipedUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  const m = u.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function parseRelativeUploaded(s: string | null | undefined): string {
  if (!s) return "";
  const match = s.match(/(\d+)\s+(year|month|week|day|hour|minute)s?\s+ago/i);
  if (!match) return "";
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const msPerUnit: Record<string, number> = {
    year: 31536000000,
    month: 2592000000,
    week: 604800000,
    day: 86400000,
    hour: 3600000,
    minute: 60000,
  };
  const ms = (msPerUnit[unit] || 0) * n;
  if (ms === 0) return "";
  return new Date(Date.now() - ms).toISOString();
}

interface PipedRelatedStream {
  url?: string;
  title?: string;
  duration?: number;
  views?: number;
  thumbnail?: string;
  uploaderName?: string;
  uploaderUrl?: string;
  uploaderVerified?: boolean;
  uploadedDate?: string;
  uploaded?: number;
  shortDescription?: string;
  type?: string;
}

export async function pipedSearch(
  query: string,
  maxResults: number = 20,
): Promise<YouTubeSearchHit[]> {
  const path = `/search?q=${encodeURIComponent(query)}&filter=videos`;
  const data = await pipedFetch<{ items?: PipedRelatedStream[] }>(path);
  if (!data?.items) return [];
  const hits: YouTubeSearchHit[] = [];
  for (const it of data.items) {
    if (it.type && it.type !== "stream") continue;
    const vid = extractVideoIdFromPipedUrl(it.url);
    if (!vid) continue;
    hits.push({
      videoId: vid,
      channelId: (it.uploaderUrl || "").replace(/^\/channel\//, ""),
      channelTitle: decodeHtmlEntities(it.uploaderName || ""),
      title: decodeHtmlEntities(it.title || ""),
      description: decodeHtmlEntities(it.shortDescription || ""),
      thumbnail: it.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      publishedAt: parseRelativeUploaded(it.uploadedDate || ""),
    });
    if (hits.length >= maxResults) break;
  }
  return hits;
}

interface PipedVideoStream {
  title?: string;
  description?: string;
  uploader?: string;
  uploaderUrl?: string;
  uploaderVerified?: boolean;
  duration?: number;
  views?: number;
  likes?: number;
  uploadDate?: string;
  thumbnailUrl?: string;
  subtitles?: Array<{ url?: string }>;
  category?: string;
}

export async function pipedVideoDetails(
  ids: string[],
): Promise<YouTubeVideoDetails[]> {
  if (ids.length === 0) return [];
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: YouTubeVideoDetails[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((id) =>
        pipedFetch<PipedVideoStream>(`/streams/${id}`).then((d) => ({ id, d })),
      ),
    );
    for (const { id, d } of results) {
      if (!d) continue;
      const channelId = (d.uploaderUrl || "").replace(/^\/channel\//, "");
      out.push({
        id,
        channelId,
        channelTitle: decodeHtmlEntities(d.uploader || ""),
        title: decodeHtmlEntities(d.title || ""),
        description: decodeHtmlEntities(d.description || ""),
        publishedAt: d.uploadDate || "",
        thumbnail: d.thumbnailUrl || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        durationSeconds: Number(d.duration || 0),
        viewCount: Number(d.views || 0),
        likeCount: Number(d.likes || 0),
        hasCaptions: Array.isArray(d.subtitles) && d.subtitles.length > 0,
      });
    }
  }
  return out;
}

interface PipedChannelResponse {
  id?: string;
  name?: string;
  relatedStreams?: PipedRelatedStream[];
}

export async function pipedResolveHandle(
  handle: string,
): Promise<{ channelId: string; uploadsPlaylistId: string; recentVideoIds: string[] } | null> {
  const clean = handle.replace(/^@/, "");
  const data = await pipedFetch<PipedChannelResponse>(`/c/${encodeURIComponent(clean)}`);
  if (!data?.id) return null;
  const channelId = data.id.startsWith("UC") ? data.id : data.id.replace(/^\/channel\//, "");
  if (!channelId.startsWith("UC")) return null;
  const uploadsPlaylistId = `UU${channelId.slice(2)}`;
  const recentVideoIds = (data.relatedStreams || [])
    .map((s) => extractVideoIdFromPipedUrl(s.url))
    .filter((x): x is string => Boolean(x));
  return { channelId, uploadsPlaylistId, recentVideoIds };
}

export async function pipedChannelVideos(
  channelId: string,
): Promise<string[]> {
  const data = await pipedFetch<PipedChannelResponse>(`/channel/${encodeURIComponent(channelId)}`);
  if (!data?.relatedStreams) return [];
  return data.relatedStreams
    .map((s) => extractVideoIdFromPipedUrl(s.url))
    .filter((x): x is string => Boolean(x));
}
