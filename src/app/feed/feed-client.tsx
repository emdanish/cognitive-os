"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwipeableFeed } from "@/components/swipeable-feed";
import type { FeedItemRow } from "@/lib/types";
import { toast } from "sonner";

export function FeedClient() {
  const [items, setItems] = useState<FeedItemRow[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      const json = (await res.json()) as { data: FeedItemRow[] };
      setItems(json.data || []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(
    async (silent = false) => {
      if (generatingRef.current) return;
      generatingRef.current = true;
      if (!silent) setGenerating(true);
      try {
        const res = await fetch("/api/feed/generate", { method: "POST" });
        const json = (await res.json()) as {
          data: FeedItemRow[];
          error?: string;
          meta?: {
            rss_candidates: number;
            topic_candidates: number;
            accepted: number;
            youtube_api: boolean;
            topic_search_used: boolean;
          };
        };
        if (!res.ok) throw new Error(json.error || "Could not generate");
        setItems((prev) => {
          if (!prev || prev.length === 0) return json.data || [];
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = (json.data || []).filter(
            (d) => d.id && !existingIds.has(d.id),
          );
          return [...prev, ...fresh];
        });
        if (!silent) {
          const meta = json.meta;
          if (meta) {
            const sources: string[] = [];
            if (meta.rss_candidates) sources.push(`${meta.rss_candidates} from creators`);
            if (meta.topic_candidates) sources.push(`${meta.topic_candidates} from topics`);
            toast.success(`${meta.accepted} new cards`, {
              description: sources.join(" · "),
            });
          } else {
            toast.success(`${json.data.length} new cards`);
          }
        }
      } catch (e) {
        if (!silent) {
          toast.error("Generation failed", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      } finally {
        if (!silent) setGenerating(false);
        generatingRef.current = false;
      }
    },
    [],
  );

  const onLow = useCallback(() => {
    if (!generatingRef.current) {
      void generate(true);
    }
  }, [generate]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-grotesk text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Daily feed
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Curated, no clickbait, no shorts.
          </h1>
          <p className="mt-2 max-w-xl font-manrope text-sm text-muted-foreground">
            Fresh videos pulled from your tracked creators and topic searches —
            productivity, life lessons, money, TED talks, book summaries. Swipe
            right to add to your watchlist, up for super-save (auto-summarized),
            left to skip.
          </p>
        </div>
        <Button onClick={() => generate(false)} disabled={generating} variant="outline">
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Curating
            </>
          ) : (
            <>
              <RefreshCcw className="h-4 w-4" /> Generate fresh feed
            </>
          )}
        </Button>
      </header>

      {items === null ? (
        <div className="flex h-[560px] items-center justify-center rounded-3xl border border-border bg-card/40">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center"
        >
          <Sparkles className="mb-4 h-8 w-8 text-muted-foreground" />
          <h3 className="font-display text-xl font-semibold">No feed yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Click <span className="font-medium text-foreground">Generate fresh feed</span> to
            pull today&rsquo;s high-signal content from your tracked creators and
            topics.
          </p>
        </motion.div>
      ) : (
        <SwipeableFeed
          items={items}
          onLow={onLow}
          onExhausted={() => generate(false)}
          loadingMore={generatingRef.current}
        />
      )}

      <div className="mx-auto max-w-md text-center text-xs text-muted-foreground">
        Drag, or use the buttons. <strong className="text-foreground">Swipe right</strong>{" "}
        adds to your watchlist; <strong className="text-foreground">swipe up</strong>{" "}
        super-saves and starts a summary instantly.
      </div>
    </div>
  );
}
