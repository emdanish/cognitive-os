import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { count, error } = await supabase
      .from("generated_feeds")
      .select("id", { count: "exact", head: true })
      .eq("consumed", false);

    if (error) throw error;
    return NextResponse.json({ unconsumed_count: count || 0 });
  } catch (e) {
    return NextResponse.json(
      { unconsumed_count: 0, error: e instanceof Error ? e.message : "Health check failed" },
      { status: 200 },
    );
  }
}
