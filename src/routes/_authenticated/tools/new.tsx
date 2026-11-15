import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, History, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/tt/page-header";
import { ToolQr } from "@/components/tt/tool-qr";
import { supabase } from "@/integrations/supabase/client";
import { stagesQuery, useMe } from "@/lib/queries";
import { PRIORITIES, type Priority } from "@/lib/tooltrace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tools/new")({
  head: () => ({
    meta: [
      { title: "Add Tool — ToolTrace" },
      { name: "description", content: "Register a new tool and get its unique Tool ID and QR label." },
      { property: "og:title", content: "Add Tool — ToolTrace" },
      { property: "og:description", content: "Register tools with auto-generated IDs and QR codes." },
    ],
  }),
  component: AddTool,
});

const TYPES = ["Press Die", "Injection Mould", "Forging Die", "Cutting Tool", "Jig", "Fixture", "Gauge", "Die Casting Die"];

const priorityStyle: Record<Priority, string> = {
  low: "data-[on=true]:border-muted-foreground data-[on=true]:bg-muted",
  medium: "data-[on=true]:border-primary data-[on=true]:bg-secondary",
  high: "data-[on=true]:border-warning data-[on=true]:bg-warning/15",
  critical: "data-[on=true]:border-destructive data-[on=true]:bg-destructive/10",
};

function AddTool() {
  const me = useMe();
  const qc = useQueryClient();
  const { data: stages } = useQuery(stagesQuery);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ code: string; name: string } | null>(null);

  const reset = () => {
    setName("");
    setType("");
    setDescription("");
    setPriority("medium");
    setCreated(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!me) return;
    setSaving(true);
    const { data: tool, error } = await supabase
      .from("tools")
      .insert({ name: name.trim(), type: type.trim(), description: description.trim(), priority, created_by: me.id })
      .select()
      .single();
    if (error || !tool) {
      setSaving(false);
      toast.error("Could not add tool: " + (error?.message ?? "unknown error"));
      return;
    }
    const first = stages?.[0];
    if (first) {
      await supabase.from("tool_events").insert({
        tool_id: tool.id,
        stage_id: first.id,
        remarks: "Tool registered",
        operator_id: me.id,
      });
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["tools"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    setCreated({ code: tool.tool_code, name: tool.name });
    toast.success(`Tool ${tool.tool_code} created`);
  };

  if (created) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="mt-3 text-3xl font-bold">Tool registered</h1>
        <p className="mt-1 text-muted-foreground">{created.name}</p>
        <div className="mt-6">
          <ToolQr code={created.code} name={created.name} size={200} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Print and attach this label. Scanning it opens the Update Status screen for this tool.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button variant="hero" size="xl" onClick={reset}>
            <PlusCircle /> Add another
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link to="/tools/$code" params={{ code: created.code }}>
              <History /> View tool
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Registry" title="Add tool" description="A unique Tool ID and QR code are generated automatically." />
      <form onSubmit={submit} className="space-y-6 rounded-2xl border bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-base">Tool name *</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Progressive Die PD-230" className="h-12 text-base" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type" className="text-base">Type *</Label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  type === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Input id="type" required value={type} onChange={(e) => setType(e.target.value)} placeholder="Or type a custom type" className="h-12 text-base" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc" className="text-base">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Material, part number, customer…" className="min-h-24 text-base" />
        </div>

        <div className="space-y-2">
          <Label className="text-base">Priority</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p}
                data-on={priority === p}
                onClick={() => setPriority(p)}
                className={cn("h-14 rounded-xl border-2 text-base font-bold capitalize transition-colors", priorityStyle[p])}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          The tool will start in <strong className="text-foreground">{stages?.[0]?.name ?? "the first stage"}</strong>.
        </p>

        <Button type="submit" variant="hero" size="touch" className="w-full" disabled={saving || !name.trim() || !type.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <PlusCircle />} Create tool & QR code
        </Button>
      </form>
    </div>
  );
}
