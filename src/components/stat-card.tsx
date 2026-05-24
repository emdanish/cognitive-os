import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, accent, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
        accent && "bg-foreground text-background border-transparent",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-grotesk text-[11px] uppercase tracking-[0.14em]",
            accent ? "text-background/70" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 transition-transform group-hover:scale-110",
              accent ? "text-background/70" : "text-muted-foreground",
            )}
          />
        )}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <p
          className={cn(
            "mt-1 text-xs",
            accent ? "text-background/60" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
