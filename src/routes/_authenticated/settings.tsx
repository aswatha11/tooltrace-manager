import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, Plus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PageHeader } from "@/components/tt/page-header";
import { supabase } from "@/integrations/supabase/client";
import { stagesQuery, toolsQuery, useMe, type Stage } from "@/lib/queries";
import { toneClass } from "@/lib/tooltrace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ToolTrace" },
      { name: "description", content: "Configure process stages, delay time limits and user roles." },
      { property: "og:title", content: "Settings — ToolTrace" },
      { property: "og:description", content: "Configure process stages and roles." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const me = useMe();
  if (me && me.role !== "admin") {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Lock className="size-12 text-muted-foreground" />
        <h1 className="mt-3 text-3xl font-bold">Admins only</h1>
        <p className="text-muted-foreground">Ask an Admin to change stages or roles.</p>
      </div>
    );
  }
  return (
    <>
      <PageHeader eyebrow="Admin" title="Settings" description="Shape the process to match your shop floor." />
      <div className="grid gap-6 xl:grid-cols-5">
        <StagesManager />
        <UsersManager />
      </div>
    </>
  );
}

function StagesManager() {
  const qc = useQueryClient();
  const { data: stages } = useQuery(stagesQuery);
  const { data: tools } = useQuery(toolsQuery);
  const [name, setName] = useState("");
  const [hours, setHours] = useState("48");
  const refresh = () => qc.invalidateQueries({ queryKey: ["stages"] });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const position = Math.max(0, ...(stages ?? []).map((s) => s.position)) + 1;
    const { error } = await supabase
      .from("stages")
      .insert({ name: name.trim(), position, max_hours: hours ? Number(hours) : null });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "A stage with that name already exists" : error.message);
      return;
    }
    setName("");
    toast.success("Stage added");
    refresh();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    if (!stages) return;
    const a = stages[idx];
    const b = stages[idx + dir];
    if (!a || !b) return;
    const r1 = await supabase.from("stages").update({ position: b.position }).eq("id", a.id);
    const r2 = await supabase.from("stages").update({ position: a.position }).eq("id", b.id);
    if (r1.error || r2.error) toast.error("Could not reorder");
    refresh();
  };

  const remove = async (s: Stage) => {
    const { error } = await supabase.from("stages").delete().eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Deleted “${s.name}”`);
    refresh();
  };

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-card xl:col-span-3">
      <h2 className="text-2xl font-bold">Process stages</h2>
      <p className="text-sm text-muted-foreground">Order, names and delay time limits. Leave the limit empty for no alert.</p>
      <ul className="mt-5 space-y-2">
        {(stages ?? []).map((s, i) => {
          const inUse = (tools ?? []).filter((t) => t.current_stage_id === s.id).length;
          return (
            <StageRow
              key={s.id}
              stage={s}
              index={i}
              inUse={inUse}
              isFirst={i === 0}
              isLast={i === (stages?.length ?? 0) - 1}
              onMove={(d) => move(i, d)}
              onDelete={() => remove(s)}
              onSaved={refresh}
            />
          );
        })}
      </ul>
      <form onSubmit={add} className="mt-5 flex flex-col gap-2 rounded-xl border border-dashed p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-stage">New stage</Label>
          <Input id="new-stage" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Heat Treatment" className="h-11" />
        </div>
        <div className="space-y-1.5 sm:w-32">
          <Label htmlFor="new-hours">Limit (hours)</Label>
          <Input id="new-hours" type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} className="h-11" />
        </div>
        <Button type="submit" variant="hero" size="xl">
          <Plus /> Add
        </Button>
      </form>
    </section>
  );
}

function StageRow({
  stage,
  index,
  inUse,
  isFirst,
  isLast,
  onMove,
  onDelete,
  onSaved,
}: {
  stage: Stage;
  index: number;
  inUse: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(stage.name);
  const [hours, setHours] = useState(stage.max_hours?.toString() ?? "");
  useEffect(() => {
    setName(stage.name);
    setHours(stage.max_hours?.toString() ?? "");
  }, [stage.name, stage.max_hours]);

  const save = async () => {
    const maxHours = hours.trim() ? Number(hours) : null;
    if (name.trim() === stage.name && maxHours === stage.max_hours) return;
    if (!name.trim()) return setName(stage.name);
    const { error } = await supabase.from("stages").update({ name: name.trim(), max_hours: maxHours }).eq("id", stage.id);
    if (error) {
      toast.error(error.message);
      setName(stage.name);
      return;
    }
    toast.success("Stage saved");
    onSaved();
  };

  return (
    <li className={cn(toneClass(index), "flex items-center gap-2 rounded-xl border border-l-4 tone-border bg-background p-2 pl-3")}>
      <span className="font-display w-6 text-lg font-bold text-muted-foreground">{index + 1}</span>
      <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className="h-10 flex-1 font-semibold" aria-label="Stage name" />
      <div className="relative w-24">
        <Input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="—" className="h-10 pr-6" aria-label="Time limit in hours" />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
      </div>
      <Button variant="ghost" size="icon" disabled={isFirst} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp /></Button>
      <Button variant="ghost" size="icon" disabled={isLast} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown /></Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete stage"><Trash2 /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{stage.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {inUse > 0
                ? `${inUse} tool${inUse === 1 ? " is" : "s are"} currently in this stage. Move them first before deleting it.`
                : "History records keep the stage name. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {inUse === 0 && (
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function UsersManager() {
  const me = useMe();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        isAdmin: (roles ?? []).some((r) => r.user_id === p.id && r.role === "admin"),
      }));
    },
  });

  const setRole = async (userId: string, admin: boolean) => {
    const add = admin ? "admin" : "operator";
    const drop = admin ? "operator" : "admin";
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: add });
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", drop);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-card xl:col-span-2">
      <h2 className="text-2xl font-bold">People & roles</h2>
      <p className="text-sm text-muted-foreground">Admins manage stages and tools. Operators update status.</p>
      <ul className="mt-5 divide-y">
        {(data ?? []).map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-3">
            <div className="grid size-10 place-items-center rounded-full bg-secondary font-bold text-secondary-foreground">
              {u.full_name.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{u.full_name}{u.id === me?.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
            <div className="flex rounded-lg border p-0.5">
              {(["operator", "admin"] as const).map((r) => {
                const active = (r === "admin") === u.isAdmin;
                return (
                  <button
                    key={r}
                    disabled={u.id === me?.id}
                    onClick={() => !active && setRole(u.id, r === "admin")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold capitalize transition-colors disabled:cursor-not-allowed",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {r === "admin" && <Shield className="size-3" />} {r}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
