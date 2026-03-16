import { describe, it, expect } from "vitest";
import { getSocrataQueue, getSamGovQueue } from "@/lib/scraper/api-rate-limiter";

describe("API rate limiter", () => {
  it("getSocrataQueue returns a p-queue instance with concurrency=2", async () => {
    const queue = await getSocrataQueue();
    expect(queue).toBeDefined();
    expect(queue.concurrency).toBe(2);
  });

  it("getSamGovQueue returns a p-queue instance with concurrency=1", async () => {
    const queue = await getSamGovQueue();
    expect(queue).toBeDefined();
    expect(queue.concurrency).toBe(1);
  });

  it("getSocrataQueue returns the same instance on repeated calls (singleton)", async () => {
    const queue1 = await getSocrataQueue();
    const queue2 = await getSocrataQueue();
    expect(queue1).toBe(queue2);
  });

  it("queue enforces concurrency (only N tasks run simultaneously)", async () => {
    const queue = await getSocrataQueue();
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 6 }, () =>
      queue.add(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 50));
        running--;
        return "done";
      })
    );

    await Promise.all(tasks);
    expect(maxRunning).toBeLessThanOrEqual(2);
  });
});
