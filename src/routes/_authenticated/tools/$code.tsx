import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Clock, MessageSquare, ScanLine, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DelayBadge, PriorityBadge, StageBadge } from "@/components/tt/badges";
import { ToolQr } from "@/components/tt/tool-qr";
import { supabase } from "@/integrations/supabase/client";
import { stagesQuery, toolByCodeQuery, toolEventsQuery, useMe, useNow, useStageMap } from "@/lib/queries";
import { formatDuration, hoursBetween, isDelayed, toneClass } from "@/lib/tooltrace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tools/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.code} history — ToolTrace` },
      { name: "description", content: `Full stage history and traceability timeline for tool ${params.code}.` },
      { property: "og:title", content: `${params.code} history — ToolTrace` },
      { property: "og:description", content: `Traceability timeline for tool ${params.code}.` },
    ],
  }),
  component: ToolDetail,
});

function ToolDetail() {
  const { code } = Route.useParams();
  const me = useMe();
  const now = useNow();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: tool, isLoading } = useQuery(toolByCodeQuery(code));
  const { data: stages } = useQuery(stagesQuery);
  const { data: events } = useQuery(toolEventsQuery(tool?.id));
  const stageMap = useStageMap(stages);

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (!tool)
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-bold">Tool not found</h1>
        <p className="mt-2 text-muted-foreground">No tool with ID {code}.</p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/tools">Back to tools</Link>
        </Button>
      </div>
    );

  const cur = tool.current_stage_id ? stageMap.get(tool.current_stage_id) : undefined;
  const delayed = isDelayed(tool, cur?.stage, now);
  const visited = new Set((events ?? []).map((e) => e.stage_id));
  const timeline = [...(events ?? [])].reverse();

  const remove = async () => {
    const { error } = await supabase.from("tools").delete().eq("id", tool.id);
    if (error) return toast.error(error.message);
    toast.success(`${tool.tool_code} deleted`);
    qc.invalidateQueries({ queryKey: ["tools"] });
    navigate({ to: "/tools" });
  };

  return (
    <>
      <Button asChild variant="ghost" className="-ml-3 mb-3">
        <Link to="/tools">
          <ArrowLeft /> All tools
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-6 shadow-card lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xl font-bold text-primary">{tool.tool_code}</span>
            <PriorityBadge priority={tool.priority} />
            {delayed && <DelayBadge />}
          </div>
          <h1 className="mt-1 text-4xl font-bold">{tool.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {tool.type}
            {tool.description && ` · ${tool.description}`}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <StageBadge name={cur?.stage.name} index={cur?.index} size="lg" />
            <span className="text-muted-foreground">
              for {formatDuration(hoursBetween(tool.stage_entered_at, now))}
              {cur?.stage.max_hours ? ` (limit ${cur.stage.max_hours}h)` : ""}
            </span>
          </div>

          {/* Stage progress */}
          <ol className="mt-6 flex gap-1.5">
            {(stages ?? []).map((s, i) => {
              const isCur = s.id === tool.current_stage_id;
              const done = visited.has(s.id) && !isCur;
              return (
                <li key={s.id} className={cn(toneClass(i), "flex-1")}>
                  <div className={cn("h-2 rounded-full", isCur || done ? "tone-dot" : "bg-muted", done && "opacity-50")} />
                  <p className={cn("mt-1.5 hidden truncate text-xs sm:block", isCur ? "font-bold" : "text-muted-foreground")}>{s.name}</p>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild variant="hero" size="xl">
              <Link to="/update" search={{ code: tool.tool_code }}>
                <ScanLine /> Update status
              </Link>
            </Button>
            {me?.role === "admin" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="xl" className="text-destructive">
                    <Trash2 /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {tool.tool_code}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the tool and its entire history. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </section>

        <section className="flex flex-col items-center justify-center rounded-2xl border bg-card p-6 shadow-card">
          <ToolQr code={tool.tool_code} name={tool.name} />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Registered {format(new Date(tool.created_at), "d MMM yyyy, HH:mm")}
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="text-2xl font-bold">Traceability timeline</h2>
        <p className="text-sm text-muted-foreground">{events?.length ?? 0} recorded stage changes</p>
        <ol className="relative mt-6 ml-3 border-l-2 border-border">
          {timeline.map((e, idx) => {
            const st = e.stage_id ? stageMap.get(e.stage_id) : undefined;
            const nextAt = idx === 0 ? now.toISOString() : timeline[idx - 1].created_at;
            const spent = (new Date(nextAt).getTime() - new Date(e.created_at).getTime()) / 36e5;
            return (
              <li key={e.id} className={cn(toneClass(st?.index), "relative pb-8 pl-8 last:pb-0")}>
                <span className={cn("tone-dot absolute top-1 -left-[9px] size-4 rounded-full ring-4 ring-card", idx === 0 && "animate-pulse-ring")} />
                <div className="flex flex-wrap items-center gap-2">
                  <StageBadge name={e.stage_name || "Removed stage"} index={st?.index} />
                  {e.from_stage_name && <span className="text-xs text-muted-foreground">from {e.from_stage_name}</span>}
                  {idx === 0 && <span className="text-xs font-bold tracking-wider text-primary uppercase">Current</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5"><User className="size-4 text-muted-foreground" /> {e.operator_name}</span>
                  <span className="flex items-center gap-1.5"><Clock className="size-4 text-muted-foreground" /> {format(new Date(e.created_at), "d MMM yyyy, HH:mm")}</span>
                  <span className="text-muted-foreground">{idx === 0 ? "in stage" : "spent"} {formatDuration(spent)}</span>
                </div>
                {e.remarks && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm">
                    <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {e.remarks}
                  </p>
                )}
              </li>
            );
          })}
          {events && events.length === 0 && <li className="pl-8 text-muted-foreground">No history yet.</li>}
        </ol>
      </section>
    </>
  );
}
