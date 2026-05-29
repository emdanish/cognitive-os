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
    const { data: swipeRow, error: insertError } = await supabase
      .from("swipe_history")
      .insert({
        feed_item_id: body.feed_item_id || null,
        source_url: body.source_url,
        direction: body.direction,
        topics: body.topics || [],
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

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

    const { count: unconsumedCount } = await supabase
      .from("generated_feeds")
      .select("id", { count: "exact", head: true })
      .eq("consumed", false);

    return NextResponse.json({
      ok: true,
      id: swipeRow?.id ?? null,
      unconsumed_count: unconsumedCount || 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "swipe failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // 1. Retrieve the swipe record to know how to reverse it
    const { data: swipe, error: selectError } = await supabase
      .from("swipe_history")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!swipe) {
      return NextResponse.json({ error: "Swipe not found" }, { status: 404 });
    }

    // 2. Delete the swipe record
    const { error: deleteError } = await supabase
      .from("swipe_history")
      .delete()
      .eq("id", id);
    if (deleteError) throw deleteError;

    // 3. Mark the feed item as unconsumed if applicable
    if (swipe.feed_item_id) {
      await supabase
        .from("generated_feeds")
        .update({ consumed: false })
        .eq("id", swipe.feed_item_id);
    }

    // 4. Reverse daily stats (XP, swipes)
    const xp =
      swipe.direction === "right"
        ? -XP.swipe_right
        : swipe.direction === "super"
        ? -XP.swipe_super
        : 0;
    await bumpDailyStats({ xp, swipes: -1 });

    // 5. Reverse topic weights
    const weight =
      swipe.direction === "left" ? 2 : swipe.direction === "right" ? -3 : -8;
    await bumpTopicWeights(swipe.topics || [], weight);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Undo swipe failed" },
      { status: 500 },
    );
  }
}

