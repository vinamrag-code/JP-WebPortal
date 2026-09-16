/**
 * Persists the student's schedule in localStorage. Works in the browser and in Capacitor WebViews (Android and iOS).
 *
 * Saving also refreshes the event list used by JPortal's existing weekly grid (`timetable_modified_events`), so the
 * current Timetable page shows an uploaded schedule without changes.
 */
import { isValidSchedule, toTimetableEvents } from "./schedule";
import { removeTimetableModifiedEvents, setTimetableModifiedEvents } from "@/components/scripts/cache";

export const SCHEDULE_STORAGE_KEY = "jp_timetable_schedule_v1";

/** @returns {{schedule: object|null, status: "none"|"ok"|"unreadable"}} */
export function loadSchedule(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage?.getItem(SCHEDULE_STORAGE_KEY);
  } catch {
    return { schedule: null, status: "unreadable" };
  }
  if (!raw) return { schedule: null, status: "none" };
  try {
    const parsed = JSON.parse(raw);
    return isValidSchedule(parsed) ? { schedule: parsed, status: "ok" } : { schedule: null, status: "unreadable" };
  } catch {
    return { schedule: null, status: "unreadable" };
  }
}

/** @throws {Error} if the schedule is invalid or storage is full/unavailable */
export function saveSchedule(schedule, storage = globalThis.localStorage) {
  if (!isValidSchedule(schedule)) throw new Error("Refusing to save an invalid schedule");
  storage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
  if (storage === globalThis.localStorage) setTimetableModifiedEvents(toTimetableEvents(schedule));
}

export function clearSchedule(storage = globalThis.localStorage) {
  storage.removeItem(SCHEDULE_STORAGE_KEY);
  if (storage === globalThis.localStorage) removeTimetableModifiedEvents();
}
