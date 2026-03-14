import { describe, it, expect } from "vitest";
import { mapTimeline } from "@/lib/leads/timeline";

describe("mapTimeline", () => {
  it("maps site prep keywords to urgency Now with earthmoving equipment", () => {
    const result = mapTimeline(null, "Site preparation including excavation and grading");
    expect(result.length).toBeGreaterThan(0);
    const sitePrepWindow = result.find((w) => w.phase === "Site Preparation");
    expect(sitePrepWindow).toBeDefined();
    expect(sitePrepWindow!.urgency).toBe("Now");
    expect(sitePrepWindow!.equipment).toContain("Excavators");
  });

  it("maps framing keywords to urgency Soon with cranes/boom lifts", () => {
    const result = mapTimeline(null, "Structural framing for new office building");
    expect(result.length).toBeGreaterThan(0);
    const framingWindow = result.find((w) => w.phase === "Framing/Structural");
    expect(framingWindow).toBeDefined();
    expect(framingWindow!.urgency).toBe("Soon");
    expect(framingWindow!.equipment).toContain("Cranes");
  });

  it("maps interior finish keywords to urgency Later with aerial platforms", () => {
    const result = mapTimeline(null, "Interior finishing including drywall and painting");
    expect(result.length).toBeGreaterThan(0);
    const interiorWindow = result.find((w) => w.phase === "Interior Finishing");
    expect(interiorWindow).toBeDefined();
    expect(interiorWindow!.urgency).toBe("Later");
    expect(interiorWindow!.equipment).toContain("Aerial Work Platforms");
  });

  it("returns multiple phases when description contains multiple phase keywords", () => {
    const result = mapTimeline(
      null,
      "Complete project: excavation, foundation, framing, and interior finish"
    );
    expect(result.length).toBeGreaterThan(1);
    const phases = result.map((w) => w.phase);
    expect(phases).toContain("Site Preparation");
    expect(phases).toContain("Framing/Structural");
  });

  it("returns empty array when no keywords match", () => {
    const result = mapTimeline("MISC-PERMIT", "No relevant construction keywords here");
    expect(result).toEqual([]);
  });

  it("returns empty array for null inputs", () => {
    const result = mapTimeline(null, null);
    expect(result).toEqual([]);
  });

  it("matches keywords in projectType field", () => {
    const result = mapTimeline("Excavation Permit", null);
    expect(result.length).toBeGreaterThan(0);
    const sitePrepWindow = result.find((w) => w.phase === "Site Preparation");
    expect(sitePrepWindow).toBeDefined();
  });

  it("matches case-insensitively", () => {
    const result = mapTimeline(null, "ROOFING AND EXTERIOR WORK");
    expect(result.length).toBeGreaterThan(0);
  });

  it("each timeline window has required fields", () => {
    const result = mapTimeline(null, "Excavation and grading for new warehouse");
    for (const window of result) {
      expect(window.phase).toBeTruthy();
      expect(window.equipment.length).toBeGreaterThan(0);
      expect(["Now", "Soon", "Later"]).toContain(window.urgency);
      expect(window.description).toBeTruthy();
    }
  });
});
