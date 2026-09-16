import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAttendanceFromCache, getUsername, saveAttendanceToCache } from "@/components/scripts/cache";
import { loadSchedule } from "@/lib/timetable/timetableStore";
import { buildTodayView, DEFAULT_ATTENDANCE_GOAL } from "@/lib/timetable/today";

const REFRESH_MS = 60_000; // re-derive "now" often enough to catch a class finishing or the day rolling over

const TYPE_LABEL = { L: "Lecture", T: "Tutorial", P: "Practical" };

/**
 * "Today's classes" card, shown on both the Timetable and Attendance pages. Reads the schedule saved by
 * `PdfTimetableImport`/`ScheduleGrid`, and attendance either from the portal's own cache (instant, if the
 * Attendance page has already loaded it this session) or a light fetch of its own otherwise. Renders nothing
 * if no schedule has been imported yet, other than a prompt to import one.
 */
export default function TodaySection({ w, attendanceGoal }) {
  const [now, setNow] = useState(() => new Date());
  const [schedule, setSchedule] = useState(undefined); // undefined = not loaded yet
  const [attendance, setAttendance] = useState(null);
  const [attendanceError, setAttendanceError] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    setSchedule(loadSchedule().schedule);
    const tick = setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => clearInterval(tick);
  }, []);

  const refreshAttendance = useMemo(
    () => async () => {
      if (!w?.session) return;
      setLoadingAttendance(true);
      setAttendanceError(null);
      try {
        const meta = await w.get_attendance_meta();
        const header = meta.latest_header();
        const semester = meta.latest_semester();
        const username = getUsername();

        const cached = await getAttendanceFromCache(username, semester);
        if (cached) {
          setAttendance(cached.data || cached);
        }
        const fresh = await w.get_attendance(header, semester);
        setAttendance(fresh);
        await saveAttendanceToCache(fresh, username, semester);
      } catch (err) {
        setAttendanceError(err?.message || "Couldn't load attendance");
      } finally {
        setLoadingAttendance(false);
      }
    },
    [w],
  );

  useEffect(() => {
    if (schedule) refreshAttendance();
    // Deliberately not depending on refreshAttendance's identity beyond `w`/`schedule` changing, to avoid a
    // refetch loop every time attendance state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, w]);

  if (schedule === undefined) return null; // avoids a flash of the "import" prompt before localStorage is read

  if (!schedule) {
    return (
      <Card className="border-dashed border-border/50" data-testid="today-empty">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Import your timetable to see today&apos;s classes here.</p>
          <Link to="/timetable">
            <Button variant="outline" size="sm">Import timetable</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const view = buildTodayView(schedule, attendance, { now, goal: attendanceGoal ?? DEFAULT_ATTENDANCE_GOAL });

  return (
    <Card data-testid="today-section">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-bold">{view.label}</CardTitle>
        <div className="flex items-center gap-2">
          {attendanceError && <span className="text-[10px] text-destructive">{attendanceError}</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refreshAttendance} disabled={loadingAttendance}>
            {loadingAttendance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {view.rows.length === 0 && <p className="text-sm text-muted-foreground">No classes.</p>}
        {view.rows.map((row) => (
          <div
            key={row.id}
            data-testid={`today-row-${row.id}`}
            className={`flex items-center justify-between p-2 rounded-md border ${row.status === "finished" ? "opacity-50" : row.status === "now" ? "border-primary/40 bg-primary/5" : "border-border/50"}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">{TYPE_LABEL[row.type]}</Badge>
                <span className="font-semibold text-sm truncate">{row.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{row.startText} – {row.endText}{row.room ? ` · ${row.room}` : ""}</p>
            </div>
            <span
              className={`text-sm font-bold ${row.percent === null ? "text-muted-foreground" : row.belowGoal ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              {row.percent === null ? "–" : `${Math.round(row.percent)}%`}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

TodaySection.propTypes = {
  w: PropTypes.object,
  attendanceGoal: PropTypes.number,
};
