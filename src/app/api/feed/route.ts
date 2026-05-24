import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { decodeHtmlEntities } from "@/lib/utils";

export const runtime = "nodejs";

interface FeedRow {
  title?: string | null;
  author?: string | null;
  description?: string | null;
  [k: string]: unknown;
}

function cleanRow<T extends FeedRow>(row: T): T {
  return {
    ...row,
    title: decodeHtmlEntities(row.title ?? ""),
    author: row.author ? decodeHtmlEntities(row.author) : row.author,
    description: row.description ? decodeHtmlEntities(row.description) : row.description,
  };
}

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("generated_feeds")
      .select("*")
      .eq("consumed", false)
      .order("score", { ascending: false })
      .limit(40);
    if (error) throw error;
    return NextResponse.json({ data: (data || []).map(cleanRow) });
  } catch (e) {
    return NextResponse.json(
      { data: [], error: e instanceof Error ? e.message : "load failed" },
      { status: 200 },
    );
  }
}
