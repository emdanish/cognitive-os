import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const scope = body.scope === "all" ? "all" : "consumed";
    const supabase = getServerSupabase();

    let query = supabase.from("generated_feeds").delete();
    if (scope === "consumed") {
      query = query.eq("consumed", true);
    }

    const { data, error } = await query.select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 }
    );
  }
}
