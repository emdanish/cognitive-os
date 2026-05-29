import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServerSupabase();

    // 1. Get count of unconsumed feeds
    const { count: unconsumedCount, error: countError } = await supabase
      .from("generated_feeds")
      .select("id", { count: "exact", head: true })
      .eq("consumed", false);

    if (countError) throw countError;

    // 2. Get all rows from feed_search_state for diagnostics
    const { data: searchStates, error: stateError } = await supabase
      .from("feed_search_state")
      .select("*")
      .order("last_used_at", { ascending: false });

    if (stateError) throw stateError;

    // 3. Get creator_state rows
    const { data: creators, error: creatorError } = await supabase
      .from("creator_state")
      .select("handle, name, channel_id, uploads_playlist_id, resolution_error, last_used_at, top_video_ids_refreshed_at, top_video_ids")
      .order("last_used_at", { ascending: false });

    if (creatorError) throw creatorError;

    const creatorStateSummary = (creators || []).map((c) => ({
      handle: c.handle,
      name: c.name,
      channel_id: c.channel_id,
      uploads_playlist_id: c.uploads_playlist_id,
      resolution_error: c.resolution_error,
      last_used_at: c.last_used_at,
      top_video_ids_refreshed_at: c.top_video_ids_refreshed_at,
      top_video_count: (c.top_video_ids as string[] | null)?.length ?? 0,
    }));

    // 4. Retrieve last generate metadata
    const lastGenerateMeta = (globalThis as any).lastGenerateMeta || null;

    const fallbackSummary = {
      piped_used: Boolean((globalThis as any).pipedFallbackUsed),
      piped_last_instance: (globalThis as any).pipedLastInstance || null,
      invidious_used: Boolean((globalThis as any).invidiousFallbackUsed),
      invidious_last_instance: (globalThis as any).invidiousLastInstance || null,
    };

    return NextResponse.json({
      unconsumed_count: unconsumedCount || 0,
      last_generate_meta: lastGenerateMeta,
      search_state_summary: searchStates || [],
      creator_state_summary: creatorStateSummary,
      fallback_summary: fallbackSummary,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Diagnostics failed",
        unconsumed_count: 0,
        last_generate_meta: null,
        search_state_summary: [],
        creator_state_summary: [],
        fallback_summary: {
          piped_used: false,
          piped_last_instance: null,
          invidious_used: false,
          invidious_last_instance: null,
        },
      },
      { status: 200 }
    );
  }
}
