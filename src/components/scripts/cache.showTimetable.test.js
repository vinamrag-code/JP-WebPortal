import { afterEach, describe, expect, it } from "vitest";
import { getShowTimetableInNavbar, setShowTimetableInNavbar } from "./cache";

afterEach(() => localStorage.clear());

describe("getShowTimetableInNavbar", () => {
  it("defaults to shown when the setting has never been touched", () => {
    expect(localStorage.getItem("showTimetableInNavbar")).toBeNull();
    expect(getShowTimetableInNavbar()).toBe(true);
  });

  it("respects an explicit choice in either direction", () => {
    setShowTimetableInNavbar(false);
    expect(getShowTimetableInNavbar()).toBe(false);
    setShowTimetableInNavbar(true);
    expect(getShowTimetableInNavbar()).toBe(true);
  });
});
