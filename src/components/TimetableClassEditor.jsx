import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { validateClass } from "@/lib/timetable/schedule";
import { normaliseCode, subjectNamesByCode } from "@/lib/timetable/subjectMatching";
import { formatMinutes } from "@/lib/timetable/today";

const CUSTOM_SUBJECT = "__custom__";

const DAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];
const TYPE_OPTIONS = [
  { value: "L", label: "Lecture" },
  { value: "T", label: "Tutorial" },
  { value: "P", label: "Practical" },
];

const toHHMM = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 24 && min >= 0 && min < 60 ? h * 60 + min : null;
};

/**
 * Add/edit a single class. `initial` is a class from `schedule.classes`, or null to add a new one.
 * `existingAlias` pre-fills the "portal calls it" field when the timetable code already has a confirmed alias.
 */
export default function TimetableClassEditor({ open, onOpenChange, initial, existingAlias, onSave, onDelete, defaultDayIndex = 1, defaultStartMinutes = 540, registeredSubjects = [] }) {
  const [dayIndex, setDayIndex] = useState(String(initial?.dayIndex ?? defaultDayIndex));
  const [start, setStart] = useState(initial ? toHHMM(initial.startMinutes) : toHHMM(defaultStartMinutes));
  const [end, setEnd] = useState(initial ? toHHMM(initial.startMinutes + initial.durationMinutes) : toHHMM(defaultStartMinutes + 50));
  const [type, setType] = useState(initial?.type ?? "L");
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [room, setRoom] = useState(initial?.room ?? "");
  const [teachers, setTeachers] = useState((initial?.teachers ?? []).join(", "));
  const [portalCode, setPortalCode] = useState(existingAlias ?? "");
  const [error, setError] = useState(null);

  const subjectOptions = useMemo(
    () => [...subjectNamesByCode(registeredSubjects).entries()]
      .map(([subjCode, subjName]) => ({ code: subjCode, name: subjName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [registeredSubjects],
  );
  // Registered subjects have one row per L/T/P component, each with its own faculty - grouped here so
  // picking a subject (and later, its class type) can auto-fill the right teacher for that component.
  const componentsByCode = useMemo(() => {
    const map = new Map();
    for (const s of registeredSubjects) {
      const subjCode = normaliseCode(s.subject_code ?? s.subjectcode);
      const compType = s.subject_component_code ?? s.subjectcomponentcode;
      const teacher = (s.employee_name ?? "").trim();
      if (!subjCode || !teacher) continue;
      if (!map.has(subjCode)) map.set(subjCode, []);
      map.get(subjCode).push({ type: compType, teacher });
    }
    return map;
  }, [registeredSubjects]);
  const teacherFor = (subjCode, forType) => {
    const components = componentsByCode.get(subjCode);
    if (!components?.length) return null;
    return (components.find((c) => c.type === forType) ?? components[0]).teacher;
  };

  const initialMatch = subjectOptions.find((s) => s.code === normaliseCode(initial?.code ?? ""));
  const [selectedSubject, setSelectedSubject] = useState(() => {
    if (initial) return initialMatch ? initialMatch.code : CUSTOM_SUBJECT;
    return subjectOptions.length ? "" : CUSTOM_SUBJECT;
  });
  const showManualFields = selectedSubject === CUSTOM_SUBJECT || (selectedSubject === "" && subjectOptions.length === 0);

  const handleSubjectSelect = (value) => {
    setSelectedSubject(value);
    const match = subjectOptions.find((s) => s.code === value);
    if (match) {
      setCode(match.code);
      setName(match.name);
      const teacher = teacherFor(match.code, type);
      if (teacher) setTeachers(teacher);
    }
  };

  const handleTypeSelect = (value) => {
    setType(value);
    if (selectedSubject && selectedSubject !== CUSTOM_SUBJECT) {
      const teacher = teacherFor(selectedSubject, value);
      if (teacher) setTeachers(teacher);
    }
  };

  const preview = useMemo(() => {
    const s = toMinutes(start);
    const e = toMinutes(end);
    return s !== null && e !== null && e > s ? `${formatMinutes(s)} – ${formatMinutes(e)}` : null;
  }, [start, end]);

  const handleSave = () => {
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    const candidate = {
      ...(initial ? { id: initial.id } : {}),
      dayIndex: Number(dayIndex),
      startMinutes,
      durationMinutes: startMinutes !== null && endMinutes !== null ? endMinutes - startMinutes : -1,
      type,
      code: normaliseCode(code),
      name: name.trim() || null,
      room: room.trim(),
      teachers: teachers.split(",").map((t) => t.trim()).filter(Boolean),
      batches: initial?.batches ?? [],
    };
    const validationError = validateClass(candidate);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(candidate, normaliseCode(portalCode) || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit class" : "Add class"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Select value={dayIndex} onValueChange={setDayIndex}>
                <SelectTrigger data-testid="day-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={handleTypeSelect}>
                <SelectTrigger data-testid="type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="class-start">Start</Label>
              <Input id="class-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-end">End</Label>
              <Input id="class-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {preview && <p className="text-xs text-muted-foreground">{preview}</p>}

          {subjectOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={handleSubjectSelect}>
                <SelectTrigger data-testid="subject-select"><SelectValue placeholder="Choose a subject…" /></SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_SUBJECT}>Custom / other subject…</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {showManualFields && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="class-code">Subject code</Label>
                <Input id="class-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="24B41EC311" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="class-name">Subject name</Label>
                <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Operating System Concepts" />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="class-room">Room</Label>
              <Input id="class-room" value={room} onChange={(e) => setRoom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-teachers">Teacher(s)</Label>
              <Input id="class-teachers" value={teachers} onChange={(e) => setTeachers(e.target.value)} placeholder="ANG, PAA" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="class-portal-code">Portal calls this subject (only if different)</Label>
            <Input
              id="class-portal-code"
              value={portalCode}
              onChange={(e) => setPortalCode(e.target.value)}
              placeholder={code || "e.g. 25B22EC311"}
            />
            <p className="text-xs text-muted-foreground">
              If today&apos;s attendance for this class shows as missing, the portal may list it under a
              different code. Enter that code here to match it.
            </p>
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {onDelete ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            ) : <span />}
            <Button type="button" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

TimetableClassEditor.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  initial: PropTypes.object,
  existingAlias: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  defaultDayIndex: PropTypes.number,
  defaultStartMinutes: PropTypes.number,
  registeredSubjects: PropTypes.array,
};
