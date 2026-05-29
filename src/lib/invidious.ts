import { decodeHtmlEntities } from "@/lib/utils";
import type { YouTubeSearchHit, YouTubeVideoDetails } from "@/lib/youtube";

const KNOWN_INVIDIOUS_INSTANCES = [
  "https://inv.thepixora.com",
  "https://invidious.nerdvpn.de",
  "https://inv.nadeko.net",
  "https://invidious.f5.si",
  "https://yt.chocolatemoo53.com",
];

const REQUEST_TIMEOUT_MS = 5000;
const UA = "Mozilla/5.0 cogos-personal/1.0";

function getPool(): string[] {
  const override = process.env.INVIDIOUS_INSTANCE_OVERRIDE?.trim();
  if (override) return [override.replace(/\/$/, "")];
  return [...KNOWN_INVIDIOUS_INSTANCES].sort(() => Math.random() - 0.5);
}

async function tryOne<T>(inst: string, path: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${inst.replace(/\/$/, "")}${path}`, {
      cache: "no-store",
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const txt = await res.text();
    if (!txt || txt.startsWith("<")) return null;
    try {
      const json = JSON.parse(txt) as T;
      (globalThis as any).invidiousFallbackUsed = true;
      (globalThis as any).invidiousLastInstance = inst;
      return json;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function invFetch<T>(path: string): Promise<T | null> {
  const instances = getPool();
  for (let i = 0; i < instances.length; i += 3) {
    const batch = instances.slice(i, i + 3);
    const results = await Promise.all(batch.map((inst) => tryOne<T>(inst, path)));
    const winner = results.find((r) => r !== null);
    if (winner) return winner;
  }
  return null;
}

export async function invidiousResolveHandle(
  handle: string,
): Promise<{ channelId: string; uploadsPlaylistId: string } | null> {
  const clean = handle.replace(/^@/, "");
  const data = await invFetch<{ authorId?: string }>(
    `/api/v1/channels/@${encodeURIComponent(clean)}`,
  );
  if (!data?.authorId || !data.authorId.startsWith("UC")) return null;
  return {
    channelId: data.authorId,
    uploadsPlaylistId: `UU${data.authorId.slice(2)}`,
  };
}

export async function invidiousChannelVideos(
  channelId: string,
  sort: "newest" | "popular" = "newest",
): Promise<string[]> {
  const data = await invFetch<{ videos?: Array<{ videoId?: string }> }>(
    `/api/v1/channels/${encodeURIComponent(channelId)}/videos?sort_by=${sort}`,
  );
  if (!data?.videos) return [];
  return data.videos.map((v) => v.videoId).filter((x): x is string => Boolean(x));
}

export async function invidiousSearch(
  query: string,
  maxResults: number = 15,
): Promise<YouTubeSearchHit[]> {
  const path = `/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
  const items = await invFetch<
    Array<{
      type?: string;
      videoId?: string;
      title?: string;
      author?: string;
      authorId?: string;
      authorUrl?: string;
      description?: string;
      videoThumbnails?: Array<{ url?: string }>;
      published?: number;
      lengthSeconds?: number;
      viewCount?: number;
    }>
  >(path);
  if (!Array.isArray(items)) return [];
  const out: YouTubeSearchHit[] = [];
  for (const it of items) {
    if (it.type && it.type !== "video") continue;
    if (!it.videoId) continue;
    out.push({
      videoId: it.videoId,
      channelId: it.authorId || "",
      channelTitle: decodeHtmlEntities(it.author || ""),
      title: decodeHtmlEntities(it.title || ""),
      description: decodeHtmlEntities(it.description || ""),
      thumbnail:
        it.videoThumbnails?.[0]?.url ||
        `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`,
      publishedAt: it.published ? new Date(it.published * 1000).toISOString() : "",
    });
    if (out.length >= maxResults) break;
  }
  return out;
}

export async function invidiousVideoDetails(
  ids: string[],
): Promise<YouTubeVideoDetails[]> {
  if (ids.length === 0) return [];
  const out: YouTubeVideoDetails[] = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((id) =>
        invFetch<{
          title?: string;
          description?: string;
          author?: string;
          authorId?: string;
          lengthSeconds?: number;
          viewCount?: number;
          likeCount?: number;
          published?: number;
          videoThumbnails?: Array<{ url?: string }>;
          captions?: Array<unknown>;
        }>(`/api/v1/videos/${id}`).then((d) => ({ id, d })),
      ),
    );
    for (const { id, d } of results) {
      if (!d) continue;
      out.push({
        id,
        channelId: d.authorId || "",
        channelTitle: decodeHtmlEntities(d.author || ""),
        title: decodeHtmlEntities(d.title || ""),
        description: decodeHtmlEntities(d.description || ""),
        publishedAt: d.published ? new Date(d.published * 1000).toISOString() : "",
        thumbnail:
          d.videoThumbnails?.[0]?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        durationSeconds: Number(d.lengthSeconds || 0),
        viewCount: Number(d.viewCount || 0),
        likeCount: Number(d.likeCount || 0),
        hasCaptions: Array.isArray(d.captions) && d.captions.length > 0,
      });
    }
  }
  return out;
}
