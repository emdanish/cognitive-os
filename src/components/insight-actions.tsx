"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Trash2 } from "lucide-react";
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
import { toast } from "sonner";

interface InsightActionsProps {
  summaryId: string;
  sourceUrl?: string | null;
}

export function InsightActions({ summaryId, sourceUrl }: InsightActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/summaries/${summaryId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error || "Delete failed");
      }
      toast.success("Summary deleted");
      setDialogOpen(false);
      router.push("/library");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete summary");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {sourceUrl && (
        <Button asChild variant="outline" size="sm">
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" /> Source
          </a>
        </Button>
      )}
      <Button asChild size="sm">
        <a href={`/api/pdf/${summaryId}`} target="_blank" rel="noreferrer">
          <Download className="h-4 w-4" /> Export PDF
        </a>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
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
  );
}
