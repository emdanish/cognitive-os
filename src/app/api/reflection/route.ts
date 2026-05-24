import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { bumpDailyStats } from "@/lib/xp-server";
import { XP } from "@/lib/xp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    summary_id?: string;
    prompt?: string;
    answer?: string;
  };
  if (!body.summary_id || !body.answer?.trim()) {
    return NextResponse.json({ error: "summary_id and answer required" }, { status: 400 });
  }

  try {
    const supabase = getServerSupabase();
    const { data: existing } = await supabase
      .from("daily_reflections")
      .select("id")
      .eq("summary_id", body.summary_id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("daily_reflections")
        .update({ answer: body.answer.trim(), prompt: body.prompt || "What will you apply today?" })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ data });
    }

    const { data, error } = await supabase
      .from("daily_reflections")
      .insert({
        summary_id: body.summary_id,
        prompt: body.prompt || "What will you apply today?",
        answer: body.answer.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    await bumpDailyStats({ xp: XP.reflection, reflections: 1 });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save reflection" },
      { status: 500 },
    );
  }
}
