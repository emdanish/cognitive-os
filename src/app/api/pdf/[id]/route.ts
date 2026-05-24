import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSupabase } from "@/lib/supabase";
import type { SummaryRow } from "@/lib/types";
import { InsightPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let summary: SummaryRow | null = null;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("summaries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    summary = (data as SummaryRow) || null;
  } catch {
    /* fall through */
  }
  if (!summary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buffer = await renderToBuffer(InsightPdf({ summary }));
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slugify(summary.title)}.pdf"`,
    },
  });
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "insight";
}
