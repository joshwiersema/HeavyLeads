import { describe, it, expect } from "vitest";
import { filterByEquipment } from "@/lib/leads/queries";
import type { EnrichedLead } from "@/lib/leads/types";
import { createMockLead } from "../helpers/leads";

/**
 * These tests verify the equipment filtering post-query logic.
 * Since equipment filtering is a TypeScript filter (not SQL), we test
 * the extracted filtering function directly with mock data.
 */

function createEnrichedLead(
  overrides: Record<string, unknown> = {}
): EnrichedLead {
  const lead = createMockLead(overrides);
  return {
    ...lead,
    distance: 10,
    inferredEquipment: [
      { type: "Excavators", confidence: "high" as const, reason: "test" },
      { type: "Boom Lifts", confidence: "medium" as const, reason: "test" },
    ],
    score: 75,
    freshness: "New" as const,
    timeline: [],
    ...(overrides as Partial<EnrichedLead>),
  } as EnrichedLead;
}

describe("filterByEquipment", () => {
  it("returns all leads when no equipment filter is provided", () => {
    const leads = [
      createEnrichedLead({ id: "1" }),
      createEnrichedLead({ id: "2" }),
    ];
    const result = filterByEquipment(leads, undefined);
    expect(result).toHaveLength(2);
  });

  it("returns all leads when equipment filter is an empty array", () => {
    const leads = [
      createEnrichedLead({ id: "1" }),
      createEnrichedLead({ id: "2" }),
    ];
    const result = filterByEquipment(leads, []);
    expect(result).toHaveLength(2);
  });

  it("filters to leads with matching inferred equipment", () => {
    const leads = [
      createEnrichedLead({
        id: "1",
        inferredEquipment: [
          { type: "Excavators", confidence: "high", reason: "test" },
        ],
      }),
      createEnrichedLead({
        id: "2",
        inferredEquipment: [
          { type: "Generators", confidence: "medium", reason: "test" },
        ],
      }),
      createEnrichedLead({
        id: "3",
        inferredEquipment: [
          { type: "Excavators", confidence: "medium", reason: "test" },
          { type: "Cranes", confidence: "low", reason: "test" },
        ],
      }),
    ];
    const result = filterByEquipment(leads, ["Excavators"]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("3");
  });

  it("returns empty array when no leads match the filter", () => {
    const leads = [
      createEnrichedLead({
        id: "1",
        inferredEquipment: [
          { type: "Excavators", confidence: "high", reason: "test" },
        ],
      }),
      createEnrichedLead({
        id: "2",
        inferredEquipment: [
          { type: "Boom Lifts", confidence: "medium", reason: "test" },
        ],
      }),
    ];
    const result = filterByEquipment(leads, ["Generators"]);
    expect(result).toHaveLength(0);
  });

  it("matches when any inferred equipment type overlaps with filter", () => {
    const leads = [
      createEnrichedLead({
        id: "1",
        inferredEquipment: [
          { type: "Excavators", confidence: "high", reason: "test" },
          { type: "Bulldozers", confidence: "medium", reason: "test" },
          { type: "Compactors", confidence: "low", reason: "test" },
        ],
      }),
    ];
    // Filter for Compactors -- lead has it as one of three types
    const result = filterByEquipment(leads, ["Compactors"]);
    expect(result).toHaveLength(1);
  });

  it("supports multiple equipment types in the filter", () => {
    const leads = [
      createEnrichedLead({
        id: "1",
        inferredEquipment: [
          { type: "Excavators", confidence: "high", reason: "test" },
        ],
      }),
      createEnrichedLead({
        id: "2",
        inferredEquipment: [
          { type: "Generators", confidence: "medium", reason: "test" },
        ],
      }),
      createEnrichedLead({
        id: "3",
        inferredEquipment: [
          { type: "Cranes", confidence: "medium", reason: "test" },
        ],
      }),
    ];
    const result = filterByEquipment(leads, ["Excavators", "Cranes"]);
    expect(result).toHaveLength(2);
  });
});
