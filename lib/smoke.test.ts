import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("toolchain smoke test", () => {
  it("merges class names via cn()", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-foreground", false && "hidden")).toBe("text-foreground");
  });
});
