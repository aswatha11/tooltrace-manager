import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Boxes, ScanLine, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, LiveDot } from "@/components/tt/page-header";
import { DelayBadge, PriorityBadge, StageBadge, ToolCode } from "@/components/tt/badges";
import { recentEventsQuery, stagesQuery, toolsQuery, useNow, useStageMap } from "@/lib/queries";
import { formatDuration, hoursBetween, isDelayed, toneClass } from "@/lib/tooltrace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ToolTrace" },
      { name: "description", content: "Live overview of all tools and their current process stage." },
      { property: "og:title", content: "Dashboard — ToolTrace" },
      { property: "og:description", content: "Live overview of tooling stages." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stages } = useQuery(stagesQuery);
  const { data: tools, isLoading } = useQuery(toolsQuery);
  const { data: recent } = useQuery(recentEventsQuery);
  const stageMap = useStageMap(stages);
  const now = useNow();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    (tools ?? []).forEach((t) => {
      const k = t.current_stage_id ?? "none";
      c.set(k, (c.get(k) ?? 0) + 1);
    });
    return c;
  }, [tools]);

  const delayedCount = (tools ?? []).filter((t) =>
    isDelayed(t, t.current_stage_id ? stageMap.get(t.current_stage_id)?.stage : undefined, now),
  ).length;

  const chartData = (stages ?? []).map((s, i) => ({ name: s.name, count: counts.get(s.id) ?? 0, i }));

  const filtered = (tools ?? []).filter((t) => {
    if (stageFilter && t.current_stage_id !== stageFilter) return false;
    if (!q) return true;
    const term = q.toLowerCase();
    return [t.tool_code, t.name, t.type].some((v) => v.toLowerCase().includes(term));
  });

  return (
    <>
      <PageHeader
        eyebrow="Shop floor overview"
        title="Dashboard"
        actions={
          <>
            <LiveDot />
            <Button asChild variant="hero" size="xl">
              <Link to="/update" search={{ code: undefined }}>
                <ScanLine /> Update status
              </Link>
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <StatCard
          label="Total tools"
          value={tools?.length}
          icon={<Boxes className="size-4" />}
          className="col-span-2 bg-gradient-steel text-steel-foreground sm:col-span-1"
          onClick={() => setStageFilter(null)}
          active={stageFilter === null}
        />
        {(stages ?? []).map((s, i) => (
          <StatCard
            key={s.id}
            label={s.name}
            value={counts.get(s.id) ?? 0}
            tone={toneClass(i)}
            onClick={() => setStageFilter(stageFilter === s.id ? null : s.id)}
            active={stageFilter === s.id}
          />
        ))}
        <Link
          to="/alerts"
          className={cn(
            "flex flex-col justify-between rounded-xl border p-4 shadow-card transition-transform hover:-translate-y-0.5",
            delayedCount > 0 ? "border-warning bg-warning/15" : "bg-card",
          )}
        >
          <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            <AlertTriangle className="size-4 text-warning" /> Delayed
          </span>
          <span className="font-display mt-2 text-4xl font-bold">{tools ? delayedCount : "–"}</span>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border bg-card p-5 shadow-card xl:col-span-2">
          <h2 className="text-xl font-bold">Tools per stage</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
                />
                <Bar dataKey="count" name="Tools" radius={[6, 6, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={`var(--stage-${(d.i % 8) + 1})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="text-xl font-bold">Recent activity</h2>
          <ul className="mt-3 divide-y">
            {(recent ?? []).map((e) => (
              <li key={e.id} className="py-2.5">
                <Link to="/tools/$code" params={{ code: e.tools?.tool_code ?? "" }} className="block hover:opacity-80">
                  <div className="flex items-center justify-between gap-2">
                    <ToolCode code={e.tools?.tool_code ?? ""} />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="font-semibold">{e.operator_name}</span>{" "}
                    <span className="text-muted-foreground">moved to</span> <span className="font-semibold">{e.stage_name}</span>
                  </p>
                </Link>
              </li>
            ))}
            {!recent && <Skeleton className="h-40" />}
          </ul>
        </section>
      </div>

      {/* Tools table */}
      <section className="mt-6 rounded-xl border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold">
            All tools{" "}
            {stageFilter && (
              <button className="ml-2 align-middle text-sm font-normal text-primary hover:underline" onClick={() => setStageFilter(null)}>
                (clear stage filter)
              </button>
            )}
          </h2>
          <div className="relative sm:w-72">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, name or type" className="h-11 pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Tool ID</th>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Type</th>
                <th className="px-5 py-3 font-semibold">Priority</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold">In stage</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-3"><Skeleton className="h-6" /></td>
                  </tr>
                ))}
              {filtered.map((t) => {
                const s = t.current_stage_id ? stageMap.get(t.current_stage_id) : undefined;
                const delayed = isDelayed(t, s?.stage, now);
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate({ to: "/tools/$code", params: { code: t.tool_code } })}
                    className={cn("cursor-pointer transition-colors hover:bg-accent/50", delayed && "bg-warning/8")}
                  >
                    <td className="px-5 py-3"><ToolCode code={t.tool_code} /></td>
                    <td className="px-5 py-3 font-medium">{t.name}</td>
                    <td className="hidden px-5 py-3 text-muted-foreground md:table-cell">{t.type}</td>
                    <td className="px-5 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-5 py-3"><StageBadge name={s?.stage.name} index={s?.index} /></td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="mr-2 tabular-nums">{formatDuration(hoursBetween(t.stage_entered_at, now))}</span>
                      {delayed && <DelayBadge />}
                    </td>
                  </tr>
                );
              })}
              {tools && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No tools match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  className,
  onClick,
  active,
}: {
  label: string;
  value: number | undefined;
  icon?: ReactNode;
  tone?: string;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        tone,
        "flex flex-col justify-between rounded-xl border bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5",
        tone && "border-t-4 tone-border",
        active && tone && "tone-fill ring-2 ring-ring",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase opacity-70">
        {icon}
        {label}
      </span>
      <span className="font-display mt-2 text-4xl font-bold">{value ?? "–"}</span>
    </button>
  );
}
