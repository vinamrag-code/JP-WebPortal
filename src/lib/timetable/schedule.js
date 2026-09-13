/**
 * A student's personal weekly schedule: the classes chosen from the parsed PDF (batch plus electives), plus any edits.
 *
 * The schedule is plain JSON (safe for localStorage and for passing to native widgets), and every function here returns
 * a new object rather than mutating. Days use `dayIndex` 1 = Monday … 6 = Saturday, like `Date.getDay()`.
 */
import { selectEntriesForStudent } from "./pdfTimetableParser";
import { normaliseCode, subjectNamesByCode } from "./subjectMatching";

export const SCHEDULE_VERSION = 1;
export const CLASS_TYPES = ["L", "T", "P"];
const MINUTES_PER_DAY = 24 * 60;

/**
 * @param {Array} entries parsed PDF entries (see pdfTimetableParser)
 * @param {{batch: string, electiveCodes?: string[], registeredSubjects?: Array, fileName?: string|null, now?: Date}} options
 */
export function buildSchedule(entries, { batch, electiveCodes = [], registeredSubjects = [], fileName = null, now = new Date() }) {
  const names = subjectNamesByCode(registeredSubjects);
  const classes = selectEntriesForStudent(entries, { batch, electiveCodes }).map((e) => ({
    id: classId(e),
    dayIndex: e.dayIndex,
    startMinutes: e.startMinutes,
    durationMinutes: e.durationMinutes,
    type: e.type,
    code: normaliseCode(e.code),
    name: names.get(normaliseCode(e.code)) ?? null,
    room: e.room,
    teachers: e.teachers,
    batches: e.batches,
  }));
  const stamp = now.toISOString();
  return {
    version: SCHEDULE_VERSION,
    batch: batch.trim().toUpperCase(),
    electiveCodes: electiveCodes.map(normaliseCode),
    fileName,
    createdAt: stamp,
    updatedAt: stamp,
    codeAliases: {},
    classes: sortClasses(classes),
  };
}

/** Why a class can't be saved, or null if it is valid. */
export function validateClass(c) {
  if (!c || typeof c !== "object") return "Class is missing";
  if (!normaliseCode(c.code)) return "Subject code is required";
  if (!Number.isInteger(c.dayIndex) || c.dayIndex < 1 || c.dayIndex > 6) return "Day must be Monday to Saturday";
  if (!CLASS_TYPES.includes(c.type)) return "Type must be Lecture, Tutorial or Practical";
  if (!Number.isInteger(c.startMinutes) || c.startMinutes < 0 || c.startMinutes >= MINUTES_PER_DAY) return "Start time must be within the day";
  if (!Number.isInteger(c.durationMinutes) || c.durationMinutes <= 0) return "End time must be after start time";
  if (c.startMinutes + c.durationMinutes > MINUTES_PER_DAY) return "Class must end by midnight";
  return null;
}

/** Adds a class (no `id` or unknown `id`) or replaces the class with the same `id`. Throws on invalid input. */
export function upsertClass(schedule, cls, now = new Date()) {
  const error = validateClass(cls);
  if (error) throw new Error(error);
  const normalised = { teachers: [], batches: [], room: "", name: null, ...cls, code: normaliseCode(cls.code) };
  const exists = cls.id && schedule.classes.some((c) => c.id === cls.id);
  const classes = exists
    ? schedule.classes.map((c) => (c.id === cls.id ? normalised : c))
    : [...schedule.classes, { ...normalised, id: cls.id ?? newClassId(schedule, normalised) }];
  return touch({ ...schedule, classes: sortClasses(classes) }, now);
}

export function removeClass(schedule, id, now = new Date()) {
  if (!schedule.classes.some((c) => c.id === id)) throw new Error("Class to delete is no longer in the timetable");
  return touch({ ...schedule, classes: schedule.classes.filter((c) => c.id !== id) }, now);
}

/** Records that timetable code `from` is shown on the portal as `to`; pass an empty `to` to remove the alias. */
export function setCodeAlias(schedule, from, to, now = new Date()) {
  const codeAliases = { ...schedule.codeAliases };
  const key = normaliseCode(from);
  if (normaliseCode(to) && normaliseCode(to) !== key) codeAliases[key] = normaliseCode(to);
  else delete codeAliases[key];
  return touch({ ...schedule, codeAliases }, now);
}

/** Classes on a given day, in start order. */
export function classesOn(schedule, dayIndex) {
  return (schedule?.classes ?? []).filter((c) => c.dayIndex === dayIndex);
}

/**
 * Converts the schedule to the event format of JPortal's existing weekly grid (`Timetable.jsx`):
 * `{summary: "L - Name", location, start: Date, end: Date}`, placed in the week containing `referenceDate`.
 */
export function toTimetableEvents(schedule, referenceDate = new Date()) {
  const monday = new Date(referenceDate);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return (schedule?.classes ?? []).map((c) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + c.dayIndex - 1);
    start.setMinutes(c.startMinutes);
    const end = new Date(start.getTime() + c.durationMinutes * 60000);
    return { summary: `${c.type} - ${c.name ?? c.code} (${c.code})`, location: c.room || "N/A", start, end };
  });
}

/** Whether a loaded value looks like a schedule this version can use. */
export function isValidSchedule(value) {
  return (
    !!value &&
    value.version === SCHEDULE_VERSION &&
    Array.isArray(value.classes) &&
    value.classes.every((c) => validateClass(c) === null && typeof c.id === "string") &&
    typeof (value.codeAliases ?? {}) === "object"
  );
}

function sortClasses(classes) {
  return [...classes].sort((a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes || a.code.localeCompare(b.code));
}

function touch(schedule, now) {
  return { ...schedule, updatedAt: now.toISOString() };
}

function classId(c) {
  return `${c.dayIndex}-${c.startMinutes}-${c.type}-${normaliseCode(c.code)}`;
}

function newClassId(schedule, c) {
  const base = classId(c);
  let id = base;
  for (let n = 2; schedule.classes.some((x) => x.id === id); n++) id = `${base}-${n}`;
  return id;
}
