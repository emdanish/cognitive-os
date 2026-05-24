import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { bumpDailyStats, bumpTopicWeights } from "@/lib/xp-server";
import { XP } from "@/lib/xp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    feed_item_id?: string | null;
    source_url?: string;
    direction?: "left" | "right" | "super";
    topics?: string[];
  };

  if (!body.direction || !["left", "right", "super"].includes(body.direction)) {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }
  if (!body.source_url) {
    return NextResponse.json({ error: "source_url required" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();
    await supabase.from("swipe_history").insert({
      feed_item_id: body.feed_item_id || null,
      source_url: body.source_url,
      direction: body.direction,
      topics: body.topics || [],
    });

    if (body.feed_item_id) {
      await supabase
        .from("generated_feeds")
        .update({ consumed: true })
        .eq("id", body.feed_item_id);
    }

    const xp =
      body.direction === "right" ? XP.swipe_right : body.direction === "super" ? XP.swipe_super : 0;
    await bumpDailyStats({ xp, swipes: 1 });

    const weight =
      body.direction === "left" ? -2 : body.direction === "right" ? 3 : 8;
    await bumpTopicWeights(body.topics || [], weight);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "swipe failed" },
      { status: 500 },
    );
  }
}
