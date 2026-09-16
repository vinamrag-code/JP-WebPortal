import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { calculateSGPA } from "@/lib/math";
import { getFromCache, saveToCache } from "@/components/scripts/cache";
import { Badge } from "@/components/ui/badge";

// Proves the test setup works end to end: @ alias, jsdom localStorage, and React rendering.
describe("test setup smoke", () => {
  it("imports pure modules through the @ alias", () => {
    expect(calculateSGPA([{ credits: 4, grade: "A" }, { credits: 2, grade: "B" }])).toBeCloseTo((9 * 4 + 7 * 2) / 6, 2);
  });

  it("has a working localStorage for the existing cache helpers", async () => {
    await saveToCache("smoke-key", { hello: "world" }, 1);
    expect((await getFromCache("smoke-key")).data).toEqual({ hello: "world" });
  });

  it("renders existing UI components", () => {
    render(<Badge>Lecture</Badge>);
    expect(screen.getByText("Lecture")).toBeInTheDocument();
  });
});
