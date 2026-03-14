import { describe, it, expect } from "vitest";
import {
  inferEquipmentNeeds,
  INFERENCE_RULES,
} from "@/lib/leads/equipment-inference";

describe("inferEquipmentNeeds", () => {
  it("maps excavation description to Excavators with high confidence when in projectType", () => {
    const result = inferEquipmentNeeds("Excavation Work", null);
    const excavator = result.find((r) => r.type === "Excavators");
    expect(excavator).toBeDefined();
    expect(excavator!.confidence).toBe("high");
  });

  it("maps excavation keyword in description to Excavators with medium confidence", () => {
    const result = inferEquipmentNeeds(null, "Site preparation with excavation and grading");
    const excavator = result.find((r) => r.type === "Excavators");
    expect(excavator).toBeDefined();
    expect(excavator!.confidence).toBe("medium");
  });

  it("maps roofing description to Boom Lifts", () => {
    const result = inferEquipmentNeeds("Roofing Permit", "Roof replacement on commercial building");
    const boomLift = result.find((r) => r.type === "Boom Lifts");
    expect(boomLift).toBeDefined();
  });

  it("maps concrete foundation to Excavators, Backhoes, and Compactors", () => {
    const result = inferEquipmentNeeds(null, "Concrete foundation pour for new building");
    const types = result.map((r) => r.type);
    expect(types).toContain("Excavators");
    expect(types).toContain("Backhoes");
    expect(types).toContain("Compactors");
  });

  it("returns General Construction fallback for unknown project type with no keywords", () => {
    const result = inferEquipmentNeeds("MISC-PERMIT-XYZ", "Miscellaneous work at site");
    expect(result.length).toBeGreaterThan(0);
    // Fallback should be low confidence
    expect(result.every((r) => r.confidence === "low")).toBe(true);
  });

  it("returns General Construction fallback for null inputs", () => {
    const result = inferEquipmentNeeds(null, null);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.confidence === "low")).toBe(true);
  });

  it("matches case-insensitively", () => {
    const result = inferEquipmentNeeds("EXCAVATION PERMIT", "GRADING WORK");
    const excavator = result.find((r) => r.type === "Excavators");
    expect(excavator).toBeDefined();
  });

  it("sorts results by confidence (high first)", () => {
    // projectType match = high, description-only match = medium
    const result = inferEquipmentNeeds(
      "Excavation",
      "Some framing and structural work"
    );
    const confidences = result.map((r) => r.confidence);
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < confidences.length; i++) {
      expect(confidenceOrder[confidences[i]]).toBeGreaterThanOrEqual(
        confidenceOrder[confidences[i - 1]]
      );
    }
  });

  it("deduplicates equipment types keeping highest confidence", () => {
    // Both "commercial" and "framing" rules include Cranes
    const result = inferEquipmentNeeds(
      "Commercial construction",
      "structural framing work"
    );
    const craneEntries = result.filter((r) => r.type === "Cranes");
    expect(craneEntries).toHaveLength(1);
  });
});

describe("INFERENCE_RULES", () => {
  it("exports an array of inference rules", () => {
    expect(Array.isArray(INFERENCE_RULES)).toBe(true);
    expect(INFERENCE_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it("each rule has keywords, equipment, and optional phase", () => {
    for (const rule of INFERENCE_RULES) {
      expect(rule.keywords.length).toBeGreaterThan(0);
      expect(rule.equipment.length).toBeGreaterThan(0);
    }
  });
});
