"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ClipboardPaste,
  Download,
  Loader2,
  Sparkles,
  Wand2,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { InsightDisplay } from "@/components/insight-display";
import { ReflectionPrompt } from "@/components/reflection-prompt";
import type { SummaryRow } from "@/lib/types";
import { extractYouTubeId } from "@/lib/utils";

export function SummarizeClient() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SummaryRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = extractYouTubeId(url);
    if (!id) {
      toast.error("That doesn't look like a YouTube URL");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setStage("Watching the video…");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = (await res.json()) as { data?: SummaryRow; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to summarize");
      setResult(json.data!);
      toast.success("Insight ready", { description: "+50 XP" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      toast.error("Could not summarize", { description: msg });
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text.trim());
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <span className="font-grotesk text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Summarize
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Drop a YouTube URL.
        </h1>
        <p className="max-w-2xl font-manrope text-base text-muted-foreground">
          Gemini watches the video and returns a structured intelligence brief — executive summary,
          key ideas, frameworks, action steps, mental models — not a generic summary.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border/70 bg-card p-3"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Youtube className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className="h-12 pl-10"
              disabled={loading}
            />
            <button
              type="button"
              onClick={paste}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Paste from clipboard"
            >
              <ClipboardPaste className="h-4 w-4" />
            </button>
          </div>
          <Button type="submit" size="lg" disabled={loading} className="h-12 px-6">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Working…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Generate insight
              </>
            )}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <span>Try:</span>
          {[
            "Hormozi pricing",
            "Ali Abdaal productivity",
            "Greg Isenberg startup ideas",
          ].map((s) => (
            <Badge key={s} variant="muted" className="text-[10px]">
              {s}
            </Badge>
          ))}
        </div>
      </form>

      {loading && <LoadingState stage={stage} />}

      {error && !loading && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && !loading && <ResultView summary={result} />}
    </div>
  );
}

function LoadingState({ stage }: { stage: string }) {
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-5"
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {stage || "Thinking…"} this usually takes 20–60 seconds.
        </span>
      </motion.div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-border/70 bg-card p-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultView({ summary }: { summary: SummaryRow }) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <span className="font-grotesk text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {summary.author || "Unknown creator"}
          </span>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            {summary.title}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(summary.topics || []).map((t) => (
              <Badge key={t} variant="muted" className="text-[10px]">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/pdf/${summary.id}`} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" /> PDF
            </a>
          </Button>
          <Button asChild size="sm">
            <Link href={`/insight/${summary.id}`}>
              Open <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </motion.div>

      <InsightDisplay insight={summary.insight} summaryId={summary.id} />
      <ReflectionPrompt summaryId={summary.id} />

      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
        <Sparkles className="mr-2 inline h-4 w-4" />
        Saved to your library. You earned <span className="font-medium text-foreground">+50 XP</span>{" "}
        today.
      </div>
    </div>
  );
}
