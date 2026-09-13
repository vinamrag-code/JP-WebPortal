import { describe, expect, it } from "vitest";
import { buildSchedule, classesOn, isValidSchedule, removeClass, setCodeAlias, toTimetableEvents, upsertClass, validateClass } from "./schedule";
import { SCHEDULE_STORAGE_KEY, clearSchedule, loadSchedule, saveSchedule } from "./timetableStore";

const NOW = new Date("2026-09-13T10:00:00Z");
const entries = [
  { dayIndex: 1, startMinutes: 660, durationMinutes: 50, type: "L", batches: ["E1", "E2"], code: "24B41EC311", room: "226", teachers: ["ANG"] },
  { dayIndex: 1, startMinutes: 840, durationMinutes: 110, type: "P", batches: ["E1"], code: "24B45EC311", room: "142", teachers: ["RAP"] },
  { dayIndex: 1, startMinutes: 840, durationMinutes: 110, type: "P", batches: ["E2"], code: "18B15EC212", room: "256A", teachers: ["KDT"] },
  { dayIndex: 2, startMinutes: 480, durationMinutes: 50, type: "L", batches: ["ALL"], code: "26B42EC311", room: "244B", teachers: ["ASR"] },
  { dayIndex: 2, startMinutes: 540, durationMinutes: 50, type: "L", batches: ["ALL"], code: "19B12CS413", room: "148", teachers: [] },
];
const registered = [{ subject_code: "24B41EC311", subject_desc: "OPERATING SYSTEM CONCEPTS" }];

const build = () => buildSchedule(entries, { batch: " e1 ", electiveCodes: ["26b42ec311"], registeredSubjects: registered, fileName: "tt.pdf", now: NOW });

describe("buildSchedule", () => {
  it("keeps the batch's classes and chosen electives, with names where known", () => {
    const s = build();
    expect(s).toMatchObject({ version: 1, batch: "E1", electiveCodes: ["26B42EC311"], fileName: "tt.pdf", createdAt: NOW.toISOString(), codeAliases: {} });
    expect(s.classes.map((c) => [c.id, c.code, c.name])).toEqual([
      ["1-660-L-24B41EC311", "24B41EC311", "OPERATING SYSTEM CONCEPTS"],
      ["1-840-P-24B45EC311", "24B45EC311", null],
      ["2-480-L-26B42EC311", "26B42EC311", null],
    ]);
    expect(isValidSchedule(s)).toBe(true);
    expect(classesOn(s, 1)).toHaveLength(2);
  });
});

describe("editing", () => {
  it("edits a class in place without mutating the original", () => {
    const s = build();
    const edited = upsertClass(s, { ...s.classes[0], room: "CR54", teachers: ["XYZ"] }, new Date("2026-09-14T00:00:00Z"));
    expect(edited.classes[0]).toMatchObject({ id: "1-660-L-24B41EC311", room: "CR54", teachers: ["XYZ"] });
    expect(s.classes[0].room).toBe("226");
    expect(edited.updatedAt).toBe("2026-09-14T00:00:00.000Z");
  });

  it("moving a class re-sorts; adding gets a unique id; deleting removes", () => {
    let s = build();
    s = upsertClass(s, { ...s.classes[0], dayIndex: 6, startMinutes: 900 });
    expect(s.classes.at(-1)).toMatchObject({ id: "1-660-L-24B41EC311", dayIndex: 6 });

    s = upsertClass(s, { dayIndex: 2, startMinutes: 480, durationMinutes: 50, type: "L", code: "26b42ec311" });
    expect(s.classes.filter((c) => c.code === "26B42EC311").map((c) => c.id)).toEqual(["2-480-L-26B42EC311", "2-480-L-26B42EC311-2"]);
    expect(s.classes.find((c) => c.id.endsWith("-2"))).toMatchObject({ room: "", teachers: [], name: null });

    s = removeClass(s, "2-480-L-26B42EC311-2");
    expect(s.classes.some((c) => c.id.endsWith("-2"))).toBe(false);
    expect(() => removeClass(s, "missing")).toThrow(/no longer/);
  });

  it("rejects invalid classes", () => {
    const base = build().classes[0];
    expect(validateClass(base)).toBeNull();
    expect(validateClass({ ...base, code: " " })).toMatch(/code/);
    expect(validateClass({ ...base, dayIndex: 0 })).toMatch(/Monday to Saturday/);
    expect(validateClass({ ...base, type: "X" })).toMatch(/Type/);
    expect(validateClass({ ...base, durationMinutes: 0 })).toMatch(/after start/);
    expect(validateClass({ ...base, startMinutes: 23 * 60 + 30 })).toMatch(/midnight/);
    expect(() => upsertClass(build(), { ...base, durationMinutes: -5 })).toThrow();
  });

  it("sets and clears code aliases", () => {
    let s = setCodeAlias(build(), "26b42ec313", "25b22ec311");
    expect(s.codeAliases).toEqual({ "26B42EC313": "25B22EC311" });
    s = setCodeAlias(s, "26B42EC313", "");
    expect(s.codeAliases).toEqual({});
  });
});

describe("toTimetableEvents (JPortal weekly grid format)", () => {
  it("places classes in the reference week with the L/T/P prefix the grid expects", () => {
    const events = toTimetableEvents(build(), new Date(2026, 8, 16, 18, 0)); // Wednesday 16 Sep 2026
    expect(events[0].summary).toBe("L - OPERATING SYSTEM CONCEPTS (24B41EC311)");
    expect(events[0].location).toBe("226");
    expect(events[0].start).toEqual(new Date(2026, 8, 14, 11, 0)); // Monday of that week
    expect(events[0].end).toEqual(new Date(2026, 8, 14, 11, 50));
    expect(events[1].summary).toBe("P - 24B45EC311 (24B45EC311)");
    expect(events[1].end).toEqual(new Date(2026, 8, 14, 15, 50));
    expect(events[2].start.getDay()).toBe(2);
  });

  it("uses the same week when the reference date is a Sunday", () => {
    const events = toTimetableEvents(build(), new Date(2026, 8, 20, 9, 0)); // Sunday 20 Sep
    expect(events[0].start).toEqual(new Date(2026, 8, 14, 11, 0));
  });
});

describe("timetableStore", () => {
  it("round-trips the schedule and refreshes the legacy grid events", () => {
    expect(loadSchedule()).toEqual({ schedule: null, status: "none" });
    const s = build();
    saveSchedule(s);
    expect(loadSchedule()).toEqual({ schedule: s, status: "ok" });
    expect(JSON.parse(localStorage.getItem("timetable_modified_events"))).toHaveLength(3);

    clearSchedule();
    expect(loadSchedule().status).toBe("none");
    expect(localStorage.getItem("timetable_modified_events")).toBeNull();
  });

  it("reports corrupt or wrong-version data as unreadable and refuses invalid saves", () => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, "{oops");
    expect(loadSchedule().status).toBe("unreadable");
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({ ...build(), version: 99 }));
    expect(loadSchedule().status).toBe("unreadable");
    expect(() => saveSchedule({ version: 1, classes: [{}] })).toThrow(/invalid/);
  });
});
