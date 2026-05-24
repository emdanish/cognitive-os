import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SummaryRow } from "@/lib/types";
import { formatRelative, truncate } from "@/lib/utils";

export function SummaryCard({ summary }: { summary: SummaryRow }) {
  return (
    <Link
      href={`/insight/${summary.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {summary.thumbnail ? (
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <Image
            src={summary.thumbnail}
            alt={summary.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-secondary/40">
          <Quote className="h-8 w-8 text-muted-foreground/60" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="font-grotesk text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {summary.author || summary.source_type}
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug tracking-tight">
          {summary.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {truncate(summary.insight?.most_valuable_insight || summary.insight?.executive_summary || "", 140)}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex flex-wrap gap-1">
            {(summary.topics || []).slice(0, 3).map((t) => (
              <Badge key={t} variant="muted" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {formatRelative(summary.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
