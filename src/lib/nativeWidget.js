import { registerPlugin, Capacitor } from "@capacitor/core";
import { loadSchedule } from "./timetable/timetableStore";
import { buildTodayView } from "./timetable/today";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/lib/toastUtils";

const WidgetBridge = registerPlugin("WidgetBridge");

/**
 * Home-screen widget snapshot: the current/next class plus a couple of upcoming ones, matching the design's
 * widget mock. Schedule-only for now (no attendance %) — the widget doesn't have access to a live portal
 * session, so it reads only what's already saved locally by `PdfTimetableImport`/`ScheduleGrid`.
 */
export function buildWidgetSnapshot() {
  const schedule = loadSchedule().schedule;
  if (!schedule || schedule.classes?.length === 0) {
    return { hasSchedule: false };
  }

  const view = buildTodayView(schedule, null);
  const active = view.isToday ? view.rows.find((r) => r.status === "now") : null;
  const upcoming = (view.isToday ? view.rows.filter((r) => r.status === "upcoming") : view.rows).slice(0, 2);
  const allDone = view.isToday && !active && view.rows.length > 0 && view.rows.every((r) => r.status === "finished");

  return {
    hasSchedule: true,
    sectionLabel: view.isToday ? (active ? "Current Class" : "Next Class") : view.label,
    hasActive: !!active,
    active: active ? { name: active.name, time: `${active.startText} – ${active.endText}`, room: active.room, type: active.type } : null,
    allDone,
    upcoming: upcoming.map((r) => ({ name: r.name, time: r.startText, type: r.type })),
  };
}

/** Pushes the latest snapshot into the native widget's storage and asks it to redraw. No-op on the web. */
export async function syncWidgetData() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.syncWidgetData({ json: JSON.stringify(buildWidgetSnapshot()) });
  } catch (err) {
    console.error("Widget sync failed:", err);
  }
}

/** "Add Widget" button handler: syncs fresh data, then asks Android to prompt the user to pin the widget. */
export async function requestPinHomeScreenWidget() {
  if (!Capacitor.isNativePlatform()) {
    showWarningToast("Add Widget", "Home-screen widgets are only available in the installed Android app.");
    return;
  }
  try {
    await WidgetBridge.syncWidgetData({ json: JSON.stringify(buildWidgetSnapshot()) });
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
