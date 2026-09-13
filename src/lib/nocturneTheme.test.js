import { afterEach, describe, expect, it, vi } from "vitest";
import { NOCTURNE_PRESET } from "./nocturneTheme";
import { applyTheme, getAllThemePresets, getPresetById, getPresetsByCategory } from "./theme";

// applyTheme mutates document.documentElement directly (no React involved), so these are plain DOM assertions.
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.classList.remove("dark");
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("NOCTURNE_PRESET", () => {
  it("only contains solid hex or HSL/OKLCH color values, never rgba (Tailwind wraps every token as hsl(var(--x)))", () => {
    for (const mode of ["dark", "light"]) {
      for (const [key, value] of Object.entries(NOCTURNE_PRESET.styles[mode])) {
        if (key === "radius" || key.startsWith("font-")) continue;
        expect(value, `${mode}.${key}`).not.toMatch(/^rgba?\(/);
        expect(value, `${mode}.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("defines the same set of keys in both dark and light (nothing left unstyled when switching modes)", () => {
    expect(Object.keys(NOCTURNE_PRESET.styles.dark).sort()).toEqual(Object.keys(NOCTURNE_PRESET.styles.light).sort());
  });
});

// applyTheme converts every hex value to an "H S% L%" triplet (that's the format Tailwind's
// hsl(var(--x)) wrapper needs), so assertions check the shape and cross-mode relationships rather than a
// hand-computed HSL string that would just re-implement hexToHsl's rounding to compare against it.
const HSL_TRIPLET = /^\d{1,3} \d{1,3}% \d{1,3}%$/;

describe("applyTheme(NOCTURNE_PRESET)", () => {
  it("sets the dark-mode class and valid HSL-triplet CSS custom properties for every color token", () => {
    applyTheme(NOCTURNE_PRESET);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    for (const key of ["background", "foreground", "card", "primary", "border"]) {
      expect(cssVar(key), key).toMatch(HSL_TRIPLET);
    }
    // #161826 is a near-black navy: low lightness.
    expect(Number(cssVar("background").split(" ")[2].replace('%',''))).toBeLessThan(15);
  });

  it("switches to the light variant, removes the dark class, and keeps the same brand accent in both modes", () => {
    applyTheme(NOCTURNE_PRESET); // dark
    const darkPrimary = cssVar("primary");

    applyTheme(NOCTURNE_PRESET, "light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    // #f3f5fe is near-white: high lightness, the opposite end of the scale from dark mode's background.
    expect(Number(cssVar("background").split(" ")[2].replace('%',''))).toBeGreaterThan(90);
    expect(cssVar("primary")).toBe(darkPrimary); // #9184d9 in both styles.dark and styles.light
  });
});

describe("theme preset lookup includes Nocturne even when the CDN preset list is unreachable", () => {
  it("getAllThemePresets / getPresetById / getPresetsByCategory all find it offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect((await getAllThemePresets()).nocturne).toEqual(NOCTURNE_PRESET);
    expect(await getPresetById("nocturne")).toEqual(NOCTURNE_PRESET);
    expect(await getPresetsByCategory("dark")).toContainEqual(NOCTURNE_PRESET);
  });
});
