import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      pipelineRuns: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ type: "eq", a, b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({
    type: "and",
    args,
  })),
  or: vi.fn().mockImplementation((...args: unknown[]) => ({
    type: "or",
    args,
  })),
  isNull: vi.fn().mockImplementation((a) => ({ type: "isNull", a })),
  desc: vi.fn().mockImplementation((a) => ({ type: "desc", a })),
}));

import {
  getLatestPipelineRun,
  getOrgPipelineStatus,
  shouldAutoTrigger,
} from "@/lib/leads/pipeline-status";

describe("pipeline-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getLatestPipelineRun", () => {
    it("returns null when no pipeline runs exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getLatestPipelineRun("org-123");

      expect(result).toBeNull();
    });

    it("returns the most recent pipeline run", async () => {
      const mockRun = {
        id: "run-1",
        organizationId: "org-123",
        status: "completed",
        startedAt: new Date(),
      };
      mockFindFirst.mockResolvedValue(mockRun);

      const result = await getLatestPipelineRun("org-123");

      expect(result).toEqual(mockRun);
    });
  });

  describe("getOrgPipelineStatus", () => {
    it("returns isRunning=true when latest run has status running", async () => {
      const runningRun = {
        id: "run-1",
        organizationId: "org-123",
        status: "running",
        startedAt: new Date(),
      };
      mockFindFirst.mockResolvedValue(runningRun);

      const status = await getOrgPipelineStatus("org-123");

      expect(status.isRunning).toBe(true);
      expect(status.hasEverRun).toBe(true);
      expect(status.lastRun).toEqual(runningRun);
    });

    it("returns hasEverRun=false when no runs exist", async () => {
      mockFindFirst.mockResolvedValue(null);

      const status = await getOrgPipelineStatus("org-123");

      expect(status.hasEverRun).toBe(false);
      expect(status.isRunning).toBe(false);
      expect(status.lastRun).toBeNull();
    });

    it("returns hasEverRun=true and isRunning=false for completed run", async () => {
      const completedRun = {
        id: "run-2",
        organizationId: "org-123",
        status: "completed",
        startedAt: new Date(),
      };
      mockFindFirst.mockResolvedValue(completedRun);

      const status = await getOrgPipelineStatus("org-123");

      expect(status.hasEverRun).toBe(true);
      expect(status.isRunning).toBe(false);
      expect(status.lastRun).toEqual(completedRun);
    });
  });

  describe("shouldAutoTrigger", () => {
    it("returns true when no runs exist and no leads", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await shouldAutoTrigger("org-123", 0);

      expect(result).toBe(true);
    });

    it("returns false when leads exist even if no runs", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await shouldAutoTrigger("org-123", 5);

      expect(result).toBe(false);
    });

    it("returns false when a pipeline has run before", async () => {
      const completedRun = {
        id: "run-1",
        organizationId: "org-123",
        status: "completed",
        startedAt: new Date(),
      };
      mockFindFirst.mockResolvedValue(completedRun);

      const result = await shouldAutoTrigger("org-123", 0);

      expect(result).toBe(false);
    });

    it("returns false when pipeline is currently running", async () => {
      const runningRun = {
        id: "run-1",
        organizationId: "org-123",
        status: "running",
        startedAt: new Date(),
      };
      mockFindFirst.mockResolvedValue(runningRun);

      const result = await shouldAutoTrigger("org-123", 0);

      expect(result).toBe(false);
    });
  });
});
