import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("creator_state")
      .update({ resolution_error: null, last_used_at: "1970-01-01T00:00:00Z" })
      .is("channel_id", null)
      .neq("resolution_error", "channel_not_found")
      .neq("resolution_error", "uploads_playlist_not_found")
      .neq("resolution_error", "http_404")
      .select("handle");
    if (error) throw error;
    return NextResponse.json({ ok: true, reset_count: data?.length || 0, handles: data?.map((d) => d.handle) || [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 },
    );
  }
}
