/**
 * Shared test fixtures for billing tests.
 * Provides factories for mock subscription rows and Stripe webhook events.
 */

export interface MockSubscription {
  id: string;
  plan: string;
  referenceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  cancelAtPeriodEnd: boolean;
  seats: number;
  trialStart: Date | null;
  trialEnd: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createMockSubscription(
  overrides?: Partial<MockSubscription>
): MockSubscription {
  return {
    id: "sub-1",
    plan: "standard",
    referenceId: "org-123",
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    status: "active",
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 30 * 86400000),
    cancelAtPeriodEnd: false,
    seats: 1,
    trialStart: null,
    trialEnd: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export interface MockStripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
  created: number;
}

export function createMockStripeEvent(
  type: string,
  data: Record<string, unknown>
): MockStripeEvent {
  return {
    id: "evt_test",
    type,
    data: { object: data },
    created: Math.floor(Date.now() / 1000),
  };
}
