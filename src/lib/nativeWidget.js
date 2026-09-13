import { registerPlugin, Capacitor } from "@capacitor/core";
import { loadSchedule } from "./timetable/timetableStore";
import { buildTodayView } from "./timetable/today";
import { shortNameFor } from "./timetable/subjectMatching";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/lib/toastUtils";

const WidgetBridge = registerPlugin("WidgetBridge");

const DEFAULT_ATTENDANCE_GOAL = 75;
// Matches the Nocturne dark palette's chart-1 (safe)/chart-3 (warning)/chart-5 (critical) tokens.
function urgencyColor(pct, goal) {
  if (pct === null || pct === undefined) return "#8b8fa3";
  if (pct >= goal) return "#7dd6a0";
  if (pct >= Math.max(0, goal - 10)) return "#f0c369";
  return "#ef8f8f";
}

function rowSnapshot(row, goal) {
  return {
    short: shortNameFor(row.name),
    name: row.name,
    time: row.startText,
    room: row.room,
    type: row.type,
    hasPct: row.percent !== null,
    pct: row.percent !== null ? Math.round(row.percent) : null,
    color: urgencyColor(row.percent, goal),
  };
}

/**
 * Home-screen widget snapshot: the current/next class plus a couple of upcoming ones, matching the design's
 * widget mock (short acronym name as the title, full name as a subtitle, attendance % badge per row).
 * `attendance` is the raw response `w.get_attendance()` already returned to the Attendance screen this
 * session (passed down from App.jsx's state) - the widget has no live portal session of its own, so it can
 * only show a percentage once the user has opened Attendance at least once.
 */
export function buildWidgetSnapshot(attendance, goal = DEFAULT_ATTENDANCE_GOAL) {
  const schedule = loadSchedule().schedule;
  if (!schedule || schedule.classes?.length === 0) {
    return { hasSchedule: false };
  }

  const view = buildTodayView(schedule, attendance ?? null, { goal });
  const active = view.isToday ? view.rows.find((r) => r.status === "now") : null;
  const upcoming = (view.isToday ? view.rows.filter((r) => r.status === "upcoming") : view.rows).slice(0, 2);
  const allDone = view.isToday && !active && view.rows.length > 0 && view.rows.every((r) => r.status === "finished");

  return {
    hasSchedule: true,
    sectionLabel: view.isToday ? (active ? "Current Class" : "Next Class") : view.label,
    hasActive: !!active,
    active: active ? rowSnapshot(active, goal) : null,
    allDone,
    upcoming: upcoming.map((r) => rowSnapshot(r, goal)),
  };
}

/** Pushes the latest snapshot into the native widget's storage and asks it to redraw. No-op on the web. */
export async function syncWidgetData(attendance, goal) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.syncWidgetData({ json: JSON.stringify(buildWidgetSnapshot(attendance, goal)) });
  } catch (err) {
    console.error("Widget sync failed:", err);
  }
}

/** "Add Widget" button handler: syncs fresh data, then asks Android to prompt the user to pin the widget. */
export async function requestPinHomeScreenWidget(attendance, goal) {
  if (!Capacitor.isNativePlatform()) {
    showWarningToast("Add Widget", "Home-screen widgets are only available in the installed Android app.");
    return;
  }
  try {
    await WidgetBridge.syncWidgetData({ json: JSON.stringify(buildWidgetSnapshot(attendance, goal)) });
    const result = await WidgetBridge.requestPinWidget();
    if (result?.supported === false) {
      showWarningToast("Add Widget", 'Your Android version can\'t add this from the app — long-press your home screen, tap Widgets, and add "JP WebPortal" manually.');
    } else if (result?.accepted === false) {
      showWarningToast("Add Widget", "Widget request was dismissed.");
    } else {
      showSuccessToast("Add Widget", "Check your home screen for the JP WebPortal widget.");
    }
  } catch (err) {
    showErrorToast("Add Widget", err?.message || "Could not add the widget.");
  }
}
