import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { bumpDailyStats } from "@/lib/xp-server";
import { XP } from "@/lib/xp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    summary_id?: string;
    kind?: "summary" | "quote" | "framework" | "idea";
    content?: string;
    source_title?: string;
    source_url?: string;
  };

  if (!body.content?.trim() || !body.kind) {
    return NextResponse.json({ error: "content and kind required" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("saved_insights")
      .insert({
        summary_id: body.summary_id || null,
        kind: body.kind,
        content: body.content.trim(),
        source_title: body.source_title || null,
        source_url: body.source_url || null,
      })
      .select("*")
      .single();
    if (error) throw error;
    await bumpDailyStats({ xp: XP.saved });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "save failed" },
      { status: 500 },
    );
  }
}
