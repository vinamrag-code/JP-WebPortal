/**
 * "Today" view logic shared by the web Today section and the widget snapshot (a JS port of ScheduleBuilder from the
 * native jiit-widget app).
 *
 * Day choice: today's classes until today's last class ends, then the next day that has classes (Saturday evening and
 * Sunday show Monday).
 */
import { attendanceByCode, attendanceCodeFor } from "./subjectMatching";

export const DEFAULT_ATTENDANCE_GOAL = 75;

/** `840` → `"2:00 PM"` */
export function formatMinutes(minutesOfDay) {
  const h24 = Math.floor(minutesOfDay / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutesOfDay % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * @param {object|null} schedule see schedule.js
 * @param {Array|object|Map|null} attendance attendance rows, a response containing them, or an `attendanceByCode` Map
 * @param {{now?: Date, goal?: number}} options
 * @returns {{label: string, dayIndex: number|null, isToday: boolean, rows: Array<TodayRow>}}
 *
 * @typedef {object} TodayRow
 * @property {string} id
 * @property {string} code timetable code
 * @property {string} name
 * @property {"L"|"T"|"P"} type
 * @property {string} startText
 * @property {string} endText
 * @property {string} room
 * @property {number|null} percent the subject's overall attendance, or null if unknown
 * @property {boolean|null} belowGoal null when percent is unknown
 * @property {"finished"|"now"|"upcoming"} status
 */
export function buildTodayView(schedule, attendance, { now = new Date(), goal = DEFAULT_ATTENDANCE_GOAL } = {}) {
  const classes = schedule?.classes ?? [];
  const byCode = attendance instanceof Map ? attendance : attendanceByCode(attendance ?? []);
  const today = now.getDay(); // 0 = Sunday
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todays = classesOn(classes, today);
  const todayOver = todays.length === 0 || nowMinutes >= Math.max(...todays.map((c) => c.startMinutes + c.durationMinutes));

  if (!todayOver) {
    return {
      label: "Today",
      dayIndex: today,
      isToday: true,
      rows: todays.map((c) => row(c, schedule, byCode, goal, statusAt(c, nowMinutes))),
    };
  }

  const next = nextDayWithClasses(classes, today);
  if (next === null) return { label: "Today", dayIndex: today, isToday: true, rows: [] };
  return {
    label: next === (today + 1) % 7 ? "Tomorrow" : DAY_NAMES[next],
    dayIndex: next,
    isToday: false,
    rows: classesOn(classes, next).map((c) => row(c, schedule, byCode, goal, "upcoming")),
  };
}

function classesOn(classes, dayIndex) {
  return classes.filter((c) => c.dayIndex === dayIndex).sort((a, b) => a.startMinutes - b.startMinutes);
}

/** Next weekday after `today` (wrapping through the week, ending with today itself) that has classes. */
function nextDayWithClasses(classes, today) {
  for (let offset = 1; offset <= 7; offset++) {
    const day = (today + offset) % 7;
    if (classes.some((c) => c.dayIndex === day)) return day;
  }
  return null;
}

function statusAt(c, nowMinutes) {
  if (nowMinutes >= c.startMinutes + c.durationMinutes) return "finished";
  if (nowMinutes >= c.startMinutes) return "now";
  return "upcoming";
}

function row(c, schedule, byCode, goal, status) {
  const attendance = byCode.get(attendanceCodeFor(c.code, schedule?.codeAliases));
  const percent = attendance?.combined ?? null;
  return {
    id: c.id,
    code: c.code,
    name: c.name ?? attendance?.name ?? c.code,
    type: c.type,
    startText: formatMinutes(c.startMinutes),
    endText: formatMinutes(c.startMinutes + c.durationMinutes),
    room: c.room ?? "",
    percent,
    belowGoal: percent === null ? null : percent < goal,
    status,
  };
}
