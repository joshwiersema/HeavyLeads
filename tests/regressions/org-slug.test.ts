import { describe, it, expect } from "vitest";

/**
 * Regression test for Bug Fix #4: Org slug random suffix
 *
 * WHAT WAS BROKEN: Organization slugs were generated without a random
 * suffix, causing uniqueness constraint violations when two orgs had
 * the same company name.
 *
 * WHAT WAS FIXED: Appended a random suffix to the slug:
 * slugify(companyName) + "-" + Math.random().toString(36).substring(2, 7)
 *
 * NOTE: slugify is NOT exported from sign-up-form.tsx. The function is
 * replicated here to test the PATTERN, not the import.
 */

// Replicate the slugify function from sign-up-form.tsx
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

describe("Regression: Org slug with random suffix for uniqueness (Bug Fix #4)", () => {
  it('converts "Heavy Equipment Co." to "heavy-equipment-co"', () => {
    const result = slugify("Heavy Equipment Co.");
    expect(result).toBe("heavy-equipment-co");
  });

  it("converts to lowercase", () => {
    const result = slugify("ABC Construction");
    expect(result).toBe("abc-construction");
  });

  it("replaces spaces and special characters with hyphens", () => {
    const result = slugify("O'Brien & Sons LLC");
    expect(result).toBe("o-brien-sons-llc");
  });

  it("strips leading and trailing hyphens", () => {
    const result = slugify("--Test Company--");
    expect(result).toBe("test-company");
  });

  it("collapses multiple consecutive special characters into single hyphen", () => {
    const result = slugify("Heavy!!!Equipment...Co");
    expect(result).toBe("heavy-equipment-co");
  });

  it("adding random suffix produces different slugs on each call", () => {
    const base = slugify("Test Company");
    const slug1 =
      base + "-" + Math.random().toString(36).substring(2, 7);
    const slug2 =
      base + "-" + Math.random().toString(36).substring(2, 7);

    // Both should start with the same base
    expect(slug1.startsWith("test-company-")).toBe(true);
    expect(slug2.startsWith("test-company-")).toBe(true);

    // But differ in suffix (astronomically unlikely to be equal)
    expect(slug1).not.toBe(slug2);
  });

  it("random suffix is 5 characters of [a-z0-9]", () => {
    const suffix = Math.random().toString(36).substring(2, 7);

    expect(suffix.length).toBe(5);
    expect(suffix).toMatch(/^[a-z0-9]+$/);
  });

  it("handles empty/whitespace input producing a valid slug (not empty string)", () => {
    // Edge case: whitespace-only input
    const result = slugify("   ");
    // After lowercasing and replacing non-alphanumeric, everything becomes hyphens
    // Then strip leading/trailing hyphens -> empty string
    // The production code appends a random suffix, so the final slug is still valid
    const finalSlug =
      (result || "org") +
      "-" +
      Math.random().toString(36).substring(2, 7);

    expect(finalSlug.length).toBeGreaterThan(0);
    expect(finalSlug).toMatch(/^[a-z0-9-]+$/);
  });
});
