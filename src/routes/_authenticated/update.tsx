import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, History, Loader2, QrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DelayBadge, PriorityBadge, StageBadge, ToolCode } from "@/components/tt/badges";
import { QrScanner } from "@/components/tt/qr-scanner";
import { supabase } from "@/integrations/supabase/client";
import { stagesQuery, toolsQuery, useMe, useNow, useStageMap, type Tool } from "@/lib/queries";
import { formatDuration, hoursBetween, isDelayed, nextStage, parseScannedCode, toneClass } from "@/lib/tooltrace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/update")({
  validateSearch: (s: Record<string, unknown>): { code?: string } => ({
    code: typeof s.code === "string" && s.code ? s.code.toUpperCase() : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Update Status — ToolTrace" },
      { name: "description", content: "Scan a tool and tap the next stage to update its status." },
      { property: "og:title", content: "Update Status — ToolTrace" },
      { property: "og:description", content: "Shop-floor stage updates in a tap." },
    ],
  }),
  component: UpdateStatus,
});

const QUICK_REMARKS = ["OK — no issues", "Rework required", "Waiting for material", "Quality hold", "Urgent", "Shift handover"];

function UpdateStatus() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: tools } = useQuery(toolsQuery);
  const { data: stages } = useQuery(stagesQuery);
  const stageMap = useStageMap(stages);
  const me = useMe();
  const now = useNow();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ code: string; stage: string } | null>(null);

  const selected: Tool | undefined = search.code ? tools?.find((t) => t.tool_code === search.code) : undefined;

  useEffect(() => {
    if (!selected || !stages) return;
    setTarget(nextStage(stages, selected.current_stage_id)?.id ?? null);
    setRemarks("");
  }, [selected?.id, selected?.current_stage_id, stages]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (code: string | undefined) => {
    setDone(null);
    navigate({ search: { code } });
  };

  const onScan = useCallback(
    (text: string) => {
      setScanning(false);
      const code = parseScannedCode(text);
      setDone(null);
      navigate({ search: { code } });
    },
    [navigate],
  );

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = tools ?? [];
    if (!term) return list.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);
    return list.filter((t) => t.tool_code.toLowerCase().includes(term) || t.name.toLowerCase().includes(term)).slice(0, 12);
  }, [q, tools]);

  const save = async () => {
    if (!selected || !target || !me) return;
    setSaving(true);
    const { error } = await supabase.from("tool_events").insert({
      tool_id: selected.id,
      stage_id: target,
      remarks: remarks.trim() || null,
      operator_id: me.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save: " + error.message);
      return;
    }
    const stageName = stages?.find((s) => s.id === target)?.name ?? "";
    qc.invalidateQueries({ queryKey: ["tools"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["tool"] });
    setDone({ code: selected.tool_code, stage: stageName });
    toast.success(`${selected.tool_code} moved to ${stageName}`);
    navigate({ search: { code: undefined } });
    setQ("");
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
        <div className="grid size-24 place-items-center rounded-full bg-success text-success-foreground shadow-elevated">
          <Check className="size-12" strokeWidth={3} />
        </div>
        <h1 className="mt-6 text-4xl font-bold">Saved</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          <span className="font-mono font-bold text-foreground">{done.code}</span> is now in{" "}
          <span className="font-bold text-foreground">{done.stage}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Recorded by {me?.name} · {new Date().toLocaleString()}
        </p>
        <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
          <Button variant="hero" size="touch" onClick={() => setDone(null)}>
            <QrCode /> Next tool
          </Button>
          <Button asChild variant="outline" size="touch">
            <Link to="/tools/$code" params={{ code: done.code }}>
              <History /> View history
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (search.code && tools && !selected) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <h1 className="text-3xl font-bold">Tool not found</h1>
        <p className="mt-2 text-muted-foreground">
          No tool with ID <span className="font-mono font-bold">{search.code}</span>.
        </p>
        <Button className="mt-6" variant="hero" size="touch" onClick={() => select(undefined)}>
          <ArrowLeft /> Search again
        </Button>
      </div>
    );
  }

  if (selected) {
    const cur = selected.current_stage_id ? stageMap.get(selected.current_stage_id) : undefined;
    const delayed = isDelayed(selected, cur?.stage, now);
    const next = nextStage(stages ?? [], selected.current_stage_id);
    return (
      <div className="mx-auto max-w-3xl">
        <Button variant="ghost" size="xl" className="-ml-3 mb-3" onClick={() => select(undefined)}>
          <ArrowLeft /> Choose another tool
        </Button>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <ToolCode code={selected.tool_code} className="text-xl" />
            <PriorityBadge priority={selected.priority} />
            {delayed && <DelayBadge />}
          </div>
          <h1 className="mt-1 text-3xl font-bold">{selected.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Now in</span>
            <StageBadge name={cur?.stage.name} index={cur?.index} size="lg" />
            <span>for {formatDuration(hoursBetween(selected.stage_entered_at, now))}</span>
          </div>
        </div>

        <h2 className="mt-8 mb-3 text-2xl font-bold">Move to stage</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(stages ?? []).map((s, i) => {
            const isCurrent = s.id === selected.current_stage_id;
            const isNext = s.id === next?.id;
            const isTarget = s.id === target;
            return (
              <button
                key={s.id}
                disabled={isCurrent}
                onClick={() => setTarget(s.id)}
                className={cn(
                  toneClass(i),
                  "relative flex min-h-24 flex-col items-start justify-between rounded-xl border-2 bg-card p-4 text-left shadow-card transition-all active:scale-[0.98]",
                  isTarget ? "tone-border tone-fill ring-4 ring-ring/30" : "border-border hover:border-ring",
                  isCurrent && "cursor-not-allowed opacity-45",
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="tone-dot size-3 rounded-full" />
                  {isNext && !isCurrent && (
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary-foreground uppercase">Next</span>
                  )}
                  {isCurrent && <span className="text-[10px] font-bold tracking-wider uppercase">Current</span>}
                  {isTarget && <CheckCircle2 className="tone-text size-6" />}
                </span>
                <span className="font-display text-xl leading-tight font-bold">{s.name}</span>
              </button>
            );
          })}
        </div>

        <h2 className="mt-8 mb-3 text-xl font-bold">
          Remarks <span className="text-sm font-normal text-muted-foreground">(optional)</span>
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_REMARKS.map((r) => (
            <button
              key={r}
              onClick={() => setRemarks((cur) => (cur ? `${cur}; ${r}` : r))}
              className="rounded-full border bg-card px-4 py-2.5 text-sm font-semibold hover:border-ring hover:bg-accent active:scale-95"
            >
              {r}
            </button>
          ))}
        </div>
        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add a note…" className="min-h-20 text-base" />

        <div className="sticky bottom-24 mt-6 lg:bottom-6">
          <Button variant="hero" size="touch" className="h-20 w-full text-xl" disabled={!target || saving} onClick={save}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            {target ? `Save — move to ${stages?.find((s) => s.id === target)?.name}` : "Select a stage"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {scanning && <QrScanner onResult={onScan} onClose={() => setScanning(false)} />}
      <p className="mb-1 text-xs font-bold tracking-[0.2em] text-primary uppercase">Shop floor</p>
      <h1 className="text-4xl font-bold">Update status</h1>
      <p className="mt-1 text-muted-foreground">Scan the QR label or search for the Tool ID.</p>

      <Button variant="hero" size="touch" className="mt-6 h-24 w-full text-2xl" onClick={() => setScanning(true)}>
        <QrCode className="!size-8" /> Scan QR code
      </Button>

      <form
        className="relative mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches.length === 1) select(matches[0].tool_code);
          else if (q.trim()) select(parseScannedCode(q));
        }}
      >
        <Search className="absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type Tool ID, e.g. TT-0003"
          className="h-16 rounded-xl pl-13 font-mono text-xl uppercase placeholder:normal-case"
          inputMode="search"
        />
      </form>

      <p className="mt-6 mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
        {q ? "Matching tools" : "Recently updated"}
      </p>
      <div className="grid gap-2">
        {matches.map((t) => {
          const s = t.current_stage_id ? stageMap.get(t.current_stage_id) : undefined;
          return (
            <button
              key={t.id}
              onClick={() => select(t.tool_code)}
              className="flex min-h-18 items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-card transition-all hover:border-ring active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <ToolCode code={t.tool_code} className="text-base" />
                  {isDelayed(t, s?.stage, now) && <DelayBadge />}
                </div>
                <p className="truncate font-semibold">{t.name}</p>
              </div>
              <StageBadge name={s?.stage.name} index={s?.index} />
              <ChevronRight className="size-6 text-muted-foreground" />
            </button>
          );
        })}
        {tools && matches.length === 0 && <p className="py-6 text-center text-muted-foreground">No tools match “{q}”.</p>}
      </div>
    </div>
  );
}
