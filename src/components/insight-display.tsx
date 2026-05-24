"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  CheckCircle2,
  Check,
  Copy,
  Compass,
  Flame,
  Lightbulb,
  Quote,
  Sparkles,
  Target,
  Wrench,
  Workflow,
  Zap,
  Brain,
  BookOpen,
} from "lucide-react";
import type { StructuredInsight } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  insight: StructuredInsight;
  summaryId?: string;
}

interface SectionDef {
  id: string;
  key: keyof StructuredInsight;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "text" | "bullets" | "checklist" | "models" | "quotes";
  tone?: "neutral" | "accent" | "muted";
}

const SECTIONS: SectionDef[] = [
  { id: "summary",   key: "executive_summary",            label: "Executive summary",     short: "Summary",       icon: BookOpen,      variant: "text" },
  { id: "valuable",  key: "most_valuable_insight",        label: "Most valuable insight", short: "Most valuable", icon: Flame,         variant: "text", tone: "accent" },
  { id: "ideas",     key: "key_ideas",                    label: "Key ideas",             short: "Ideas",         icon: Lightbulb,     variant: "bullets" },
  { id: "models",    key: "mental_models",                label: "Mental models",         short: "Models",        icon: Brain,         variant: "models" },
  { id: "lessons",   key: "strategic_lessons",            label: "Strategic lessons",     short: "Lessons",       icon: Compass,       variant: "bullets" },
  { id: "shifts",    key: "behavioral_shifts",            label: "Behavioral shifts",     short: "Shifts",        icon: Zap,           variant: "bullets" },
  { id: "frame",     key: "execution_frameworks",         label: "Execution frameworks",  short: "Frameworks",    icon: Workflow,      variant: "models" },
  { id: "actions",   key: "action_steps",                 label: "Action steps",          short: "Actions",       icon: CheckCircle2,  variant: "checklist", tone: "accent" },
  { id: "tactics",   key: "tactical_advice",              label: "Tactical advice",       short: "Tactics",       icon: Wrench,        variant: "bullets" },
  { id: "biz",       key: "business_opportunities",       label: "Business opportunities",short: "Opportunities", icon: Briefcase,     variant: "bullets" },
  { id: "me",        key: "applicable_to_my_life",        label: "Applicable to my life", short: "For me",        icon: Target,        variant: "bullets" },
  { id: "quotes",    key: "key_quotes",                   label: "Key quotes",            short: "Quotes",        icon: Quote,         variant: "quotes" },
];

export function InsightDisplay({ insight, summaryId }: Props) {
  const visible = useMemo(
    () =>
      SECTIONS.filter((s) => {
        const v = insight[s.key];
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "string") return v.trim().length > 0;
        return false;
      }),
    [insight],
  );

  return (
    <div className="space-y-5">
      {insight.one_insight_that_changes_everything?.trim() && (
        <HeroInsight text={insight.one_insight_that_changes_everything} />
      )}

      <SectionNav sections={visible} />

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((s, idx) => {
          const value = insight[s.key];
          const items = Array.isArray(value) ? (value as string[]) : null;
          const text = typeof value === "string" ? value : null;
          const wide = s.variant === "checklist" || s.variant === "quotes";
          return (
            <SectionCard
              key={s.id}
              s={s}
              idx={idx}
              text={text}
              items={items}
              summaryId={summaryId}
              className={wide ? "md:col-span-2" : ""}
            />
          );
        })}
      </div>
    </div>
  );
}

function HeroInsight({ text }: { text: string }) {
  return (
    <motion.section
      id="hero"
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-transparent bg-foreground p-8 text-background md:p-10"
    >
      <div className="pointer-events-none absolute -right-24 -top-32 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-background/5 blur-3xl" />

      <div className="relative">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-background/70 backdrop-blur">
          <Sparkles className="h-3 w-3" /> One insight that changes everything
        </div>
        <p className="font-display text-balance text-2xl font-semibold leading-snug tracking-tight md:text-[28px]">
          <span aria-hidden className="mr-2 align-top text-3xl text-accent md:text-4xl">
            &ldquo;
          </span>
          {text}
          <span aria-hidden className="ml-1 align-top text-3xl text-accent md:text-4xl">
            &rdquo;
          </span>
        </p>
      </div>
    </motion.section>
  );
}

function SectionNav({ sections }: { sections: SectionDef[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const ids = sections.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }

  if (sections.length <= 2) return null;

  return (
    <nav
      aria-label="Section navigation"
      className="scrollbar-none -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      {sections.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            className={cn(
              "group inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              isActive
                ? "border-foreground bg-foreground text-background shadow-sm"
                : "border-border/70 bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {s.short}
          </button>
        );
      })}
    </nav>
  );
}

