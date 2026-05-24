import { getServerSupabase } from "@/lib/supabase";
import type { SummaryRow } from "@/lib/types";
import { LibraryClient } from "./library-client";

export const metadata = { title: "Library · Cognitive OS" };
export const dynamic = "force-dynamic";

async function loadSummaries(): Promise<SummaryRow[]> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("summaries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data || []) as SummaryRow[];
  } catch {
    return [];
  }
}

export default async function LibraryPage() {
  const summaries = await loadSummaries();
  return <LibraryClient summaries={summaries} />;
}
