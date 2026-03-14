/**
 * Test helpers for email digest functionality.
 * Provides mock Resend client factory and sample digest lead data.
 */

/** DigestLead type matching the component/sender interface */
export interface DigestLead {
  id: string;
  title: string;
  address: string;
  score: number;
  projectType: string | null;
  distance: number | null;
}

/** Creates a mock Resend client for testing */
export function createMockResend() {
  const sentEmails: Array<{
    from: string;
    to: string[];
    subject: string;
    react: unknown;
  }> = [];

  return {
    emails: {
      send: vi.fn(async (params: { from: string; to: string[]; subject: string; react: unknown }) => {
        sentEmails.push(params);
        return { data: { id: "mock-email-id" }, error: null };
      }),
    },
    sentEmails,
  };
}

/** Sample digest lead fixtures */
export function createSampleDigestLeads(count = 3): DigestLead[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-0000-0000-00000000000${i + 1}`,
    title: `Commercial Construction Project ${i + 1}`,
    address: `${100 + i} Main St, Austin, TX`,
    score: 85 - i * 10,
    projectType: i % 2 === 0 ? "Commercial New Construction" : null,
    distance: 5 + i * 2,
  }));
}

import { vi } from "vitest";
