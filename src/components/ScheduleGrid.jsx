import { useState } from "react";
import PropTypes from "prop-types";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { classesOn } from "@/lib/timetable/schedule";
import { formatMinutes } from "@/lib/timetable/today";
import TimetableClassEditor from "./TimetableClassEditor";

const DAYS = [
  { index: 1, label: "Monday" },
  { index: 2, label: "Tuesday" },
  { index: 3, label: "Wednesday" },
  { index: 4, label: "Thursday" },
  { index: 5, label: "Friday" },
  { index: 6, label: "Saturday" },
];
const TYPE_LABEL = { L: "Lecture", T: "Tutorial", P: "Practical" };
const TYPE_COLOR = {
  L: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  T: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  P: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

/**
 * The student's personal weekly schedule (from a PDF import), one column per day, with click-to-edit and
 * an "Add class" action. Mirrors the visual language of the legacy ICS-based grid in `Timetable.jsx`.
 */
export default function ScheduleGrid({ schedule, todayDayIndex, onSaveClass, onDeleteClass }) {
  const [editing, setEditing] = useState(null); // { class: obj|null } — null = dialog closed

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Weekly Schedule</h2>
        <Button variant="outline" size="sm" onClick={() => setEditing({ class: null })} data-testid="add-class-button">
          <PlusCircle className="w-4 h-4 mr-2" /> Add class
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {DAYS.map((day) => {
          const dayClasses = classesOn(schedule, day.index);
          const isToday = day.index === todayDayIndex;
          return (
            <div key={day.index} className={`flex flex-col gap-3 p-1 rounded-lg ${isToday ? "bg-amber-500/5 ring-2 ring-amber-400" : ""}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 pt-1 ${isToday ? "text-amber-600" : "text-muted-foreground/60"}`}>
                {day.label}
              </span>
              <div className={`flex flex-col gap-2 p-2 rounded-lg border min-h-[140px] ${dayClasses.length ? "bg-muted/10" : "border-dashed border-border/30"}`}>
                {dayClasses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEditing({ class: c })}
                    data-testid={`class-${c.id}`}
                    className="text-left p-3 rounded-lg bg-card border shadow-sm transition-transform hover:scale-[1.02]"
                  >
                    <Badge variant="outline" className={`mb-1.5 text-[8px] h-3.5 px-1.5 font-bold uppercase rounded-md ${TYPE_COLOR[c.type]}`}>
                      {TYPE_LABEL[c.type]}
                    </Badge>
                    <p className="font-bold text-[10.5px] leading-tight mb-2">{c.name ?? c.code}</p>
                    <div className="space-y-1 text-[9px] text-muted-foreground font-medium">
                      <div>{formatMinutes(c.startMinutes)} – {formatMinutes(c.startMinutes + c.durationMinutes)}</div>
                      {c.room && <Badge variant="secondary" className="text-[11px] font-black bg-primary/20 text-primary border-none h-5 rounded-md">{c.room}</Badge>}
                    </div>
                  </button>
                ))}
                {dayClasses.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground/40">
                    No classes
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <TimetableClassEditor
          open
          onOpenChange={(open) => !open && setEditing(null)}
          initial={editing.class}
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
