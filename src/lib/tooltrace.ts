// Pure helpers for ToolTrace business rules (delay detection, durations, CSV export).

export type StageLike = { id: string; name: string; position: number; max_hours: number | null };
export type ToolLike = { current_stage_id: string | null; stage_entered_at: string };

export function hoursBetween(fromIso: string, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(fromIso).getTime()) / 36e5);
}

/** A tool is delayed when it has been in a stage with a time limit for longer than that limit. */
export function isDelayed(tool: ToolLike, stage: StageLike | undefined, now: Date = new Date()) {
  if (!stage || stage.max_hours == null || stage.max_hours <= 0) return false;
  return hoursBetween(tool.stage_entered_at, now) > stage.max_hours;
}

/** How far past (or towards) the limit a tool is, as a ratio of the limit. */
export function delayRatio(tool: ToolLike, stage: StageLike | undefined, now: Date = new Date()) {
  if (!stage || stage.max_hours == null || stage.max_hours <= 0) return 0;
  return hoursBetween(tool.stage_entered_at, now) / stage.max_hours;
}

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 && h < 10 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/** The stage after the current one, by position. First stage when none is set. */
export function nextStage<T extends StageLike>(stages: T[], currentId: string | null): T | undefined {
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  if (!currentId) return sorted[0];
  const idx = sorted.findIndex((s) => s.id === currentId);
  if (idx === -1) return sorted[0];
  return sorted[idx + 1];
}

export function toneClass(index: number | undefined): string {
  if (index == null || index < 0) return "tone-none";
  return `tone-${index % 8}`;
}

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Extract a Tool ID from scanned QR text (either a raw ID or a URL carrying ?code=). */
export function parseScannedCode(text: string): string {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    if (code) return code.toUpperCase();
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last).toUpperCase();
  } catch {
    // not a URL
  }
  return trimmed.toUpperCase();
}

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];
