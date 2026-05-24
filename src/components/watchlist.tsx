"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  Star,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatRelative, truncate } from "@/lib/utils";
import { toast } from "sonner";

interface WatchlistItem {
  id: string;
  source_url: string;
  source_id: string | null;
  title: string;
  author: string | null;
  thumbnail: string | null;
  topics: string[];
  direction: "right" | "super";
  swiped_at: string;
  summarized: boolean;
  summary_id: string | null;
}

export function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[] | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/watchlist?limit=12", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { data?: WatchlistItem[] }) => {
        if (!cancelled) setItems(j.data || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function summarize(item: WatchlistItem) {
    if (item.summarized && item.summary_id) {
      router.push(`/insight/${item.summary_id}`);
      return;
    }
    setBusy((b) => ({ ...b, [item.id]: true }));
    const t = toast.loading("Summarizing…", {
      description: "Gemini is watching the video.",
    });
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.source_url }),
      });
      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Summarize failed");
      }
      toast.success("Insight ready", { id: t });
      router.push(`/insight/${json.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not summarize", {
        id: t,
      });
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[item.id];
        return n;
      });
    }
  }

  async function remove(item: WatchlistItem) {
    setItems((prev) => (prev ? prev.filter((p) => p.id !== item.id) : prev));
    try {
      await fetch(`/api/watchlist?id=${item.id}`, { method: "DELETE" });
    } catch {
      /* optimistic */
    }
  }

  if (items === null) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-6">
        <Header />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-border/70 bg-background/40 p-3">
              <Skeleton className="aspect-video w-24 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8">
        <Header />
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Nothing saved yet. Swipe right on the{" "}
          <Link href="/feed" className="text-foreground underline-offset-2 hover:underline">
            feed
          </Link>{" "}
          to add videos here for later.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6">
      <Header count={items.length} />
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {items.slice(0, 8).map((item) => {
            const isBusy = !!busy[item.id];
            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="group relative flex gap-3 rounded-2xl border border-border/70 bg-background/50 p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm"
              >
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-muted"
                  aria-label="Open video"
                >
                  {item.thumbnail ? (
                    <Image
                      src={item.thumbnail}
                      alt={item.title}
                      fill
                      sizes="128px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                  )}
                  {item.direction === "super" && (
                    <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      <Star className="h-2.5 w-2.5" /> Super
                    </div>
                  )}
                  {item.summarized && (
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      <Sparkles className="h-2.5 w-2.5" /> Done
                    </div>
                  )}
                </a>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="line-clamp-2 font-display text-sm font-semibold leading-tight tracking-tight">
                      {item.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      aria-label="Remove from watchlist"
                      className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {item.author && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {truncate(item.author, 40)}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.topics.slice(0, 2).map((t) => (
                      <Badge key={t} variant="muted" className="text-[9px]">
                        {t}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelative(item.swiped_at)}
                    </span>
                    <Button
                      size="sm"
                      variant={item.summarized ? "outline" : "default"}
                      onClick={() => summarize(item)}
                      disabled={isBusy}
                      className={cn("h-7 gap-1 px-2.5 text-[11px]")}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : item.summarized ? (
                        <>
                          Open <ArrowRight className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3 w-3" /> Summarize
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {items.length > 8 && (
        <div className="mt-4 text-right">
          <span className="text-xs text-muted-foreground">
            + {items.length - 8} more saved
          </span>
        </div>
      )}
    </div>
  );
}

function Header({ count }: { count?: number }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-grotesk text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Watchlist
        </span>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
          Saved from feed
          {count !== undefined && (
            <span className="ml-2 align-middle text-sm font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </h2>
      </div>
      <Link
        href="/feed"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Open feed <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
