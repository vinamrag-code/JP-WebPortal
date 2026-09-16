import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { calculateClassesCanMiss, calculateClassesNeeded } from "@/lib/math";

const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;

function urgencyColor(pct, goal) {
  if (pct >= goal) return "hsl(var(--chart-1))"; // safe (green)
  if (pct >= Math.max(0, goal - 10)) return "hsl(var(--chart-3))"; // warning (amber)
  return "hsl(var(--chart-5))"; // critical (red)
}

/**
 * One subject's attendance: the design's ring-chart overview row, tap to open a detail sheet with a
 * target-attendance calculator and recent classes. Same data contract as the legacy `AttendanceCard.jsx`
 * it replaces in `Attendance.jsx` — `subject` (from that file's computed `sortedSubjects`),
 * `subjectAttendanceData`/`fetchSubjectAttendance` (daily records, fetched on demand and cached in
 * `AuthenticatedApp` state), `selectedSubject`/`setSelectedSubject` (which card's detail is open),
 * `attendanceGoal`, `subjectCacheStatus` — so it reuses the exact same fetch/cache logic, only the
 * presentation is new.
 */
export default function AttendanceSubjectCard({
  subject,
  selectedSubject,
  setSelectedSubject,
  subjectAttendanceData,
  fetchSubjectAttendance,
  attendanceGoal,
  subjectCacheStatus,
}) {
  const { name, attendance, combined, lecture, tutorial, practical } = subject;
  const goal = typeof attendanceGoal === "number" ? attendanceGoal : 75;

  const [loading, setLoading] = useState(false);
  const [attn, setAttn] = useState(attendance);
  const [target, setTarget] = useState(goal);

  const isFetching = loading || subjectCacheStatus?.[subject.name] === "fetching";
  const isOpen = selectedSubject?.name === subject.name;

  const comb = parseFloat(combined);
  const rawPct = attn.total > 0 ? (Number.isFinite(comb) ? comb : (attn.attended / attn.total) * 100) : (Number.isFinite(comb) ? comb : 100);
  const pct = Math.round(rawPct * 10) / 10;
  const color = urgencyColor(pct, goal);
  const displayName = name.replace(/\s*\([^)]*\)\s*$/, "");

  const daily = subjectAttendanceData[subject.name];

  const recalcFromDaily = useCallback((data) => {
    if (!Array.isArray(data)) return;
    const total = data.length;
    const present = data.filter((d) => d.present === "Present").length;
    setAttn((prev) => (prev.attended === present && prev.total === total ? prev : { attended: present, total }));
  }, []);

  useEffect(() => {
    if (daily) recalcFromDaily(daily);
  }, [daily, recalcFromDaily]);

  useEffect(() => {
    if (!loading && subjectCacheStatus?.[subject.name] === "fetching") setLoading(true);
    if (loading && subjectCacheStatus?.[subject.name] === "cached") setLoading(false);
  }, [subjectCacheStatus, subject.name, loading]);

  const open = async () => {
    setSelectedSubject(subject);
    setTarget(goal);
    if (!daily) {
      setLoading(true);
      await fetchSubjectAttendance(subject);
      setLoading(false);
    }
  };

  const needed = attn.total > 0 ? Math.max(0, calculateClassesNeeded(attn.attended, attn.total, target)) : 0;
  const canMiss = attn.total > 0 ? Math.max(0, calculateClassesCanMiss(attn.attended, attn.total, target)) : 0;
  const calcMessage =
    pct < target
      ? `Attend the next ${needed} class${needed === 1 ? "" : "es"} in a row to reach ${target}%.`
      : `You can miss the next ${canMiss} class${canMiss === 1 ? "" : "es"} and stay at or above ${target}%.`;

  return (
    <>
      <button className="wp-card w-full text-left cursor-pointer" style={{ border: "none" }} onClick={open}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[14.5px]" style={{ color: "hsl(var(--foreground))" }}>{displayName}</div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              {[
                ["Lecture", lecture],
                ["Tutorial", tutorial],
                ["Practical", practical],
              ]
                // The portal sends "" (not null/undefined) for a component that doesn't apply to this
                // subject, so a plain != null check let "Tutorial: %" through with nothing after the colon.
                .filter(([, value]) => value !== "" && value != null && !Number.isNaN(Number(value)))
                .map(([label, value]) => `${label}: ${value}%`)
                .join(" · ") || `${pct}%`}
            </div>
          </div>
          <div
            className="flex-none text-center rounded-lg"
            style={{ background: "color-mix(in srgb, hsl(var(--foreground)) 6%, transparent)", padding: "6px 10px", minWidth: 56 }}
          >
            <div className="text-base font-bold" style={{ color: "hsl(var(--foreground))" }}>{attn.attended}</div>
            <div className="text-[10px] whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>of {attn.total}</div>
          </div>
          <div className="flex flex-col items-center gap-1 flex-none">
            <div className="relative" style={{ width: 46, height: 46 }}>
              {isFetching ? (
                <i className="ph ph-circle-notch" style={{ fontSize: 22, animation: "spin 0.8s linear infinite", color: "hsl(var(--muted-foreground))" }} />
              ) : (
                <>
                  <svg width="46" height="46" viewBox="0 0 46 46">
                    <circle cx="23" cy="23" r={RING_R} fill="none" stroke="hsl(var(--border))" strokeWidth="3.5" />
                    <circle
                      cx="23" cy="23" r={RING_R} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
                      strokeDasharray={`${(pct / 100) * RING_C} ${RING_C}`}
                      transform="rotate(-90 23 23)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold" style={{ color }}>
                    {pct}
                  </div>
                </>
              )}
            </div>
            {pct < goal && !isFetching && (
              <span className="wp-chip" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color, fontSize: 10 }}>
                Attend {Math.max(0, calculateClassesNeeded(attn.attended || 0, attn.total || 0, goal))}
              </span>
            )}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSelectedSubject(null)}>
          <div
            className="w-full rounded-t-2xl p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            style={{ background: "hsl(var(--background))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-1.5 py-2">
              <div
                className="rounded-full flex items-center justify-center text-2xl font-bold"
                style={{ width: 96, height: 96, border: `6px solid ${color}`, color }}
              >
                {pct}%
              </div>
              <div className="text-base font-medium mt-1">{displayName}</div>
              <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {attn.attended}/{attn.total} classes
              </div>
            </div>

            <div className="wp-card gap-3">
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                Reach your target
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>Target attendance</span>
                <span className="text-[15px] font-bold" style={{ color: "hsl(var(--accent-foreground))" }}>{target}%</span>
              </div>
              <input
                type="range"
                min={60}
                max={95}
                step={5}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                style={{ width: "100%", accentColor: "hsl(var(--primary))" }}
              />
              <p className="text-[13.5px] leading-relaxed m-0">{calcMessage}</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                Recent classes
              </div>
              {!daily && <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</p>}
              {/* The portal returns each subject's daily records newest-first already, so no re-sort/reverse needed here. */}
              {daily?.slice(0, 6).map((log, i) => {
                const isPresent = log.present === "Present";
                const logColor = isPresent ? "hsl(var(--chart-1))" : "hsl(var(--chart-5))";
                return (
                  <div key={i} className="wp-card flex-row items-center gap-3" style={{ padding: 10 }}>
                    <i className={`ph-fill ${isPresent ? "ph-check-circle" : "ph-x-circle"}`} style={{ fontSize: 18, color: logColor }} />
                    <div className="flex-1 min-w-0 text-sm">{log.datetime}</div>
                    <span className="text-xs font-semibold" style={{ color: logColor }}>{log.present}</span>
                  </div>
                );
              })}
            </div>

            <button className="wp-btn" onClick={() => setSelectedSubject(null)}>
              <span>Close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

AttendanceSubjectCard.propTypes = {
  subject: PropTypes.object.isRequired,
  selectedSubject: PropTypes.object,
  setSelectedSubject: PropTypes.func.isRequired,
  subjectAttendanceData: PropTypes.object.isRequired,
  fetchSubjectAttendance: PropTypes.func.isRequired,
  attendanceGoal: PropTypes.number,
  subjectCacheStatus: PropTypes.object,
};
