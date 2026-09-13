import { useState } from "react";
import PropTypes from "prop-types";
import { classesOn } from "@/lib/timetable/schedule";
import { formatMinutes } from "@/lib/timetable/today";
import TimetableClassEditor from "./TimetableClassEditor";

const DAYS = [
  { index: 1, short: "Mon" },
  { index: 2, short: "Tue" },
  { index: 3, short: "Wed" },
  { index: 4, short: "Thu" },
  { index: 5, short: "Fri" },
  { index: 6, short: "Sat" },
];

/** Fixed 08:00-17:50 hourly slots, 50 minutes each - matches the JIIT timetable's own column layout. */
const SLOT_STARTS = [480, 540, 600, 660, 720, 780, 840, 900, 960, 1020];
const TYPE_COLOR = { L: "hsl(var(--chart-2))", T: "hsl(var(--chart-3))", P: "hsl(var(--chart-1))" };

/**
 * The student's personal weekly schedule (from a PDF import): a day-by-time-slot grid matching the design,
 * one column per day and one row per class period. A filled cell opens the existing class for edit/delete;
 * an empty cell opens the same editor pre-filled with that day and time to add a new class. Reuses
 * `TimetableClassEditor` (already validated/tested) as the actual edit form - only the grid's visual shape
 * changes here.
 */
export default function ScheduleGrid({ schedule, todayDayIndex, onSaveClass, onDeleteClass }) {
  const [editing, setEditing] = useState(null); // { class: obj|null, dayIndex, startMinutes } | null = closed

  const classAt = (dayIndex, slotStart) =>
    classesOn(schedule, dayIndex).find((c) => c.startMinutes < slotStart + 60 && c.startMinutes + c.durationMinutes > slotStart);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Tap a slot to add or remove a class.</p>

      <div className="wp-hscroll overflow-x-auto pb-2">
        <div style={{ minWidth: 680, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "56px repeat(6, 1fr)", gap: 4 }}>
            <div />
            {DAYS.map((d) => (
              <div
                key={d.index}
                className="text-center text-[11px] font-bold"
                style={{ color: d.index === todayDayIndex ? "hsl(var(--accent-foreground))" : "hsl(var(--muted-foreground))" }}
              >
                {d.short}
              </div>
            ))}
          </div>

          {SLOT_STARTS.map((slotStart) => (
            <div key={slotStart} style={{ display: "grid", gridTemplateColumns: "56px repeat(6, 1fr)", gap: 4 }}>
              <div className="text-[10px] flex items-center whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>
                {formatMinutes(slotStart)}
              </div>
              {DAYS.map((d) => {
                const c = classAt(d.index, slotStart);
                if (c) {
                  const color = TYPE_COLOR[c.type];
                  return (
                    <button
                      key={d.index}
                      data-testid={`class-${c.id}`}
                      onClick={() => setEditing({ class: c })}
                      className="rounded-lg text-center"
                      style={{
                        background: `color-mix(in srgb, ${color} 18%, transparent)`,
                        border: `1px solid ${color}`,
                        color,
                        fontSize: 11,
                        fontWeight: 700,
                        minHeight: 38,
                        cursor: "pointer",
                        padding: "4px 2px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.name ?? c.code}
                    </button>
                  );
                }
                return (
                  <button
                    key={d.index}
                    data-testid={`empty-${d.index}-${slotStart}`}
                    onClick={() => setEditing({ class: null, dayIndex: d.index, startMinutes: slotStart })}
                    className="rounded-lg flex items-center justify-center"
                    style={{
                      border: "1.5px dashed hsl(var(--border))",
                      background: "transparent",
                      color: "hsl(var(--muted-foreground))",
                      fontSize: 9,
                      fontWeight: 600,
                      minHeight: 38,
                      cursor: "pointer",
                    }}
                  >
                    + Add
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <TimetableClassEditor
          open
          onOpenChange={(open) => !open && setEditing(null)}
          initial={editing.class}
          defaultDayIndex={editing.dayIndex}
          defaultStartMinutes={editing.startMinutes}
          existingAlias={editing.class ? schedule.codeAliases?.[editing.class.code] : undefined}
          onSave={(cls, alias) => {
            onSaveClass(editing.class, cls, alias);
            setEditing(null);
          }}
          onDelete={editing.class ? () => { onDeleteClass(editing.class.id); setEditing(null); } : undefined}
        />
      )}
    </div>
  );
}

ScheduleGrid.propTypes = {
  schedule: PropTypes.object.isRequired,
  todayDayIndex: PropTypes.number,
  onSaveClass: PropTypes.func.isRequired,
  onDeleteClass: PropTypes.func.isRequired,
};
