import { describe, expect, it } from "vitest";
import { isUniqueViolation, isValidEmail } from "./validation";

describe("isValidEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(isValidEmail("ben@example.com")).toBe(true);
    expect(isValidEmail("b.stueck+golf@sub.example.co")).toBe(true);
  });

  it("rejects obviously malformed addresses", () => {
    expect(isValidEmail("ben@")).toBe(false);
    expect(isValidEmail("ben")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("ben @example.com")).toBe(false);
    expect(isValidEmail("ben@example")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("recognizes a Postgres unique_violation error thrown directly", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("recognizes one wrapped in Drizzle's DrizzleQueryError (.cause)", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("recognizes an arbitrarily nested .cause chain", () => {
    expect(isUniqueViolation({ cause: { cause: { code: "23505" } } })).toBe(
      true,
    );
  });

  it("rejects other errors", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation({ cause: { code: "23503" } })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("nope")).toBe(false);
  });
});
