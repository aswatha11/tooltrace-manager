import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Stage = Tables<"stages">;
export type Tool = Tables<"tools">;
export type ToolEvent = Tables<"tool_events">;
export type Profile = Tables<"profiles">;

export const stagesQuery = queryOptions({
  queryKey: ["stages"],
  queryFn: async () => {
    const { data, error } = await supabase.from("stages").select("*").order("position");
    if (error) throw error;
    return data;
  },
});

export const toolsQuery = queryOptions({
  queryKey: ["tools"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tools").select("*").order("tool_code");
    if (error) throw error;
    return data;
  },
});

export const toolByCodeQuery = (code: string) =>
  queryOptions({
    queryKey: ["tool", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tools")
        .select("*")
        .eq("tool_code", code.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const toolEventsQuery = (toolId: string | undefined) =>
  queryOptions({
    queryKey: ["events", "tool", toolId],
    enabled: !!toolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tool_events")
        .select("*")
        .eq("tool_id", toolId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export type ReportFilters = {
  tool?: string;
  stage?: string;
  operator?: string;
  from?: string;
  to?: string;
};

export type ReportRow = ToolEvent & { tools: { tool_code: string; name: string } | null };

export const reportQuery = (f: ReportFilters) =>
  queryOptions({
    queryKey: ["events", "report", f],
    queryFn: async () => {
      let q = supabase
        .from("tool_events")
        .select("*, tools!inner(tool_code, name)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (f.stage) q = q.eq("stage_name", f.stage);
      if (f.operator) q = q.eq("operator_name", f.operator);
      if (f.from) q = q.gte("created_at", new Date(`${f.from}T00:00:00`).toISOString());
      if (f.to) q = q.lte("created_at", new Date(`${f.to}T23:59:59.999`).toISOString());
      if (f.tool) {
        const term = f.tool.replace(/[%,()]/g, " ").trim();
        if (term) q = q.or(`tool_code.ilike.%${term}%,name.ilike.%${term}%`, { referencedTable: "tools" });
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as ReportRow[];
    },
  });

export const operatorsQuery = queryOptions({
  queryKey: ["events", "operators"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tool_events")
      .select("operator_name")
      .order("operator_name")
      .limit(1000);
    if (error) throw error;
    return Array.from(new Set(data.map((d) => d.operator_name).filter(Boolean)));
  },
});

export const recentEventsQuery = queryOptions({
  queryKey: ["events", "recent"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("tool_events")
      .select("*, tools!inner(tool_code, name)")
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return data as ReportRow[];
  },
});

export type Me = {
  id: string;
  email: string | undefined;
  name: string;
  role: "admin" | "operator";
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    return {
      id: user.id,
      email: user.email,
      name: profile?.full_name || user.email?.split("@")[0] || "Operator",
      role: isAdmin ? "admin" : "operator",
    };
  },
  staleTime: 60_000,
});

export function useMe() {
  return useQuery(meQuery).data ?? null;
}

export function useStageMap(stages: Stage[] | undefined) {
  const map = new Map<string, { stage: Stage; index: number }>();
  (stages ?? []).forEach((s, i) => map.set(s.id, { stage: s, index: i }));
  return map;
}

/** Re-render periodically so "time in stage" and delay highlights stay current. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Subscribe once to live database changes and refresh affected screens. */
export function useLiveUpdates() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`tooltrace-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tools" }, () => {
        qc.invalidateQueries({ queryKey: ["tools"] });
        qc.invalidateQueries({ queryKey: ["tool"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tool_events" }, () => {
        qc.invalidateQueries({ queryKey: ["events"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "stages" }, () => {
        qc.invalidateQueries({ queryKey: ["stages"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