function SectionCard({
  s,
  idx,
  text,
  items,
  summaryId,
  className,
}: {
  s: SectionDef;
  idx: number;
  text: string | null;
  items: string[] | null;
  summaryId?: string;
  className?: string;
}) {
  const Icon = s.icon;
  const accent = s.tone === "accent";

  const copyValue = useMemo(() => {
    if (text) return text;
    if (items) return items.map((i) => `• ${i}`).join("\n");
    return "";
  }, [text, items]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${s.label}\n\n${copyValue}`);
      toast.success(`Copied ${s.label.toLowerCase()}`);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <motion.section
      id={s.id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.45, ease: "easeOut" }}
      className={cn(
        "group relative scroll-mt-24 overflow-hidden rounded-2xl border bg-card p-6 transition-shadow",
        accent
          ? "border-foreground/20 ring-1 ring-foreground/10"
          : "border-border/70 hover:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.08)]",
        className,
      )}
    >
      {accent && (
        <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
      )}
      <div className="relative mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              accent ? "bg-accent/15 text-accent-foreground" : "bg-secondary text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="font-grotesk text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {s.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${s.label}`}
          className="rounded-lg p-1.5 text-muted-foreground/60 opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100 focus:opacity-100"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative">
        {s.variant === "text" && text && <TextBody text={text} accent={accent} />}
        {s.variant === "bullets" && items && <BulletList items={items} />}
        {s.variant === "models" && items && <ModelList items={items} />}
        {s.variant === "checklist" && items && (
          <Checklist items={items} summaryId={summaryId} sectionId={s.id} />
        )}
        {s.variant === "quotes" && items && <QuoteList items={items} />}
      </div>
    </motion.section>
  );
}

function TextBody({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <p
      className={cn(
        "font-display text-balance text-lg font-medium leading-snug",
        accent ? "text-foreground" : "text-foreground/95",
      )}
    >
      {text}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-lg p-1.5 text-[15px] leading-relaxed transition-colors hover:bg-secondary/40"
        >
          <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-foreground/60" />
          <span className="font-manrope text-foreground/90">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ModelList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const { name, body } = splitModel(item);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="rounded-xl border border-border/70 bg-background/40 p-3.5 transition-colors hover:border-foreground/30"
          >
            <div className="font-display text-[15px] font-semibold tracking-tight text-foreground">
              {name}
            </div>
            {body && (
              <p className="mt-1 font-manrope text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function splitModel(item: string): { name: string; body: string } {
  const m = item.match(/^([^—:–-]{2,80})\s*[—:–-]\s*(.+)$/);
  if (m) return { name: m[1].trim(), body: m[2].trim() };
  return { name: item, body: "" };
}

function Checklist({
  items,
  summaryId,
  sectionId,
}: {
  items: string[];
  summaryId?: string;
  sectionId: string;
}) {
  const storageKey = summaryId ? `cogos:checks:${summaryId}:${sectionId}` : null;
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  function toggle(i: number) {
    const next = { ...checked, [i]: !checked[i] };
    setChecked(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  }

  const completed = Object.values(checked).filter(Boolean).length;
  const total = items.length;

  return (
    <div>
      {hydrated && total > 0 && (
        <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <motion.div
              animate={{ width: `${(completed / total) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 26 }}
              className="h-full rounded-full bg-foreground"
            />
          </div>
          <span className="font-grotesk tabular-nums">
            {completed}/{total}
          </span>
        </div>
      )}
      <ol className="space-y-2">
        {items.map((item, i) => {
          const done = !!checked[i];
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                  done
                    ? "border-foreground/15 bg-secondary/30 text-muted-foreground"
                    : "border-border/70 bg-background/40 hover:-translate-y-px hover:shadow-sm",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
                    done
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background",
                  )}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "font-manrope text-[15px] leading-relaxed",
                    done && "line-through decoration-foreground/30",
                  )}
                >
                  <span className="mr-1.5 font-grotesk text-xs text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function QuoteList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((q, i) => (
        <motion.figure
          key={i}
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.04, duration: 0.35 }}
          className="group/quote relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background/60 to-secondary/30 p-5"
        >
          <Quote className="absolute -right-2 -top-2 h-16 w-16 rotate-12 text-foreground/[0.06]" />
          <blockquote className="relative font-display text-[15px] font-medium italic leading-snug text-foreground/90">
            &ldquo;{q}&rdquo;
          </blockquote>
          <button
            type="button"
            aria-label="Copy quote"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`"${q}"`);
                toast.success("Quote copied");
              } catch {
                toast.error("Could not copy");
              }
            }}
            className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground/60 opacity-0 transition hover:bg-secondary hover:text-foreground group-hover/quote:opacity-100"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </motion.figure>
      ))}
    </div>
  );
}
