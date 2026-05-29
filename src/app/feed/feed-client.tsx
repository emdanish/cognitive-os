"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwipeableFeed } from "@/components/swipeable-feed";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import type { FeedItemRow } from "@/lib/types";
import { toast } from "sonner";

export function FeedClient() {
  const [items, setItems] = useState<FeedItemRow[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetScope, setResetScope] = useState<"consumed" | "all">("consumed");
  const [resetOpen, setResetOpen] = useState(false);
  const [catalogExhausted, setCatalogExhausted] = useState(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const generatingRef = useRef(false);
  const itemsRef = useRef<FeedItemRow[] | null>(null);
  itemsRef.current = items;
  const lastEmptyAt = useRef<number>(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      const json = (await res.json()) as { data: FeedItemRow[] };
      setItems(json.data || []);
      if ((json.data || []).length > 0) {
        setCatalogExhausted(false);
      }
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
      setIsLoading(true);
      if (!silent) setGenerating(true);
      try {
        const res = await fetch("/api/feed/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noStore: true }),
        });
        const json = (await res.json()) as {
          data: FeedItemRow[];
          error?: string;
          meta?: {
            rss_candidates: number;
            topic_candidates: number;
            accepted: number;
            exhausted?: boolean;
            fresh_inserted?: number;
            queue_returned?: number;
            youtube_api: boolean;
            topic_search_used: boolean;
            quota_exhausted?: boolean;
            fallback_used?: boolean;
            fallback_provider?: string | null;
            fallback_instance?: string | null;
            invidious_used?: boolean;
            invidious_instance?: string | null;
            funnel_summary?: {
              scored_inserted?: number;
            };
          };
        };
        if (!res.ok) throw new Error(json.error || "Could not generate");

        const currentIds = new Set((itemsRef.current || []).map((p) => p.id));
        const fresh = (json.data || []).filter(
          (d) => d.id && !currentIds.has(d.id),
        );

        setItems((prev) => {
          if (!prev || prev.length === 0) {
            return json.data || [];
          }
          const existingIds = new Set(prev.map((p) => p.id));
          const newOnly = (json.data || []).filter(
            (d) => d.id && !existingIds.has(d.id),
          );
          if (newOnly.length === 0) {
            return prev;
          }
          return [...prev, ...newOnly];
        });

        const meta = json.meta;
        if (meta?.quota_exhausted) {
          if (meta?.fallback_used) {
            const provider = meta.fallback_provider === "invidious" ? "Invidious" : "Piped";
            const instance = meta.fallback_instance || "public instance";
            toast.info(`Using ${provider} fallback`, {
              description: `YouTube quota exhausted — serving from ${provider} (${instance}).`,
            });
            setQuotaExhausted(false);
          } else {
            setQuotaExhausted(true);
            toast.error("YouTube API quota exhausted", {
              description: "Daily quota resets at midnight Pacific Time. Try again later.",
            });
          }
        } else {
          setQuotaExhausted(false);
        }

        if (meta?.exhausted) {
          lastEmptyAt.current = Date.now();
          if (meta?.quota_exhausted) {
            setCatalogExhausted(false);
          } else {
            setCatalogExhausted(true);
          }
        } else if ((meta?.fresh_inserted ?? 0) === 0 && (meta?.funnel_summary?.scored_inserted ?? 0) < 3) {
          // Low-yield generate: cool down for 60s to avoid burning quota on near-empty pulls.
          lastEmptyAt.current = Date.now();
          setCatalogExhausted(false);
        } else {
          setCatalogExhausted(false);
        }

        if (!silent && meta) {
          const freshInserted = meta.fresh_inserted ?? 0;
          if (fresh.length > 0) {
            const sources: string[] = [];
            if (meta.rss_candidates) sources.push(`${meta.rss_candidates} from creators`);
            if (meta.topic_candidates) sources.push(`${meta.topic_candidates} from topics`);
            const description = sources.join(" · ");

            if (freshInserted > 0) {
              toast.success(`${fresh.length} new cards`, { description });
            } else {
              toast.info(`${fresh.length} more from queue`, { description });
            }
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
        setIsLoading(false);
        generatingRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    const checkHealthAndFetch = async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastEmptyAt.current < 60_000) return;
      if (generatingRef.current) return;

      try {
        const res = await fetch("/api/feed/health", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { unconsumed_count: number };
        if (json.unconsumed_count < 15) {
          void generate(true);
        }
      } catch {
        // ignore
      }
    };

    void checkHealthAndFetch();

    const interval = setInterval(() => {
      void checkHealthAndFetch();
    }, 60_000);

    return () => clearInterval(interval);
  }, [generate]);

  const handleReset = async (scope: "consumed" | "all" = "consumed") => {
    setResetting(true);
    try {
      const res = await fetch("/api/feed/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const json = (await res.json()) as { ok?: boolean; deleted?: number; error?: string };
      if (!res.ok) throw new Error(json.error || "Reset failed");
      toast.success(`Cleared ${json.deleted || 0} feed items`);
      setResetOpen(false);
      setCatalogExhausted(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const onLow = useCallback(() => {
    if (!generatingRef.current) {
      void generate(true);
    }
  }, [generate]);

  const handleExhausted = useCallback(() => {
    if (Date.now() - lastEmptyAt.current < 60_000) {
      return;
    }
    generate(false);
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
        <div className="flex gap-2">
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                Reset history
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset Feed History</DialogTitle>
                <DialogDescription>
                  This will clear your swiped feed card history. Choose how much to reset:
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 py-4">
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 cursor-pointer">
                  <input
                    type="radio"
                    name="resetScope"
                    checked={resetScope === "consumed"}
                    onChange={() => setResetScope("consumed")}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">Clear swiped (consumed) history only</div>
                    <div className="text-xs text-muted-foreground">Keep un-swiped cards currently in your feed. (Recommended)</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 cursor-pointer">
                  <input
                    type="radio"
                    name="resetScope"
                    checked={resetScope === "all"}
                    onChange={() => setResetScope("all")}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">Clear all history</div>
                    <div className="text-xs text-muted-foreground">Delete all swiped and un-swiped cards. Your queue will be completely empty.</div>
                  </div>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => handleReset(resetScope)} disabled={resetting}>
                  {resetting ? "Resetting..." : "Confirm Reset"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
        </div>
      </header>

      {items === null ? (
        <div className="flex h-[560px] items-center justify-center rounded-3xl border border-border bg-card/40">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : quotaExhausted && items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center"
        >
          <Sparkles className="mb-4 h-8 w-8 text-muted-foreground animate-pulse" />
          <h3 className="font-display text-xl font-semibold">YouTube API quota exhausted</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Daily quota resets at midnight Pacific Time. Try again later.
          </p>
        </motion.div>
      ) : catalogExhausted ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center"
        >
          <Sparkles className="mb-4 h-8 w-8 text-muted-foreground animate-pulse" />
          <h3 className="font-display text-xl font-semibold">Feed is exhausted</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            No new high-signal cards could be curated. Try resetting your swiped card history to recycle older videos, or try generating again.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => handleReset("consumed")} disabled={resetting}>
              {resetting ? "Resetting..." : "Reset swiped history"}
            </Button>
            <Button onClick={() => { setCatalogExhausted(false); generate(false); }} disabled={generating}>
              {generating ? "Curating..." : "Try again"}
            </Button>
          </div>
        </motion.div>
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
          onExhausted={handleExhausted}
          loadingMore={isLoading}
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

