import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // 1. Manually delete saved insights associated with this summary
    const { error: insightsError } = await supabase
      .from("saved_insights")
      .delete()
      .eq("summary_id", id);
    if (insightsError) {
      return NextResponse.json({ error: insightsError.message }, { status: 500 });
    }

    // 2. Delete the summary itself. Daily reflections and recommendations will cascade delete automatically.
    const { error: summaryError } = await supabase
      .from("summaries")
      .delete()
      .eq("id", id);
    if (summaryError) {
      return NextResponse.json({ error: summaryError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 500 },
    );
  }
}
