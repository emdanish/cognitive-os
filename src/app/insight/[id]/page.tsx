import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InsightDisplay } from "@/components/insight-display";
import { ReflectionPrompt } from "@/components/reflection-prompt";
import { getServerSupabase } from "@/lib/supabase";
import type { ReflectionRow, SummaryRow } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadSummary(id: string): Promise<{ summary: SummaryRow; reflection: ReflectionRow | null } | null> {
  try {
    const supabase = getServerSupabase();
    const { data: summary } = await supabase
      .from("summaries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!summary) return null;
    const { data: reflection } = await supabase
      .from("daily_reflections")
      .select("*")
      .eq("summary_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      summary: summary as SummaryRow,
      reflection: (reflection as ReflectionRow) || null,
    };
  } catch {
    return null;
  }
}

export default async function InsightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadSummary(id);
  if (!result) notFound();
  const { summary, reflection } = result;

  return (
    <article className="space-y-8">
      <Link
        href="/library"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to library
      </Link>

      <header className="space-y-4">
        {summary.thumbnail && (
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-border/70 bg-muted">
            <Image
              src={summary.thumbnail}
              alt={summary.title}
              fill
              sizes="(max-width: 768px) 100vw, 1024px"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-grotesk text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {summary.author || summary.source_type}
            </span>
            <h1 className="mt-1 max-w-3xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              {summary.title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(summary.topics || []).map((t) => (
                <Badge key={t} variant="muted" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.source_url && (
              <Button asChild variant="outline" size="sm">
                <a href={summary.source_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Source
                </a>
              </Button>
            )}
            <Button asChild size="sm">
              <a href={`/api/pdf/${summary.id}`} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" /> Export PDF
              </a>
            </Button>
          </div>
        </div>
      </header>

      <InsightDisplay insight={summary.insight} summaryId={summary.id} />
      <ReflectionPrompt summaryId={summary.id} initial={reflection?.answer} />
    </article>
  );
}
