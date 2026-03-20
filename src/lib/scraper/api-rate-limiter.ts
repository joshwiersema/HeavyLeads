/**
 * p-queue rate limiters for external APIs.
 *
 * Singleton pattern within a single serverless invocation.
 * Each cold start gets fresh queue instances.
 *
 * - Socrata (Austin/Dallas permits): concurrency 2, 8 req/min
 * - SAM.gov (federal bids): concurrency 1, 10 req/min
 * - USAspending (federal contracts): concurrency 2, 10 req/min
 * - OSHA (inspections): concurrency 1, 5 req/min
 * - EPA Envirofacts (brownfields): concurrency 1, 10 req/min
 * - Grants.gov (federal grants): concurrency 1, 5 req/min
 * - FERC eLibrary (energy filings): concurrency 1, 5 req/min
 * - FCC (antenna registrations): concurrency 1, 10 req/min
 */

import type PQueue from "p-queue";

let socrataQueue: PQueue | null = null;
let samGovQueue: PQueue | null = null;
let nwsQueue: PQueue | null = null;
let eiaQueue: PQueue | null = null;
let usaSpendingQueue: PQueue | null = null;
let oshaQueue: PQueue | null = null;
let epaQueue: PQueue | null = null;
let grantsGovQueue: PQueue | null = null;
let fercQueue: PQueue | null = null;
let fccQueue: PQueue | null = null;

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

/** Get the EIA API rate limiter queue (concurrency=1, 30 req/min). */
export async function getEiaQueue(): Promise<PQueue> {
  if (eiaQueue) return eiaQueue;

  const { default: PQueueClass } = await import("p-queue");
  eiaQueue = new PQueueClass({
    concurrency: 1,
    intervalCap: 30,
    interval: 60_000,
  });
  return eiaQueue;
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

/** Get the USAspending API rate limiter queue (concurrency=2, 10 req/min). */
export async function getUsaSpendingQueue(): Promise<PQueue> {
  if (usaSpendingQueue) return usaSpendingQueue;

  const { default: PQueueClass } = await import("p-queue");
  usaSpendingQueue = new PQueueClass({
    concurrency: 2,
    intervalCap: 10,
    interval: 60_000,
  });
  return usaSpendingQueue;
}

/** Get the OSHA API rate limiter queue (concurrency=1, 5 req/min). Conservative due to API stability concerns. */
export async function getOshaQueue(): Promise<PQueue> {
  if (oshaQueue) return oshaQueue;

  const { default: PQueueClass } = await import("p-queue");
  oshaQueue = new PQueueClass({
    concurrency: 1,
    intervalCap: 5,
    interval: 60_000,
  });
  return oshaQueue;
}

/** Get the EPA Envirofacts API rate limiter queue (concurrency=1, 10 req/min). */
export async function getEpaQueue(): Promise<PQueue> {
  if (epaQueue) return epaQueue;

  const { default: PQueueClass } = await import("p-queue");
  epaQueue = new PQueueClass({
    concurrency: 1,
    intervalCap: 10,
    interval: 60_000,
  });
  return epaQueue;
}

/** Get the Grants.gov API rate limiter queue (concurrency=1, 5 req/min). Conservative -- no documented rate limit. */
export async function getGrantsGovQueue(): Promise<PQueue> {
  if (grantsGovQueue) return grantsGovQueue;

  const { default: PQueueClass } = await import("p-queue");
  grantsGovQueue = new PQueueClass({
    concurrency: 1,
    intervalCap: 5,
    interval: 60_000,
  });
  return grantsGovQueue;
}

/** Get the FERC eLibrary rate limiter queue (concurrency=1, 5 req/min). Scraping-based, be conservative. */
export async function getFercQueue(): Promise<PQueue> {
  if (fercQueue) return fercQueue;

  const { default: PQueueClass } = await import("p-queue");
  fercQueue = new PQueueClass({
    concurrency: 1,
    intervalCap: 5,
    interval: 60_000,
  });
  return fercQueue;
}

/** Get the FCC API rate limiter queue (concurrency=1, 10 req/min). Socrata-based endpoint. */
export async function getFccQueue(): Promise<PQueue> {
  if (fccQueue) return fccQueue;

  const { default: PQueueClass } = await import("p-queue");
  fccQueue = new PQueueClass({
    concurrency: 1,
    intervalCap: 10,
    interval: 60_000,
  });
  return fccQueue;
}
