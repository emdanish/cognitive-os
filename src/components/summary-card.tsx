"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, Quote, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import type { SummaryRow } from "@/lib/types";
import { formatRelative, truncate } from "@/lib/utils";
import { toast } from "sonner";

export function SummaryCard({ summary, onDelete }: { summary: SummaryRow; onDelete?: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/summaries/${summary.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || "Delete failed");
      }
      toast.success("Summary deleted");
      setDialogOpen(false);
      if (onDelete) {
        onDelete(summary.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete summary");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/insight/${summary.id}`} className="absolute inset-0 z-0" />
      
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

      <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8 rounded-lg shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Delete Summary</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this summary? This will delete the summary, daily reflections, and associated saved insights. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative z-0 flex flex-1 flex-col gap-2 p-4 pointer-events-none">
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
    </div>
  );
}

