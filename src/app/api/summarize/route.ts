import { NextResponse } from "next/server";
import { generateStructuredInsight } from "@/lib/gemini";
import { fetchVideoDetails, isYouTubeApiAvailable } from "@/lib/youtube";
import { getServerSupabase } from "@/lib/supabase";
import { bumpDailyStats } from "@/lib/xp-server";
import { XP } from "@/lib/xp";
import { extractYouTubeId, thumbnailFor } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

interface VideoMeta {
  title: string | null;
  author: string | null;
  thumbnail: string | null;
}

async function fetchVideoMeta(videoId: string): Promise<VideoMeta> {
  if (!isYouTubeApiAvailable()) {
    return { title: null, author: null, thumbnail: thumbnailFor(videoId) };
  }
  try {
    const [d] = await fetchVideoDetails([videoId]);
    if (!d) return { title: null, author: null, thumbnail: thumbnailFor(videoId) };
    return {
      title: d.title || null,
      author: d.channelTitle || null,
      thumbnail: d.thumbnail || thumbnailFor(videoId),
    };
  } catch {
    return { title: null, author: null, thumbnail: thumbnailFor(videoId) };
  }
}

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = (body.url || "").trim();
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  // Canonical URL ensures Gemini accepts it consistently regardless of
  // whether the user pasted youtu.be, /shorts/, /embed/, or a bare ID.
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const meta = await fetchVideoMeta(videoId);

  let insight;
  try {
    insight = await generateStructuredInsight(canonicalUrl, {
      title: meta.title || undefined,
      author: meta.author || undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gemini failed";
    const lower = msg.toLowerCase();
    let friendly = msg;
    if (lower.includes("private") || lower.includes("unavailable")) {
      friendly =
        "Gemini could not read this video. It may be private, unlisted, age-restricted, region-blocked, or have member-only access.";
    } else if (lower.includes("quota") || lower.includes("rate")) {
      friendly =
        "Gemini rate limit reached. Wait a minute and try again, or switch GEMINI_MODEL to a different free-tier model.";
    } else if (lower.includes("400") || lower.includes("invalid")) {
      friendly =
        "Gemini rejected this video. Make sure the URL is a public YouTube video (not a Short, livestream, or members-only).";
    }
    return NextResponse.json({ error: friendly }, { status: 502 });
  }

  const topics = insight.topics ?? [];

  const fallbackTitle = meta.title || "Untitled YouTube video";

  let saved;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("summaries")
      .insert({
        source_type: "youtube",
        source_url: canonicalUrl,
        source_id: videoId,
        title: fallbackTitle,
        author: meta.author,
        thumbnail: meta.thumbnail,
        raw_transcript: null,
        insight,
        topics,
        tags: [],
        is_saved: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    saved = data;
    await bumpDailyStats({ xp: XP.summary, summaries: 1 });
  } catch (e) {
    return NextResponse.json(
      {
        data: {
          id: "ephemeral",
          source_type: "youtube",
          source_url: canonicalUrl,
          source_id: videoId,
          title: fallbackTitle,
          author: meta.author,
          thumbnail: meta.thumbnail,
          raw_transcript: null,
          insight,
          tags: [],
          topics,
          is_saved: false,
          reflection: null,
          created_at: new Date().toISOString(),
        },
        warning:
          e instanceof Error
            ? `Insight ready but DB save failed: ${e.message}`
            : "Insight ready but DB save failed",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ data: saved });
}
