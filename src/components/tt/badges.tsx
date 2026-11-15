import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneClass, type Priority } from "@/lib/tooltrace";

export function StageBadge({
  name,
  index,
  className,
  size = "sm",
}: {
  name: string | undefined;
  index: number | undefined;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={cn(
        toneClass(name ? index : undefined),
        "tone-badge inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3.5 py-1 text-sm",
        className,
      )}
    >
      <span className="tone-dot size-1.5 rounded-full" />
      {name ?? "Unassigned"}
    </span>
  );
}

const priorityStyles: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-secondary text-secondary-foreground border-border",
  high: "bg-warning/15 text-warning-foreground border-warning/40 dark:text-warning",
  critical: "bg-destructive/12 text-destructive border-destructive/40",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase",
        priorityStyles[priority],
        className,
      )}
    >
      {priority}
    </span>
  );
}

export function DelayBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "animate-pulse-ring inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[11px] font-bold tracking-wide text-warning-foreground uppercase",
        className,
      )}
    >
      <AlertTriangle className="size-3" /> Delayed
    </span>
  );
}

export function ToolCode({ code, className }: { code: string; className?: string }) {
  return <span className={cn("font-mono text-sm font-semibold text-primary", className)}>{code}</span>;
}
