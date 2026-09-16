import PropTypes from "prop-types";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function dateKey(date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function sameDay(a, b) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

/**
 * "Day-to-day" tab: a month calendar (days with any recorded class are selectable) plus every class across
 * all subjects on the selected day, matching the design. Same data contract as the legacy
 * `AttendanceDaily.jsx` it replaces — `dailyDate`/`setDailyDate` (shared with `Attendance.jsx`'s other
 * state) and `subjects`/`subjectAttendanceData` (the same per-subject daily records already fetched and
 * cached), so switching subjects/semesters upstream keeps working unchanged.
 */
export default function AttendanceDailyView({ dailyDate, setDailyDate, subjects, subjectAttendanceData }) {
  const selected = dailyDate instanceof Date && !Number.isNaN(dailyDate) ? dailyDate : new Date();

  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  const leadingBlanks = (monthStart.getDay() + 6) % 7; // Monday-first grid

  const classesOn = (date) => {
    const key = dateKey(date);
    const out = [];
    for (const subject of subjects) {
      const daily = subjectAttendanceData[subject.name];
      if (!daily) continue;
      for (const entry of daily) {
        if (entry.datetime.startsWith(key)) out.push({ subject: subject.name.replace(/\s*\([^)]*\)\s*$/, ""), ...entry });
      }
    }
    return out;
  };

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(selected.getFullYear(), selected.getMonth(), day));

  const selectedClasses = classesOn(selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="wp-card gap-2.5">
        <div className="text-[12.5px] font-semibold text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
          {selected.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((w, i) => (
            <div key={i} className="text-[10px] font-semibold text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const hasLog = classesOn(date).length > 0;
            const isSelected = sameDay(date, selected);
            return (
              <button
                key={i}
                disabled={!hasLog}
                onClick={() => hasLog && setDailyDate(date)}
                className="rounded-full text-xs font-semibold flex items-center justify-center"
                style={{
                  aspectRatio: "1",
                  border: isSelected ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                  background: isSelected ? "hsl(var(--accent))" : "transparent",
                  color: isSelected ? "hsl(var(--accent-foreground))" : hasLog ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                  opacity: hasLog ? 1 : 0.35,
                  cursor: hasLog ? "pointer" : "default",
                }}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[12.5px] font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
          {selected.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}
        </div>
        {selectedClasses.length === 0 && (
          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>No classes recorded for this day.</p>
        )}
        {selectedClasses.map((cls, i) => {
          const isPresent = cls.present === "Present";
          const color = isPresent ? "hsl(var(--chart-1))" : "hsl(var(--chart-5))";
          const time = (cls.datetime.match(/\(([^)]+)\)/) || [])[1] || cls.datetime;
          return (
            <div key={i} className="wp-card flex-row items-center gap-3">
              <i className={`ph-fill ${isPresent ? "ph-check-circle" : "ph-x-circle"}`} style={{ fontSize: 18, color, flex: "none" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{cls.subject}</div>
                <div className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{time}</div>
              </div>
              <span className="text-xs font-semibold flex-none" style={{ color }}>{cls.present}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

AttendanceDailyView.propTypes = {
  dailyDate: PropTypes.instanceOf(Date),
  setDailyDate: PropTypes.func.isRequired,
  subjects: PropTypes.array.isRequired,
  subjectAttendanceData: PropTypes.object.isRequired,
};
