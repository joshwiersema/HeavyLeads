import { describe, it, expect } from "vitest";
import { signUpSchema } from "@/lib/validators/auth";

describe("signUpSchema confirmPassword validation", () => {
  it("accepts when confirmPassword matches password", () => {
    const result = signUpSchema.safeParse({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      confirmPassword: "securepassword",
      companyName: "Acme Equipment",
    });

    expect(result.success).toBe(true);
  });

  it("rejects when confirmPassword does not match password", () => {
    const result = signUpSchema.safeParse({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      confirmPassword: "differentpassword",
      companyName: "Acme Equipment",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.issues.find(
        (issue) =>
          issue.path.includes("confirmPassword") &&
          issue.message === "Passwords do not match"
      );
      expect(confirmError).toBeDefined();
    }
  });

  it("rejects when confirmPassword is empty", () => {
    const result = signUpSchema.safeParse({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      confirmPassword: "",
      companyName: "Acme Equipment",
    });

    expect(result.success).toBe(false);
  });

  it("schema type includes confirmPassword field", () => {
    // Verify the schema shape includes confirmPassword by parsing valid data
    const result = signUpSchema.safeParse({
      name: "John Smith",
      email: "john@example.com",
      password: "securepassword",
      companyName: "Acme Equipment",
      // Missing confirmPassword intentionally
    });

    // Should fail because confirmPassword is required
    expect(result.success).toBe(false);
  });
});
