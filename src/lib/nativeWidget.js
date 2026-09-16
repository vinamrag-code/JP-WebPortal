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

function toWidgetRow(r, goal) {
  return {
    short: shortNameFor(r.name, r.code),
    name: r.name,
    time: r.startText,
    type: TYPE_LETTER[r.type] ?? r.type,
    room: r.room,
    isFinished: r.status === "finished",
    hasPct: r.percent !== null,
    pctText: r.percent !== null ? `${Math.round(r.percent)}%` : "–",
    color: urgencyColor(r.percent, goal),
  };
}

/**
 * Home-screen widget snapshot, matching the "JP WebPortal" Nocturne design (Claude Design canvas): a
 * featured card up top for the current class (or, once it's over, the next one) labelled "Current Class" /
 * "Next Class", then every other class of the day below as its own row - like jiit-widget's own widget, not
 * just a couple of upcoming ones, so a busy remaining day shows all of it, scrollable. The featured class
 * is not repeated in that list. Finished classes there are dimmed (not dropped) by the native side, which
 * applies `isFinished` as reduced row alpha rather than recolouring text.
 *
 * `attendance` is the raw response `w.get_attendance()` already returned to the Attendance screen this
 * session (passed down from App.jsx's state) - the widget has no live portal session of its own, so a
 * class's % only appears once the user has opened Attendance at least once.
 */
export function buildWidgetSnapshot(attendance, goal = DEFAULT_ATTENDANCE_GOAL) {
  const schedule = loadSchedule().schedule;
  if (!schedule || schedule.classes?.length === 0) {
    return { hasSchedule: false };
  }

  const view = buildTodayView(schedule, attendance ?? null, { goal });

  const activeRow = view.rows.find((r) => r.status === "now") ?? view.rows.find((r) => r.status === "upcoming") ?? null;
  const activeLabel = activeRow ? (activeRow.status === "now" ? "Current Class" : "Next Class") : "";

  return {
    hasSchedule: true,
    dayLabel: view.label,
    activeLabel,
    active: activeRow ? toWidgetRow(activeRow, goal) : null,
    rows: view.rows.filter((r) => r !== activeRow).map((r) => toWidgetRow(r, goal)),
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
