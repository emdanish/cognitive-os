import Link from "next/link";
import {
  ArrowRight,
  BookmarkCheck,
  Flame,
  Layers,
  PenLine,
  Sparkles,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { SummaryCard } from "@/components/summary-card";
import { Watchlist } from "@/components/watchlist";
import { getDashboardData } from "@/lib/dashboard";
import { levelFromXp } from "@/lib/xp";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  const lvl = levelFromXp(data.xp.total);

  return (
    <div className="space-y-10">
      <Hero level={lvl} xp={data.xp} />

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Streak"
          value={data.streak.current}
          hint={`Longest ${data.streak.longest} days`}
          icon={Flame}
          accent
        />
        <StatCard
          label="Summaries"
          value={data.totals.summaries}
          hint="All time"
          icon={Sparkles}
        />
        <StatCard
          label="Saved insights"
          value={data.totals.saved}
          hint="Quotes, frameworks, ideas"
          icon={BookmarkCheck}
        />
        <StatCard
          label="Reflections"
          value={data.totals.reflections}
          hint="Recorded actions"
          icon={PenLine}
        />
      </section>

      <QuickActions />

      <TodaysUpgrade summary={data.todaysUpgrade} />

      <Watchlist />

      <section>
        <SectionHeader title="Recent summaries" href="/library" cta="Open library" />
        {data.recentSummaries.length === 0 ? (
          <EmptyHint
            icon={<Sparkles className="h-5 w-5" />}
            title="Your intelligence library is empty"
            description="Paste a YouTube URL on the Summarize page to generate your first structured insight."
            href="/summarize"
            cta="Summarize a video"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentSummaries.slice(0, 6).map((s) => (
              <SummaryCard key={s.id} summary={s} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <FeedPreview items={data.freshFeed.length} />
        <RecentReflections items={data.recentReflections} />
      </section>
    </div>
  );
}

function Hero({
  level,
  xp,
}: {
  level: { level: number; label: string; toNext: number; progress: number };
  xp: { total: number; today: number };
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-8 md:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-24 h-72 w-72 rounded-full bg-foreground/5 blur-3xl" />

      <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Cognitive OS · {level.label}
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            Turn information into leverage.
          </h1>
          <p className="mt-4 max-w-xl font-manrope text-base leading-relaxed text-muted-foreground md:text-lg">
            A private feed, a strategic mentor, and an execution log — built around the
            creators and ideas that actually compound.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href="/summarize">
                <Wand2 className="h-4 w-4" /> Summarize a video
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/feed">
                <Layers className="h-4 w-4" /> Open feed
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/40 p-5 md:w-72">
          <div className="flex items-center justify-between">
            <span className="font-grotesk text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Mental upgrade level
            </span>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold">L{level.level}</span>
            <span className="text-sm text-muted-foreground">{level.label}</span>
          </div>
          <Progress value={level.progress * 100} className="mt-3" />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{xp.total.toLocaleString()} XP total</span>
            <span>{level.toNext > 0 ? `${level.toNext} XP to next` : "Max"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickActions() {
  const actions = [
    {
      href: "/summarize",
      title: "Summarize",
      hint: "Drop a YouTube URL",
      icon: Wand2,
    },
    { href: "/feed", title: "Today's feed", hint: "Swipe to tune", icon: Layers },
    { href: "/library", title: "Library", hint: "Search your second brain", icon: BookmarkCheck },
  ];
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center justify-between rounded-2xl border border-border/70 bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="font-display text-base font-semibold tracking-tight">
                  {a.title}
                </div>
                <div className="text-xs text-muted-foreground">{a.hint}</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        );
      })}
    </section>
  );
}

function TodaysUpgrade({ summary }: { summary: import("@/lib/types").SummaryRow | null }) {
  if (!summary) return null;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-foreground p-8 text-background">
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
      <span className="font-grotesk text-[11px] uppercase tracking-[0.18em] text-background/70">
        Today&rsquo;s mental upgrade
      </span>
      <h2 className="mt-3 text-balance font-display text-2xl font-semibold leading-snug md:text-3xl">
        {summary.insight?.one_insight_that_changes_everything ||
          summary.insight?.most_valuable_insight ||
          summary.title}
      </h2>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-background/80">
        From <span className="font-semibold">{summary.author || summary.title}</span>
      </p>
      <Button asChild variant="accent" className="mt-6">
        <Link href={`/insight/${summary.id}`}>
          Open full brief <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}

function FeedPreview({ items }: { items: number }) {
  return (
    <Link
      href="/feed"
      className="group flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div>
        <span className="font-grotesk text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Daily feed
        </span>
        <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">
          {items > 0
            ? `${items} fresh ${items === 1 ? "card" : "cards"} waiting`
            : "Generate today's feed"}
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Curated YouTube and article recommendations. Swipe right to save, super for
          life-changing.
        </p>
      </div>
      <div className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-foreground">
        Open feed{" "}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function RecentReflections({
  items,
}: {
  items: import("@/lib/types").ReflectionRow[];
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6">
      <span className="font-grotesk text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Recent reflections
      </span>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No reflections yet. After every summary, write one specific thing you&rsquo;ll apply.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
              <p className="text-sm leading-relaxed text-foreground/90">{r.answer}</p>
              <span className="text-[11px] text-muted-foreground">
                {formatRelative(r.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  href,
  cta,
}: {
  title: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function EmptyHint({
  icon,
  title,
  description,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-8">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
        {icon}
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild size="sm" className="mt-1">
        <Link href={href}>
          {cta} <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
