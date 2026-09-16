import { describe, expect, it } from "vitest";
import { buildTodayView, formatMinutes } from "./today";
import { buildWidgetSnapshot } from "./widgetSnapshot";

const cls = (id, dayIndex, startMinutes, durationMinutes, type, code, extra = {}) => ({ id, dayIndex, startMinutes, durationMinutes, type, code, room: "R", teachers: [], batches: ["E1"], name: null, ...extra });

const schedule = {
  version: 1,
  codeAliases: { "26B42EC313": "25B22EC311" },
  classes: [
    cls("a", 1, 660, 50, "L", "24B41EC311", { name: "OS Concepts", room: "226" }),
    cls("b", 1, 840, 110, "P", "24B45EC311", { room: "142" }),
    cls("c", 2, 540, 50, "L", "26B42EC313"),
    cls("d", 6, 720, 50, "L", "18B11EC212"),
  ],
};
const attendance = [
  { subjectcode: "OPERATING SYSTEM CONCEPTS(24B41EC311)", LTpercantage: 77.8 },
  { subjectcode: "OPERATING SYSTEM CONCEPTS LAB(24B45EC311)", LTpercantage: 60 },
  { subjectcode: "VLSI(25B22EC311)", LTpercantage: 93.3 },
];

/** 14 Sep 2026 is a Monday. */
const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute);

describe("buildTodayView", () => {
  it("shows today's classes with attendance, goal and live status", () => {
    const view = buildTodayView(schedule, attendance, { now: at(14, 11, 20), goal: 75 });
    expect(view).toMatchObject({ label: "Today", dayIndex: 1, isToday: true });
    expect(view.rows).toEqual([
      { id: "a", code: "24B41EC311", name: "OS Concepts", type: "L", startText: "11:00 AM", endText: "11:50 AM", room: "226", percent: 77.8, belowGoal: false, status: "now" },
      { id: "b", code: "24B45EC311", name: "OPERATING SYSTEM CONCEPTS LAB", type: "P", startText: "2:00 PM", endText: "3:50 PM", room: "142", percent: 60, belowGoal: true, status: "upcoming" },
    ]);
  });

  it("marks finished classes and respects a custom goal", () => {
    const view = buildTodayView(schedule, attendance, { now: at(14, 12), goal: 80 });
    expect(view.rows.map((r) => [r.status, r.belowGoal])).toEqual([["finished", true], ["upcoming", true]]);
  });

  it("switches to tomorrow after the last class, applying code aliases", () => {
    const view = buildTodayView(schedule, attendance, { now: at(14, 15, 50) });
    expect(view).toMatchObject({ label: "Tomorrow", dayIndex: 2, isToday: false });
    expect(view.rows[0]).toMatchObject({ code: "26B42EC313", name: "VLSI", percent: 93.3, status: "upcoming" });
  });

  it("skips empty days, and Saturday evening shows Monday while Sunday shows Tomorrow", () => {
    expect(buildTodayView(schedule, attendance, { now: at(16, 9) })).toMatchObject({ label: "Saturday", dayIndex: 6 }); // Wed → Sat
    expect(buildTodayView(schedule, attendance, { now: at(19, 18) })).toMatchObject({ label: "Monday", dayIndex: 1 });
    expect(buildTodayView(schedule, attendance, { now: at(20, 10) })).toMatchObject({ label: "Tomorrow", dayIndex: 1 });
  });

  it("works without attendance or without a schedule", () => {
    const row = buildTodayView(schedule, null, { now: at(14, 9) }).rows[0];
    expect(row).toMatchObject({ percent: null, belowGoal: null, name: "OS Concepts" });
    expect(buildTodayView(null, attendance, { now: at(14, 9) })).toEqual({ label: "Today", dayIndex: 1, isToday: true, rows: [] });
  });

  it("formats times on a 12-hour clock", () => {
    expect([0, 5, 540, 720, 840, 1439].map(formatMinutes)).toEqual(["12:00 AM", "12:05 AM", "9:00 AM", "12:00 PM", "2:00 PM", "11:59 PM"]);
  });
});

describe("buildWidgetSnapshot", () => {
  it("carries the whole week with attendance joined, for native widgets to pick the day", () => {
    const snap = buildWidgetSnapshot(schedule, attendance, {
      now: new Date("2026-09-14T05:00:00Z"),
      attendanceUpdatedAt: "2026-09-14T04:55:00Z",
      goal: 75,
    });
    expect(snap).toMatchObject({ version: 1, generatedAt: "2026-09-14T05:00:00.000Z", attendanceUpdatedAt: "2026-09-14T04:55:00.000Z", goal: 75 });
    expect(snap.classes).toHaveLength(4);
    expect(snap.classes[2]).toEqual({ dayIndex: 2, startMinutes: 540, durationMinutes: 50, type: "L", code: "26B42EC313", name: "VLSI", room: "R", percent: 93.3 });
    expect(snap.classes[3].percent).toBeNull();
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap); // plain JSON only
    expect(buildWidgetSnapshot(null, null, { now: new Date(0) }).classes).toEqual([]);
  });
});
