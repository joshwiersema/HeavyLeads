/**
 * p-queue rate limiters for external APIs.
 *
 * Singleton pattern within a single serverless invocation.
 * Each cold start gets fresh queue instances.
 *
 * - Socrata (Austin/Dallas permits): concurrency 2, 8 req/min
 * - SAM.gov (federal bids): concurrency 1, 10 req/min
 */

import type PQueue from "p-queue";

let socrataQueue: PQueue | null = null;
let samGovQueue: PQueue | null = null;
let nwsQueue: PQueue | null = null;

/** Get the Socrata API rate limiter queue (concurrency=2, 8 req/min). */
export async function getSocrataQueue(): Promise<PQueue> {
  if (socrataQueue) return socrataQueue;

  const { default: PQueueClass } = await import("p-queue");
  socrataQueue = new PQueueClass({
    concurrency: 2,
    intervalCap: 8,
    interval: 60_000,
  });
  return socrataQueue;
}

/** Get the SAM.gov API rate limiter queue (concurrency=1, 10 req/min). */
export async function getSamGovQueue(): Promise<PQueue> {
  if (samGovQueue) return samGovQueue;

  const { default: PQueueClass } = await import("p-queue");
  samGovQueue = new PQueueClass({
    concurrency: 1,
    intervalCap: 10,
    interval: 60_000,
  });
  return samGovQueue;
}

/** Get the NWS API rate limiter queue (concurrency=1, 5 req/min). */
export async function getNwsQueue(): Promise<PQueue> {
  if (nwsQueue) return nwsQueue;

  const { default: PQueueClass } = await import("p-queue");
  nwsQueue = new PQueueClass({
    concurrency: 1,
    intervalCap: 5,
    interval: 60_000,
  });
  return nwsQueue;
}
