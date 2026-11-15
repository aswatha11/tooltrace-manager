import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { Download, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/tt/page-header";
import { StageBadge, ToolCode } from "@/components/tt/badges";
import { operatorsQuery, reportQuery, stagesQuery, type ReportFilters } from "@/lib/queries";
import { downloadCsv, toCsv } from "@/lib/tooltrace";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — ToolTrace" },
      { name: "description", content: "Filter tooling history by tool, stage, date and operator, and export to CSV." },
      { property: "og:title", content: "Reports — ToolTrace" },
      { property: "og:description", content: "Searchable tooling history with CSV export." },
    ],
  }),
  component: Reports,
});

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none";

function Reports() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [toolText, setToolText] = useState("");
  const { data: rows, isFetching } = useQuery(reportQuery(filters));
  const { data: stages } = useQuery(stagesQuery);
  const { data: operators } = useQuery(operatorsQuery);
  const stageIndex = new Map((stages ?? []).map((s, i) => [s.name, i]));

  const set = (patch: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const exportCsv = () => {
    const csv = toCsv(
      ["Timestamp", "Tool ID", "Tool name", "From stage", "To stage", "Operator", "Remarks"],
      (rows ?? []).map((r) => [
        format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
        r.tools?.tool_code,
        r.tools?.name,
        r.from_stage_name ?? "",
        r.stage_name,
        r.operator_name,
        r.remarks ?? "",
      ]),
    );
    downloadCsv(`tooltrace-report-${format(new Date(), "yyyyMMdd-HHmm")}.csv`, csv);
  };

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Reports"
        description="Every stage change ever recorded. Filter, then export."
        actions={
          <Button variant="hero" size="xl" onClick={exportCsv} disabled={!rows?.length}>
            <Download /> Export CSV
          </Button>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          set({ tool: toolText || undefined });
        }}
        className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="space-y-1.5 lg:col-span-1">
          <Label htmlFor="tool">Tool</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="tool" value={toolText} onChange={(e) => setToolText(e.target.value)} onBlur={() => set({ tool: toolText || undefined })} placeholder="ID or name" className="h-11 pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stage">Stage</Label>
          <select id="stage" className={selectClass} value={filters.stage ?? ""} onChange={(e) => set({ stage: e.target.value || undefined })}>
            <option value="">All stages</option>
            {(stages ?? []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="op">Operator</Label>
          <select id="op" className={selectClass} value={filters.operator ?? ""} onChange={(e) => set({ operator: e.target.value || undefined })}>
            <option value="">All operators</option>
            {(operators ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} className="h-11" />
        </div>
        <div className="flex items-center justify-between sm:col-span-2 lg:col-span-5">
          <p className="text-sm text-muted-foreground">
            {rows ? `${rows.length} record${rows.length === 1 ? "" : "s"}` : "Loading…"}
            {rows?.length === 1000 && " (showing latest 1000 — narrow filters to see more)"}
          </p>
          <Button type="button" variant="ghost" onClick={() => { setFilters({}); setToolText(""); }}>
            <RotateCcw /> Reset
          </Button>
        </div>
      </form>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">When</th>
                <th className="px-5 py-3 font-semibold">Tool</th>
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold">Operator</th>
                <th className="px-5 py-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!rows && isFetching && (
                <tr><td colSpan={5} className="p-5"><Skeleton className="h-32" /></td></tr>
              )}
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3 whitespace-nowrap tabular-nums">{format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</td>
                  <td className="px-5 py-3">
                    <Link to="/tools/$code" params={{ code: r.tools?.tool_code ?? "" }} className="hover:underline">
                      <ToolCode code={r.tools?.tool_code ?? ""} />
                      <span className="block max-w-56 truncate text-muted-foreground">{r.tools?.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <StageBadge name={r.stage_name} index={stageIndex.get(r.stage_name)} />
                      {r.from_stage_name && <span className="text-xs text-muted-foreground">from {r.from_stage_name}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium whitespace-nowrap">{r.operator_name}</td>
                  <td className="max-w-72 px-5 py-3 text-muted-foreground">{r.remarks}</td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No records match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
