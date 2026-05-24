"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  summaryId: string;
  initial?: string | null;
}

export function ReflectionPrompt({ summaryId, initial }: Props) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(Boolean(initial));
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary_id: summaryId,
          prompt: "What will you apply today?",
          answer: value.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      toast.success("Reflection saved", { description: "+25 XP" });
    } catch {
      toast.error("Could not save reflection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-2xl border border-border/70 bg-card p-6"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </span>
        <h3 className="font-grotesk text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Reflection
        </h3>
      </div>
      <p className="font-display text-xl font-semibold tracking-tight">
        What will you apply today?
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        One sentence. Make it specific enough that you&rsquo;ll know tonight whether you did it.
      </p>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="Today I will…"
        className="mt-4 min-h-[110px] font-manrope"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          ) : (
            "Stored privately in your library."
          )}
        </span>
        <Button onClick={save} disabled={loading || !value.trim()} size="sm">
          {loading ? "Saving…" : saved ? "Update" : "Save reflection"}
        </Button>
      </div>
    </motion.section>
  );
}
