import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { classesOn, removeClass, setCodeAlias, upsertClass } from "@/lib/timetable/schedule";
import { formatMinutes } from "@/lib/timetable/today";
import { loadSchedule, saveSchedule, clearSchedule } from "@/lib/timetable/timetableStore";
import { attendanceCodeFor, subjectNamesByCode } from "@/lib/timetable/subjectMatching";
import { showErrorToast, showSuccessToast, showWarningToast } from "@/lib/toastUtils";
import PdfTimetableImport from "@/components/PdfTimetableImport";
import ScheduleGrid from "@/components/ScheduleGrid";
import { requestPinHomeScreenWidget, syncWidgetData } from "@/lib/nativeWidget";

const DAYS = [
  { index: 1, short: "Mon", full: "Monday" },
  { index: 2, short: "Tue", full: "Tuesday" },
  { index: 3, short: "Wed", full: "Wednesday" },
  { index: 4, short: "Thu", full: "Thursday" },
  { index: 5, short: "Fri", full: "Friday" },
  { index: 6, short: "Sat", full: "Saturday" },
];

const TYPE_LABEL = { L: "Lecture", T: "Tutorial", P: "Practical" };
const TYPE_COLOR = { L: "hsl(var(--chart-2))", T: "hsl(var(--chart-3))", P: "hsl(var(--chart-1))" };

function todayDayIndex() {
  const jsDay = new Date().getDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 1 : jsDay; // no classes modeled for Sunday; default to Monday
}

/**
 * Timetable screen matching the design: a day-chip picker with that day's classes, a week-grid toggle, and
 * Edit/Import actions. Renders the real schedule built in J1-J3 (`loadSchedule()`, the same PDF-parsed data
 * `PdfTimetableImport`/`ScheduleGrid` already produce and edit) — this screen only adds a new way to browse
 * it; saving, editing, and the PDF importer are the exact same components and logic, unchanged.
 */
export default function TimetableScreen({ registeredSubjects = [] }) {
  const [schedule, setSchedule] = useState(() => loadSchedule().schedule);
  const [selectedDay, setSelectedDay] = useState(todayDayIndex());
  const [mode, setMode] = useState("view"); // 'view' | 'edit' | 'import'

  const namesByCode = useMemo(() => subjectNamesByCode(registeredSubjects), [registeredSubjects]);
  // `c.name` was baked in at PDF-import time and falls back to the bare code when registeredSubjects was
  // empty then - prefer a live match from currently-loaded registeredSubjects over that stale fallback.
  const nameFor = (c) => namesByCode.get(attendanceCodeFor(c.code, schedule?.codeAliases)) || (c.name && c.name !== c.code ? c.name : c.code);

  useEffect(() => {
    syncWidgetData();
  }, [schedule]);

  const handleSaveClass = (original, updated, portalAlias) => {
    try {
      let next = { ...schedule, classes: upsertClass(schedule, updated).classes };
      if (portalAlias !== undefined) next = setCodeAlias(next, updated.code, portalAlias || "");
      saveSchedule(next);
      setSchedule(next);
      showSuccessToast("Timetable", original ? "Class updated." : "Class added.");
    } catch (err) {
      showErrorToast("Timetable", err?.message || "Could not save this class.");
    }
  };

  const handleDeleteClass = (id) => {
    try {
      const next = removeClass(schedule, id);
      saveSchedule(next);
      setSchedule(next);
      showSuccessToast("Timetable", "Class removed.");
    } catch (err) {
      showErrorToast("Timetable", err?.message || "Could not delete this class.");
    }
  };

  const handleAddWidget = async () => {
    try {
      await requestPinHomeScreenWidget();
    } catch (err) {
      showWarningToast("Add Widget", err?.message || "Could not add the widget.");
    }
  };

  if (mode === "import" || !schedule) {
    return (
      <div className="px-4 py-3 flex flex-col gap-3">
        {schedule && (
          <button className="wp-icon-btn self-start" onClick={() => setMode("view")} aria-label="Cancel">
            <i className="ph ph-x" /> <span className="text-sm ml-1">Cancel</span>
          </button>
        )}
        <PdfTimetableImport
          registeredSubjects={registeredSubjects}
          onSaved={(s) => { setSchedule(s); setMode("view"); }}
        />
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button className="wp-icon-btn" onClick={() => setMode("view")} aria-label="Done">
            <i className="ph ph-check" /> <span className="text-sm ml-1">Done</span>
          </button>
          <button
            className="wp-icon-btn"
            style={{ color: "hsl(var(--destructive))" }}
            onClick={() => {
              if (confirm("Discard all your timetable edits and go back to importing a fresh PDF?")) {
                clearSchedule();
                setSchedule(null);
                setMode("import");
              }
            }}
          >
            <i className="ph ph-trash" /> <span className="text-sm ml-1">Reset</span>
          </button>
        </div>
        <ScheduleGrid
          schedule={schedule}
          todayDayIndex={todayDayIndex()}
          onSaveClass={handleSaveClass}
          onDeleteClass={handleDeleteClass}
        />
      </div>
    );
  }

  const dayClasses = classesOn(schedule, selectedDay).sort((a, b) => a.startMinutes - b.startMinutes);

  return (
    <div className="px-4 py-3 flex flex-col gap-3.5">
      <div className="flex gap-2">
        <button className="wp-btn" style={{ minHeight: 38, fontSize: 12 }} onClick={() => setMode("edit")}>
          <i className="ph ph-pencil-simple" style={{ fontSize: 14 }} /><span>Edit</span>
        </button>
        <button
          className="wp-btn"
          style={{ minHeight: 38, fontSize: 12, borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
          onClick={handleAddWidget}
        >
          <i className="ph ph-plus-circle" style={{ fontSize: 14 }} /><span>Add Widget</span>
        </button>
        <button
          className="wp-btn"
          style={{ minHeight: 38, fontSize: 12, borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
          onClick={() => setMode("import")}
        >
          <i className="ph ph-upload-simple" style={{ fontSize: 14 }} /><span>Upload</span>
        </button>
      </div>

      <div className="wp-hscroll flex gap-1.5 overflow-x-auto pb-0.5">
        {DAYS.map((d) => (
          <button
            key={d.index}
            onClick={() => setSelectedDay(d.index)}
            className="wp-seg-opt flex-none"
            style={{
              borderRadius: 20,
              border: "1px solid hsl(var(--border))",
              background: selectedDay === d.index ? "hsl(var(--accent))" : "transparent",
              color: selectedDay === d.index ? "hsl(var(--accent-foreground))" : "hsl(var(--muted-foreground))",
            }}
          >
            {d.short}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {dayClasses.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: "hsl(var(--muted-foreground))" }}>No classes.</p>
        )}
        {dayClasses.map((c) => (
          <div key={c.id} className="wp-card flex-row items-center gap-3">
            <div className="flex-none rounded-full" style={{ width: 2, alignSelf: "stretch", background: TYPE_COLOR[c.type] }} />
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] font-medium truncate">{nameFor(c)}</div>
              {nameFor(c) !== c.code && (
                <div className="text-[10.5px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{c.code}</div>
              )}
              <div className="text-[11.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                {formatMinutes(c.startMinutes)} – {formatMinutes(c.startMinutes + c.durationMinutes)}
              </div>
              <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {c.room}{c.teachers?.length ? ` · ${c.teachers.join("/")}` : ""}
              </div>
            </div>
            <span
              className="wp-chip flex-none"
              style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
            >
              {TYPE_LABEL[c.type]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

TimetableScreen.propTypes = {
  registeredSubjects: PropTypes.array,
};
