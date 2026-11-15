import { describe, expect, it } from "vitest";
import { isDelayed, nextStage, parseScannedCode, toCsv } from "./tooltrace";

const now = new Date("2026-11-15T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 36e5).toISOString();
const inspection = { id: "s4", name: "Inspection", position: 4, max_hours: 24 };

describe("delay alerts", () => {
  it("flags a tool that stayed longer than the stage time limit", () => {
    expect(isDelayed({ current_stage_id: "s4", stage_entered_at: hoursAgo(25) }, inspection, now)).toBe(true);
  });
  it("does not flag a tool still within the stage time limit", () => {
    expect(isDelayed({ current_stage_id: "s4", stage_entered_at: hoursAgo(23) }, inspection, now)).toBe(false);
  });
  it("never flags a stage without a time limit", () => {
    const dispatch = { id: "s6", name: "Dispatch", position: 6, max_hours: null };
    expect(isDelayed({ current_stage_id: "s6", stage_entered_at: hoursAgo(5000) }, dispatch, now)).toBe(false);
  });
});

describe("next stage", () => {
  const stages = [
    { id: "b", name: "Material Prep", position: 2, max_hours: 48 },
    { id: "a", name: "Design", position: 1, max_hours: 72 },
  ];
  it("follows stage order", () => {
    expect(nextStage(stages, "a")?.id).toBe("b");
  });
  it("starts at the first stage for a new tool", () => {
    expect(nextStage(stages, null)?.id).toBe("a");
  });
});

describe("CSV export", () => {
  it("quotes values containing commas or quotes", () => {
    expect(toCsv(["a", "b"], [['x, y', 'say "hi"']])).toBe('a,b\r\n"x, y","say ""hi"""');
  });
});

describe("QR scanning", () => {
  it("reads the Tool ID from a scanned link", () => {
    expect(parseScannedCode("https://example.com/update?code=tt-0007")).toBe("TT-0007");
  });
});
