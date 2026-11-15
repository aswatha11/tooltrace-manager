import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/tt/page-header";
import { DelayBadge, PriorityBadge, StageBadge, ToolCode } from "@/components/tt/badges";
import { stagesQuery, toolsQuery, useNow, useStageMap } from "@/lib/queries";
import { isDelayed } from "@/lib/tooltrace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tools/")({
  head: () => ({
    meta: [
      { title: "Tools & History — ToolTrace" },
      { name: "description", content: "Search every tool and open its full stage history timeline." },
      { property: "og:title", content: "Tools & History — ToolTrace" },
      { property: "og:description", content: "Searchable tooling registry with traceability timelines." },
    ],
  }),
  component: ToolsIndex,
});

function ToolsIndex() {
  const { data: tools, isLoading } = useQuery(toolsQuery);
  const { data: stages } = useQuery(stagesQuery);
  const stageMap = useStageMap(stages);
  const now = useNow();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string | null>(null);

  const list = (tools ?? []).filter((t) => {
    if (stage && t.current_stage_id !== stage) return false;
    const term = q.trim().toLowerCase();
    return !term || [t.tool_code, t.name, t.type, t.description].some((v) => v.toLowerCase().includes(term));
  });

  return (
    <>
      <PageHeader
        eyebrow="Traceability"
        title="Tools & History"
        description="Open any tool to see every stage it passed through, who moved it and when."
        actions={
          <Button asChild variant="hero" size="xl">
            <Link to="/tools/new">
              <PlusCircle /> Add tool
            </Link>
          </Button>
        }
      />
      <div className="relative">
        <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by Tool ID, name, type or description" className="h-14 rounded-xl bg-card pl-12 text-base" />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Chip active={!stage} onClick={() => setStage(null)}>All</Chip>
        {(stages ?? []).map((s) => (
          <Chip key={s.id} active={stage === s.id} onClick={() => setStage(stage === s.id ? null : s.id)}>
            {s.name}
          </Chip>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        {list.map((t) => {
          const s = t.current_stage_id ? stageMap.get(t.current_stage_id) : undefined;
          return (
            <Link
              key={t.id}
              to="/tools/$code"
              params={{ code: t.tool_code }}
              className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-ring"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ToolCode code={t.tool_code} />
                  <PriorityBadge priority={t.priority} />
                  {isDelayed(t, s?.stage, now) && <DelayBadge />}
                </div>
                <p className="mt-1 truncate text-lg font-semibold">{t.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StageBadge name={s?.stage.name} index={s?.index} />
                  <span>{t.type}</span>
                  <span>· updated {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</span>
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
      {tools && list.length === 0 && <p className="py-12 text-center text-muted-foreground">No tools found.</p>}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
