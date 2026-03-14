// These tests validate checkout session params logic. Implementation in Task 1.
import { describe, it, expect } from "vitest";
import { createMockSubscription } from "../helpers/billing";

describe("Checkout session setup fee inclusion", () => {
  it.todo("includes setup fee line item for first-time subscribers");

  it.todo("excludes setup fee line item for re-subscribers");

  it.todo("always includes the standard monthly plan price");
});
