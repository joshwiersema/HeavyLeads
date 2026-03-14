// These tests validate Better Auth Stripe plugin webhook handling.
// Plugin manages this internally; tests verify end-state in subscription table.
import { describe, it, expect } from "vitest";
import {
  createMockSubscription,
  createMockStripeEvent,
} from "../helpers/billing";

describe("Webhook-driven subscription status updates", () => {
  it.todo("activates subscription on checkout.session.completed event");

  it.todo(
    "updates subscription status on customer.subscription.updated event"
  );

  it.todo(
    "marks subscription canceled on customer.subscription.deleted event"
  );

  it.todo("ignores unrecognized webhook event types");
});
