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

const TYPE_LETTER = { L: "L", T: "T", P: "P" };

/**
 * Home-screen widget snapshot: every class for the day (today, or the next day with classes once today's
 * over), like jiit-widget's own widget - not just the current class plus a couple of upcoming ones, so an
 * updated timetable with many classes left in the day shows all of them, scrollable, with finished classes
 * dimmed rather than dropped. `attendance` is the raw response `w.get_attendance()` already returned to the
 * Attendance screen this session (passed down from App.jsx's state) - the widget has no live portal session
 * of its own, so a class's % only appears once the user has opened Attendance at least once.
 */
export function buildWidgetSnapshot(attendance, goal = DEFAULT_ATTENDANCE_GOAL) {
  const schedule = loadSchedule().schedule;
  if (!schedule || schedule.classes?.length === 0) {
    return { hasSchedule: false };
  }

  const view = buildTodayView(schedule, attendance ?? null, { goal });

  return {
    hasSchedule: true,
    dayLabel: view.label,
    rows: view.rows.map((r) => ({
      short: shortNameFor(r.name, r.code),
      time: r.startText,
      type: TYPE_LETTER[r.type] ?? r.type,
      room: r.room,
      isFinished: r.status === "finished",
      hasPct: r.percent !== null,
      pctText: r.percent !== null ? `${Math.round(r.percent)}%` : "–",
      color: urgencyColor(r.percent, goal),
    })),
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
