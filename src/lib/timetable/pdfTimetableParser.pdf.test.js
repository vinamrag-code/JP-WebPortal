// @vitest-environment node
import fs from "fs";
import os from "os";
import path from "path";
import process from "process";
import { describe, expect, it } from "vitest";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPdfPages, parseTimetablePages, selectEntriesForStudent } from "./pdfTimetableParser";

/**
 * Golden test against the real official PDF. The PDF is not committed; point TIMETABLE_PDF at it, or keep it at the
 * default path below. Skipped when absent.
 *
 * Expected E1 result = the 22 slots verified three ways in ~/jiit-widget Phase 5 (against the rendered pages, against
 * jiit-planner-cdn, and against the portal's own per-class attendance records).
 */
const PDF_PATH =
  process.env.TIMETABLE_PDF ??
  path.join(os.homedir(), "Documents", "2026_ B. Tech.  III Yr(V SEMESTER) TIMETABLE ODD SEMESTER 2026, JIIT-128 - Sheet2.pdf");
const available = fs.existsSync(PDF_PATH);

const EXPECTED_E1 = [
  "MONDAY 11:00 50 L E1,E2 24B41EC311 226 ANG",
  "MONDAY 14:00 110 P E1 24B45EC311 142 RAP",
  "TUESDAY 08:00 50 L ALL 26B42EC311 244B ASR",
  "TUESDAY 09:00 50 L ALL 26B42EC313 228 HIG",
  "TUESDAY 10:00 50 L E1,E2 20B13HS311 CR54 SHV",
  "TUESDAY 12:00 50 L E1,E2 24B41EC311 CR54 ANG",
  "WEDNESDAY 08:00 50 L ALL 18B12MA312 3040 MUKESH",
  "WEDNESDAY 09:00 50 L ALL 26B42EC311 230 ASR",
  "WEDNESDAY 10:00 50 T E1 24B41EC311 138 ANG",
  "WEDNESDAY 12:00 50 L E1,E2 20B13HS311 CR54 SHV",
  "WEDNESDAY 14:00 110 P E1 18B15EC212 256A KDT",
  "THURSDAY 08:00 50 L ALL 26B42EC313 230 HIG",
  "THURSDAY 09:00 50 L ALL 18B12MA312 3040 MUKESH",
  "THURSDAY 10:00 50 T E1 18B11EC212 229 PAA",
  "THURSDAY 12:00 50 L E1,E2 18B11EC212 230 PAA",
  "FRIDAY 09:00 50 L ALL 18B12MA312 3040 MUKESH",
  "FRIDAY 10:00 50 L E1,E2 18B11EC212 226 PAA",
  "FRIDAY 12:00 50 L E1,E2 24B41EC311 230 ANG",
  "FRIDAY 15:00 50 L E1,E2 20B13HS311 226 SHV",
  "SATURDAY 08:00 50 L ALL 26B42EC313 230 HIG",
  "SATURDAY 09:00 50 L ALL 26B42EC311 230 ASR",
  "SATURDAY 12:00 50 L E1,E2 18B11EC212 138 PAA",
];

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const describeEntry = (e) =>
  [e.day, hhmm(e.startMinutes), e.durationMinutes, e.type, e.batches.join(","), e.code, e.room, e.teachers.join("/")].join(" ");

describe.skipIf(!available)("official JIIT-128 Sem V timetable PDF", () => {
  let parsed;
  let pages;
  const load = async () => {
    if (!parsed) {
      pages = await extractPdfPages(fs.readFileSync(PDF_PATH), pdfjs);
      parsed = parseTimetablePages(pages);
    }
    return parsed;
  };

  it("reproduces the verified E1 schedule exactly", async () => {
    const { entries } = await load();
    const mine = selectEntriesForStudent(entries, { batch: "E1", electiveCodes: ["18B12MA312", "26B42EC311", "26B42EC313"] });
    expect(mine.map(describeEntry)).toEqual(EXPECTED_E1);
  }, 30000);

  it("reads every entry in the grid, reporting only the sheet's own typos", async () => {
    const { entries, batches, electives, warnings } = await load();
    const entryStarts = pages.slice(0, 2).flatMap((p) => p.items).filter((i) => /^[LTP]\s*(ALL|FXFY|[A-Z]{1,3}\d)/.test(i.str));
    expect(entries).toHaveLength(entryStarts.length);
    expect(entries).toHaveLength(267);
    expect(batches).toEqual(["E1", "E2", "E3", "E4", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "F13", "F14", "F16", "F17", "F18", "F19"]);
    expect(electives).toHaveLength(20);
    expect(warnings).toHaveLength(4);
    expect(warnings.join("\n")).toMatch(/F1819/);
  }, 30000);
});
