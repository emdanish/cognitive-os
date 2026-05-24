"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Search, BookmarkCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SummaryCard } from "@/components/summary-card";
import type { SummaryRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LibraryClient({ summaries }: { summaries: SummaryRow[] }) {
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const allTopics = useMemo(() => {
    const set = new Set<string>();
    for (const s of summaries) {
      for (const t of s.topics || []) set.add(t);
    }
    return Array.from(set).sort();
  }, [summaries]);

  const fuse = useMemo(
    () =>
      new Fuse(summaries, {
        keys: [
          { name: "title", weight: 0.4 },
          { name: "author", weight: 0.15 },
          { name: "topics", weight: 0.2 },
          { name: "insight.executive_summary", weight: 0.1 },
          { name: "insight.key_ideas", weight: 0.1 },
          { name: "insight.key_quotes", weight: 0.05 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [summaries],
  );

  const filtered = useMemo(() => {
    let list = query.trim() ? fuse.search(query.trim()).map((r) => r.item) : summaries;
    if (activeTopic) list = list.filter((s) => (s.topics || []).includes(activeTopic));
    return list;
  }, [fuse, query, activeTopic, summaries]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <span className="font-grotesk text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Library
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Your second brain.
        </h1>
        <p className="max-w-2xl font-manrope text-sm text-muted-foreground">
          Searchable archive of every summary, framework, and quote you&rsquo;ve collected.
        </p>
      </header>

      <div className="rounded-2xl border border-border/70 bg-card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ideas, frameworks, quotes, creators…"
            className="h-12 pl-10"
          />
        </div>
        {allTopics.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
            <button
              onClick={() => setActiveTopic(null)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                activeTopic === null
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              All
            </button>
            {allTopics.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTopic(t === activeTopic ? null : t)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  activeTopic === t
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "insight" : "insights"}
        </span>
        <Badge variant="muted" className="text-[10px]">
          <BookmarkCheck className="mr-1 h-3 w-3" /> Auto-saved
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
          No matches. Adjust filters or summarize a new video.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SummaryCard key={s.id} summary={s} />
          ))}
        </div>
      )}
    </div>
  );
}
