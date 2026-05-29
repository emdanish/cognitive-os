import { getServerSupabase } from "@/lib/supabase";
import { decodeHtmlEntities } from "@/lib/utils";

const API_BASE = "https://www.googleapis.com/youtube/v3";

function key(): string | null {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

const PERMANENT_ERRORS = new Set<string>([
  "channel_not_found",
  "uploads_playlist_not_found",
  "http_404",
  "piped_no_channel",
  "piped_invalid_id",
]);

const TRANSIENT_BACKOFF_MS = 60 * 60 * 1000; // 1 hour
const PERMANENT_BACKOFF_MS = 7 * 86400 * 1000; // 7 days

export interface ResolvedCreator {
  handle: string;
  name: string;
  channelId: string;
  uploadsPlaylistId: string;
  topVideoIds?: string[] | null;
}

export interface CreatorVideo {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

export async function resolveHandle(
  handle: string,
  noStore?: boolean,
): Promise<{ channelId: string; uploadsPlaylistId: string } | { error: string }> {
  const k = key();
  if (!k) return { error: "no_api_key" };
  const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const params = new URLSearchParams({
    key: k,
    part: "contentDetails,snippet",
    forHandle: cleanHandle,
    quotaUser: "cogos-personal",
  });
  
  // Do NOT cache channels.list API-level responses; rely strictly on DB caching
  const fetchOpts: RequestInit = { cache: "no-store" };

  try {
    const res = await fetch(`${API_BASE}/channels?${params.toString()}`, fetchOpts);
    if (!res.ok) {
      if (res.status === 403) {
        try {
          const body = await res.json();
          if (body?.error?.errors?.some((e: any) => e.reason === "quotaExceeded")) {
            (globalThis as any).quotaExhausted = true;
            try {
              const { pipedResolveHandle } = await import("@/lib/piped");
              const resolved = await pipedResolveHandle(handle);
              if (resolved) {
                return {
                  channelId: resolved.channelId,
                  uploadsPlaylistId: resolved.uploadsPlaylistId,
                };
              }
              const { invidiousResolveHandle } = await import("@/lib/invidious");
              const inv = await invidiousResolveHandle(handle);
              if (inv) {
                return {
                  channelId: inv.channelId,
                  uploadsPlaylistId: inv.uploadsPlaylistId,
                };
              }
            } catch {}
            return { error: "quota_exhausted" };
          }
        } catch {}
      }
      return { error: `http_${res.status}` };
    }
    const json = await res.json() as {
      items?: Array<{
        id?: string;
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
    };
    const item = json.items?.[0];
    const channelId = item?.id;
    let uploadsPlaylistId = item?.contentDetails?.relatedPlaylists?.uploads;
    if (!channelId) return { error: "channel_not_found" };
    if (!uploadsPlaylistId && channelId.startsWith("UC")) {
      uploadsPlaylistId = "UU" + channelId.slice(2);
    }
    if (!uploadsPlaylistId) return { error: "uploads_playlist_not_found" };
    return { channelId, uploadsPlaylistId };
  } catch {
    try {
      const { pipedResolveHandle } = await import("@/lib/piped");
      const resolved = await pipedResolveHandle(handle);
      if (resolved) {
        return {
          channelId: resolved.channelId,
          uploadsPlaylistId: resolved.uploadsPlaylistId,
        };
      }
      const { invidiousResolveHandle } = await import("@/lib/invidious");
      const inv = await invidiousResolveHandle(handle);
      if (inv) {
        return {
          channelId: inv.channelId,
          uploadsPlaylistId: inv.uploadsPlaylistId,
        };
      }
    } catch {}
    return { error: "fetch_failed" };
  }
}

export async function fetchTopVideosForChannel(
  channelId: string,
  noStore?: boolean,
): Promise<string[]> {
  const k = key();
  if (!k || !channelId) return [];
  const params = new URLSearchParams({
    key: k,
    part: "snippet",
    channelId,
    order: "viewCount",
    type: "video",
    maxResults: "50",
    quotaUser: "cogos-personal",
  });
  const fetchOpts: RequestInit = noStore
    ? { cache: "no-store" }
    : { next: { revalidate: 86400 } };
  try {
    const res = await fetch(`${API_BASE}/search?${params.toString()}`, fetchOpts);
    if (!res.ok) {
      if (res.status === 403) {
        try {
          const body = await res.json();
          if (body?.error?.errors?.some((e: any) => e.reason === "quotaExceeded")) {
            (globalThis as any).quotaExhausted = true;
            try {
              const { pipedChannelVideos } = await import("@/lib/piped");
              const pVideos = await pipedChannelVideos(channelId);
              if (pVideos.length > 0) return pVideos;
            } catch {}
            try {
              const { invidiousChannelVideos } = await import("@/lib/invidious");
              return await invidiousChannelVideos(channelId);
            } catch {}
          }
        } catch {}
      }
      return [];
    }
    const json = await res.json() as {
      items?: Array<{ id?: { videoId?: string } }>;
    };
    return (json.items || [])
      .map((it) => it.id?.videoId)
      .filter((x): x is string => Boolean(x));
  } catch {
    if ((globalThis as any).quotaExhausted) {
      try {
        const { pipedChannelVideos } = await import("@/lib/piped");
        const pVideos = await pipedChannelVideos(channelId);
        if (pVideos.length > 0) return pVideos;
      } catch {}
      try {
        const { invidiousChannelVideos } = await import("@/lib/invidious");
        return await invidiousChannelVideos(channelId);
      } catch {}
    }
    return [];
  }
}

export async function getOrResolveCreator(
  handle: string,
  name: string,
  noStore?: boolean,
): Promise<ResolvedCreator | null> {
  try {
    const supabase = getServerSupabase();
    const { data: cached } = await supabase
      .from("creator_state")
      .select("*")
      .eq("handle", handle)
      .maybeSingle();

    if (cached) {
      // Success path: row has channel_id and uploads_playlist_id
      if (cached.channel_id && cached.uploads_playlist_id) {
        const channelId = cached.channel_id;
        const uploadsPlaylistId = cached.uploads_playlist_id;
        
        const SEVEN_DAYS_MS = 7 * 86400000;
        const needsTopRefresh =
          !cached.top_video_ids_refreshed_at ||
          Date.now() - new Date(cached.top_video_ids_refreshed_at).getTime() > SEVEN_DAYS_MS;

        let topIds = cached.top_video_ids || null;
        if (needsTopRefresh) {
          const fetchedIds = await fetchTopVideosForChannel(channelId, noStore);
          if (fetchedIds.length > 0) {
            topIds = fetchedIds;
            await supabase.from("creator_state").update({
              top_video_ids: topIds,
              top_video_ids_refreshed_at: new Date().toISOString(),
              last_used_at: new Date().toISOString(),
            }).eq("handle", handle);
          } else {
            await supabase.from("creator_state").update({
              last_used_at: new Date().toISOString(),
            }).eq("handle", handle);
          }
        } else {
          await supabase.from("creator_state").update({
            last_used_at: new Date().toISOString(),
          }).eq("handle", handle);
        }

        return {
          handle,
          name,
          channelId,
          uploadsPlaylistId,
          topVideoIds: topIds,
        };
      }
      
      if (cached.resolution_error) {
        const lastAttempt = cached.last_used_at ? new Date(cached.last_used_at).getTime() : 0;
        const isPermanent = PERMANENT_ERRORS.has(cached.resolution_error);
        const backoffMs = isPermanent ? PERMANENT_BACKOFF_MS : TRANSIENT_BACKOFF_MS;
        if (Date.now() - lastAttempt < backoffMs) {
          return null;
        }
      }
    }

    const youtubeQuotaDown = Boolean((globalThis as any).quotaExhausted);
    let result: { channelId: string; uploadsPlaylistId: string } | { error: string };

    if (youtubeQuotaDown) {
      try {
        const { pipedResolveHandle } = await import("@/lib/piped");
        const piped = await pipedResolveHandle(handle);
        if (piped) {
          result = { channelId: piped.channelId, uploadsPlaylistId: piped.uploadsPlaylistId };
        } else {
          const { invidiousResolveHandle } = await import("@/lib/invidious");
          const inv = await invidiousResolveHandle(handle);
          result = inv
            ? { channelId: inv.channelId, uploadsPlaylistId: inv.uploadsPlaylistId }
            : { error: "piped_no_channel" };
        }
      } catch {
        result = { error: "piped_fetch_failed" };
      }
    } else {
      result = await resolveHandle(handle, noStore);
    }
    if ("error" in result) {
      await supabase.from("creator_state").upsert({
        handle,
        name,
        channel_id: null,
        uploads_playlist_id: null,
        resolved_at: null,
        resolution_error: result.error,
        last_used_at: new Date().toISOString(),
      });
      return null;
    }

    const topIds = await fetchTopVideosForChannel(result.channelId, noStore);

    await supabase.from("creator_state").upsert({
      handle,
      name,
      channel_id: result.channelId,
      uploads_playlist_id: result.uploadsPlaylistId,
      resolved_at: new Date().toISOString(),
      resolution_error: null,
      last_used_at: new Date().toISOString(),
      top_video_ids: topIds.length > 0 ? topIds : null,
      top_video_ids_refreshed_at: topIds.length > 0 ? new Date().toISOString() : null,
    });

    return {
      handle,
      name,
      channelId: result.channelId,
      uploadsPlaylistId: result.uploadsPlaylistId,
      topVideoIds: topIds,
    };
  } catch {
    return null;
  }
}

export async function fetchUploadsPlaylist(
  uploadsPlaylistId: string,
  maxResults: number = 50,
  noStore?: boolean,
): Promise<CreatorVideo[]> {
  const k = key();
  if (!k) return [];
  const params = new URLSearchParams({
    key: k,
    part: "snippet,contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(Math.min(maxResults, 50)),
    quotaUser: "cogos-personal",
  });
  const fetchOpts: RequestInit = noStore
    ? { cache: "no-store" }
    : { next: { revalidate: 1800 } };
  try {
    const res = await fetch(`${API_BASE}/playlistItems?${params.toString()}`, fetchOpts);
    if (!res.ok) {
      if (res.status === 403) {
        try {
          const body = await res.json();
          if (body?.error?.errors?.some((e: any) => e.reason === "quotaExceeded")) {
            (globalThis as any).quotaExhausted = true;
            const channelId = uploadsPlaylistId.startsWith("UU")
              ? `UC${uploadsPlaylistId.slice(2)}`
              : uploadsPlaylistId;
            try {
              const { pipedChannelVideos } = await import("@/lib/piped");
              const videoIds = await pipedChannelVideos(channelId);
              if (videoIds.length > 0) {
                return videoIds.map<CreatorVideo>((vid) => ({
                  videoId: vid,
                  channelId,
                  channelTitle: "",
                  title: "",
                  description: "",
                  thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                  publishedAt: "",
                }));
              }
            } catch {}
            try {
              const { invidiousChannelVideos } = await import("@/lib/invidious");
              const videoIds = await invidiousChannelVideos(channelId);
              if (videoIds.length > 0) {
                return videoIds.map<CreatorVideo>((vid) => ({
                  videoId: vid,
                  channelId,
                  channelTitle: "",
                  title: "",
                  description: "",
                  thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                  publishedAt: "",
                }));
              }
            } catch {}
          }
        } catch {}
      }
      return [];
    }
    const json = await res.json() as {
      items?: Array<{
        snippet?: {
          title?: string;
          description?: string;
          publishedAt?: string;
          channelId?: string;
          channelTitle?: string;
          thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
          resourceId?: { videoId?: string; kind?: string };
        };
        contentDetails?: { videoId?: string; videoPublishedAt?: string };
      }>;
    };
    const items: CreatorVideo[] = [];
    for (const it of json.items || []) {
      const vid = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
      if (!vid) continue;
      const sn = it.snippet || {};
      const thumb =
        sn.thumbnails?.high?.url ||
        sn.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
      items.push({
        videoId: vid,
        channelId: sn.channelId || "",
        channelTitle: decodeHtmlEntities(sn.channelTitle || ""),
        title: decodeHtmlEntities(sn.title || ""),
        description: decodeHtmlEntities(sn.description || ""),
        thumbnail: thumb,
        publishedAt: it.contentDetails?.videoPublishedAt || sn.publishedAt || "",
      });
    }
    return items;
  } catch {
    if ((globalThis as any).quotaExhausted) {
      const channelId = uploadsPlaylistId.startsWith("UU")
        ? `UC${uploadsPlaylistId.slice(2)}`
        : uploadsPlaylistId;
      try {
        const { pipedChannelVideos } = await import("@/lib/piped");
        const videoIds = await pipedChannelVideos(channelId);
        if (videoIds.length > 0) {
          return videoIds.map<CreatorVideo>((vid) => ({
            videoId: vid,
            channelId,
            channelTitle: "",
            title: "",
            description: "",
            thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            publishedAt: "",
          }));
        }
      } catch {}
      try {
        const { invidiousChannelVideos } = await import("@/lib/invidious");
        const videoIds = await invidiousChannelVideos(channelId);
        if (videoIds.length > 0) {
          return videoIds.map<CreatorVideo>((vid) => ({
            videoId: vid,
            channelId,
            channelTitle: "",
            title: "",
            description: "",
            thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            publishedAt: "",
          }));
        }
      } catch {}
    }
    return [];
  }
}
