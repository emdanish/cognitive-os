"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  Heart,
  Star,
  X,
  ExternalLink,
  Sparkles,
  RefreshCcw,
  PlayCircle,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FeedItemRow } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  items: FeedItemRow[];
  onLow?: () => void;
  onExhausted?: () => void;
  loadingMore?: boolean;
}

const SWIPE_THRESHOLD = 120;
const LOW_THRESHOLD = 4;

export function SwipeableFeed({ items, onLow, onExhausted, loadingMore }: Props) {
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const lowFiredFor = useRef<string>("");

  const stack = useMemo(
    () => items.filter((it) => !swipedIds.has(it.id)),
    [items, swipedIds],
  );

  useEffect(() => {
    const ids = items.map((i) => i.id).join("|");
    if (ids !== lowFiredFor.current) {
      lowFiredFor.current = "";
    }
  }, [items]);

  useEffect(() => {
    if (
      onLow &&
      stack.length > 0 &&
      stack.length <= LOW_THRESHOLD &&
      lowFiredFor.current !== stack[0]?.id
    ) {
      lowFiredFor.current = stack[0]?.id || "";
      onLow();
    }
    if (onExhausted && stack.length === 0 && items.length > 0) {
      onExhausted();
    }
  }, [stack, onLow, onExhausted, items.length]);

  async function recordSwipe(
    item: FeedItemRow,
    direction: "left" | "right" | "super",
  ) {
    try {
      await fetch("/api/swipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feed_item_id: item.id,
          source_url: item.source_url,
          direction,
          topics: item.topics ?? [],
        }),
      });
    } catch {
      /* fail silently */
    }
  }

  function handleSwipe(item: FeedItemRow, direction: "left" | "right" | "super") {
    setSwipedIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    recordSwipe(item, direction);

    if (direction === "right") {
      toast.success("Added to Watchlist", {
        description: "Find it on your dashboard.",
      });
    }
    if (direction === "super") {
      toast.success("Super-saved", {
        description: "Heavily weighted in your feed + summarizing now…",
      });
      // Fire-and-forget summarize
      fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.source_url }),
      }).catch(() => {
        /* user gets the result in their library */
      });
    }
  }

  if (stack.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center">
        {loadingMore ? (
          <>
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <h3 className="font-display text-xl font-semibold">Curating more…</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Pulling fresh, high-signal videos from your topics.
            </p>
          </>
        ) : (
          <>
            <Sparkles className="mb-4 h-8 w-8 text-muted-foreground" />
            <h3 className="font-display text-xl font-semibold">
              Caught up for now
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Generate more high-signal content tuned to what you swiped.
            </p>
            <Button className="mt-6" onClick={() => onExhausted?.()}>
              <RefreshCcw className="h-4 w-4" /> Generate more
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative mx-auto h-[560px] w-full max-w-md select-none">
      <AnimatePresence>
        {stack
          .slice(0, 3)
          .reverse()
          .map((item, idx, arr) => {
            const isTop = idx === arr.length - 1;
            const offset = (arr.length - 1 - idx) * 8;
            const scale = 1 - (arr.length - 1 - idx) * 0.04;
            return (
              <SwipeCard
                key={item.id}
                item={item}
                isTop={isTop}
                offset={offset}
                scale={scale}
                onSwipe={(d) => handleSwipe(item, d)}
              />
            );
          })}
      </AnimatePresence>
      {loadingMore && stack.length <= LOW_THRESHOLD && (
        <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading more
          </span>
        </div>
      )}
    </div>
  );
}

function SwipeCard({
  item,
  isTop,
  offset,
  scale,
  onSwipe,
}: {
  item: FeedItemRow;
  isTop: boolean;
  offset: number;
  scale: number;
  onSwipe: (d: "left" | "right" | "super") => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  const likeOpacity = useTransform(x, [40, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -40], [1, 0]);
  const superOpacity = useTransform(y, [-150, -40], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y < -SWIPE_THRESHOLD && Math.abs(info.offset.x) < 100) {
      onSwipe("super");
      return;
    }
    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipe("right");
      return;
    }
    if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipe("left");
      return;
    }
  }

  return (
    <motion.div
      className="absolute inset-0"
      drag={isTop}
      dragElastic={0.2}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      style={{ x, y, rotate, scale }}
      initial={{ y: offset, scale }}
      animate={{ y: offset, scale }}
      exit={{
        x: x.get() > 0 ? 600 : x.get() < 0 ? -600 : 0,
        y: y.get() < -100 ? -800 : 0,
        opacity: 0,
        transition: { duration: 0.3 },
      }}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: "grabbing" }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        {item.thumbnail && (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <Image
              src={item.thumbnail}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
            {item.source_type === "youtube" && (
              <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                <PlayCircle className="h-3 w-3" /> YouTube
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 p-5">
          <h3 className="font-display text-xl font-semibold leading-snug tracking-tight">
            {item.title}
          </h3>
          {item.author && (
            <p className="text-sm text-muted-foreground">{item.author}</p>
          )}
          {item.description && (
            <p className="line-clamp-3 text-sm text-foreground/80">
              {item.description}
            </p>
          )}
          {item.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.topics.slice(0, 4).map((t) => (
                <Badge key={t} variant="muted" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" /> Open source
          </a>
        </div>

        <motion.div
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute left-5 top-5 rounded-md border-2 border-emerald-500 px-3 py-1 font-display text-base font-bold uppercase text-emerald-500"
        >
          Save
        </motion.div>
        <motion.div
          style={{ opacity: nopeOpacity }}
          className="pointer-events-none absolute right-5 top-5 rounded-md border-2 border-rose-500 px-3 py-1 font-display text-base font-bold uppercase text-rose-500"
        >
          Skip
        </motion.div>
        <motion.div
          style={{ opacity: superOpacity }}
          className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-md border-2 border-amber-500 px-3 py-1 font-display text-base font-bold uppercase text-amber-500"
        >
          Super
        </motion.div>

        {isTop && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-4">
            <button
              onClick={() => onSwipe("left")}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-rose-500 shadow-sm transition hover:scale-105"
              aria-label="Skip"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={() => onSwipe("super")}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-amber-500 shadow-sm transition hover:scale-105"
              aria-label="Super save"
              type="button"
            >
              <Star className="h-5 w-5" />
            </button>
            <button
              onClick={() => onSwipe("right")}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-emerald-500 shadow-sm transition hover:scale-105"
              aria-label="Save"
              type="button"
            >
              <Heart className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
