import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ScanLine, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/tt/page-header";
import { PriorityBadge, StageBadge, ToolCode } from "@/components/tt/badges";
import { stagesQuery, toolsQuery, useMe, useNow, useStageMap } from "@/lib/queries";
import { delayRatio, formatDuration, hoursBetween, isDelayed } from "@/lib/tooltrace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Delay Alerts — ToolTrace" },
      { name: "description", content: "Tools that have stayed in a stage longer than its time limit." },
      { property: "og:title", content: "Delay Alerts — ToolTrace" },
      { property: "og:description", content: "Spot tools stuck in a stage before they hold up production." },
    ],
  }),
  component: Alerts,
});

function Alerts() {
  const { data: tools, isLoading } = useQuery(toolsQuery);
  const { data: stages } = useQuery(stagesQuery);
  const stageMap = useStageMap(stages);
  const now = useNow(30_000);
  const me = useMe();

  const withStage = (tools ?? []).map((t) => ({ t, s: t.current_stage_id ? stageMap.get(t.current_stage_id) : undefined }));
  const delayed = withStage
    .filter(({ t, s }) => isDelayed(t, s?.stage, now))
    .sort((a, b) => delayRatio(b.t, b.s?.stage, now) - delayRatio(a.t, a.s?.stage, now));
  const atRisk = withStage
    .filter(({ t, s }) => !isDelayed(t, s?.stage, now) && delayRatio(t, s?.stage, now) >= 0.75)
    .sort((a, b) => delayRatio(b.t, b.s?.stage, now) - delayRatio(a.t, a.s?.stage, now));

  return (
    <>
      <PageHeader
        eyebrow="Watchlist"
        title="Delay alerts"
        description="Tools that stayed longer than the time limit set for their stage."
        actions={
          me?.role === "admin" ? (
            <Button asChild variant="outline" size="xl">
              <Link to="/settings">
                <Settings /> Set time limits
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {(stages ?? []).map((s, i) => (
          <span key={s.id} className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
            <StageBadge name={s.name} index={i} />
            <span className="text-muted-foreground">{s.max_hours ? `${s.max_hours}h limit` : "no limit"}</span>
          </span>
        ))}
      </div>

      {isLoading && <Skeleton className="h-48 rounded-2xl" />}

      {tools && delayed.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border bg-card p-12 text-center shadow-card">
          <CheckCircle2 className="size-14 text-success" />
          <h2 className="mt-3 text-2xl font-bold">No delayed tools</h2>
          <p className="text-muted-foreground">Every tool is within its stage time limit.</p>
        </div>
      )}

      {delayed.length > 0 && (
        <section>
          <div className="hazard-stripe mb-3 h-1.5 rounded-full" />
          <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold">
            <AlertTriangle className="text-warning" /> Overdue ({delayed.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {delayed.map(({ t, s }) => <AlertCard key={t.id} tool={t} s={s} now={now} overdue />)}
          </div>
        </section>
      )}

      {atRisk.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold">Approaching limit ({atRisk.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {atRisk.map(({ t, s }) => <AlertCard key={t.id} tool={t} s={s} now={now} />)}
          </div>
        </section>
      )}
    </>
  );
}

type Row = ReturnType<typeof useStageMap> extends Map<string, infer V> ? V : never;

function AlertCard({
  tool,
  s,
  now,
  overdue,
}: {
  tool: { id: string; tool_code: string; name: string; priority: "low" | "medium" | "high" | "critical"; stage_entered_at: string; current_stage_id: string | null };
  s: Row | undefined;
  now: Date;
  overdue?: boolean;
}) {
  const hours = hoursBetween(tool.stage_entered_at, now);
  const limit = s?.stage.max_hours ?? 0;
  const ratio = limit ? hours / limit : 0;
  return (
    <div className={cn("rounded-xl border-2 bg-card p-5 shadow-card", overdue ? "border-warning" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ToolCode code={tool.tool_code} />
            <PriorityBadge priority={tool.priority} />
          </div>
          <Link to="/tools/$code" params={{ code: tool.tool_code }} className="mt-0.5 block truncate text-lg font-semibold hover:underline">
            {tool.name}
          </Link>
        </div>
        <StageBadge name={s?.stage.name} index={s?.index} />
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span className="font-semibold">{formatDuration(hours)} in stage</span>
          <span className="text-muted-foreground">limit {limit}h</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", overdue ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
        {overdue && <p className="mt-1.5 text-sm font-semibold text-warning-foreground dark:text-warning">{formatDuration(hours - limit)} over limit</p>}
      </div>
      <Button asChild variant={overdue ? "warning" : "outline"} size="xl" className="mt-4 w-full">
        <Link to="/update" search={{ code: tool.tool_code }}>
          <ScanLine /> Update status
        </Link>
      </Button>
    </div>
  );
}
