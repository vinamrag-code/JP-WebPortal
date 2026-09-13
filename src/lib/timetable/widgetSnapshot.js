/**
 * The data contract between the web app and the native home-screen widgets (Android AppWidget, iOS WidgetKit).
 *
 * The web app writes this JSON whenever the schedule or attendance changes. The widgets only read it and decide which
 * day to show themselves, because they render at times when the app isn't running (e.g. switching to tomorrow after
 * the last class). So the snapshot carries the **whole week** with attendance already joined, not just today.
 *
 * Keep it small, flat and versioned: both Kotlin and Swift decode it. Bump `WIDGET_SNAPSHOT_VERSION` on breaking changes.
 *
 * ```json
 * {
 *   "version": 1,
 *   "generatedAt": "2026-09-13T10:00:00.000Z",
 *   "attendanceUpdatedAt": "2026-09-13T09:55:00.000Z",   // null if attendance never loaded
 *   "goal": 75,
 *   "classes": [
 *     {"dayIndex": 1, "startMinutes": 660, "durationMinutes": 50, "type": "L",
 *      "code": "24B41EC311", "name": "Operating System Concepts", "room": "226", "percent": 77.8}
 *   ]
 * }
 * ```
 * `dayIndex` is 1 = Monday … 6 = Saturday. `percent` is null when there is no attendance for the subject.
 */
import { attendanceByCode, attendanceCodeFor } from "./subjectMatching";
import { DEFAULT_ATTENDANCE_GOAL } from "./today";

export const WIDGET_SNAPSHOT_VERSION = 1;

export function buildWidgetSnapshot(schedule, attendance, { now = new Date(), attendanceUpdatedAt = null, goal = DEFAULT_ATTENDANCE_GOAL } = {}) {
  const byCode = attendance instanceof Map ? attendance : attendanceByCode(attendance ?? []);
  return {
    version: WIDGET_SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    attendanceUpdatedAt: attendanceUpdatedAt ? new Date(attendanceUpdatedAt).toISOString() : null,
    goal,
    classes: (schedule?.classes ?? []).map((c) => {
      const a = byCode.get(attendanceCodeFor(c.code, schedule.codeAliases));
      return {
        dayIndex: c.dayIndex,
        startMinutes: c.startMinutes,
        durationMinutes: c.durationMinutes,
        type: c.type,
        code: c.code,
        name: c.name ?? a?.name ?? c.code,
        room: c.room ?? "",
        percent: a?.combined ?? null,
      };
    }),
  };
}
