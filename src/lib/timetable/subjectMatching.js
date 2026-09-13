/**
 * Matching between three code sources that don't always agree:
 * - the timetable PDF (`24B41EC311`),
 * - registered subjects from the portal (`subject_code`, `subject_desc`),
 * - attendance rows, whose `subjectcode` is really `"NAME(CODE)"` (e.g. `"OPERATING SYSTEM CONCEPTS(24B41EC311)"`).
 *
 * Sometimes the same course has different codes in the PDF and on the portal (seen: VLSI is `26B42EC313` in the PDF
 * but `25B22EC311` in attendance). Those are handled with per-schedule `codeAliases` (timetable code → portal code)
 * that the user confirms; they are never guessed silently.
 */

const CODE_SUFFIX = /\(([^()]+)\)\s*$/;

export function normaliseCode(code) {
  return String(code ?? "").trim().toUpperCase();
}

/** `"NAME(CODE)"` → `"CODE"`; a bare code is returned normalised. */
export function extractSubjectCode(text) {
  const m = CODE_SUFFIX.exec(String(text ?? ""));
  return normaliseCode(m ? m[1] : text);
}

/** `"NAME(CODE)"` → `"NAME"`; text without a code suffix is returned trimmed. */
export function extractSubjectName(text) {
  const s = String(text ?? "");
  const m = CODE_SUFFIX.exec(s);
  return (m ? s.slice(0, m.index) : s).trim();
}

/** Registered subjects (jsjiit `RegisteredSubject`) → Map of code → display name. One subject has one row per component. */
export function subjectNamesByCode(registeredSubjects = []) {
  const names = new Map();
  for (const s of registeredSubjects) {
    const code = normaliseCode(s.subject_code ?? s.subjectcode);
    const name = (s.subject_desc ?? s.subjectdesc ?? "").trim();
    if (code && name && !names.has(code)) names.set(code, name);
  }
  return names;
}

/** Elective codes from the PDF that the student is registered for. */
export function suggestElectives(pdfElectiveCodes = [], registeredSubjects = []) {
  const registered = subjectNamesByCode(registeredSubjects);
  return pdfElectiveCodes.map(normaliseCode).filter((code) => registered.has(code));
}

/**
 * Ranks batches by how many of their batch-specific subject codes the student is registered for. Batches in the same
 * group (e.g. E1–E4) often share every code, so this narrows the choice rather than picking one batch.
 *
 * @returns {Array<{batch: string, matched: number, total: number}>} best matches first; batches with no match omitted
 */
export function rankBatches(entries = [], registeredSubjects = []) {
  const registered = subjectNamesByCode(registeredSubjects);
  const codesByBatch = new Map();
  for (const e of entries) {
    if (e.batches.includes("ALL")) continue;
    for (const b of e.batches) {
      if (!codesByBatch.has(b)) codesByBatch.set(b, new Set());
      codesByBatch.get(b).add(normaliseCode(e.code));
    }
  }
  return [...codesByBatch.entries()]
    .map(([batch, codes]) => ({ batch, matched: [...codes].filter((c) => registered.has(c)).length, total: codes.size }))
    .filter((r) => r.matched > 0)
    .sort((a, b) => b.matched / b.total - a.matched / a.total || b.matched - a.matched || a.batch.localeCompare(b.batch, undefined, { numeric: true }));
}

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Attendance rows (JPortal/portal `studentattendancelist`) → Map of portal code → percentages.
 * Accepts either the raw list or a response object containing it.
 */
export function attendanceByCode(attendance) {
  const list = Array.isArray(attendance)
    ? attendance
    : attendance?.studentattendancelist ?? attendance?.response?.studentattendancelist ?? [];
  const byCode = new Map();
  for (const row of list) {
    const code = extractSubjectCode(row.subjectcode);
    if (!code) continue;
    byCode.set(code, {
      code,
      name: extractSubjectName(row.subjectcode),
      combined: toNumber(row.LTpercantage), // sic: the portal's spelling
      lecture: toNumber(row.Lpercentage),
      tutorial: toNumber(row.Tpercentage),
      practical: toNumber(row.Ppercentage),
    });
  }
  return byCode;
}

/** The portal code to use for a timetable code, applying the schedule's confirmed aliases. */
export function attendanceCodeFor(timetableCode, codeAliases = {}) {
  const code = normaliseCode(timetableCode);
  return normaliseCode(codeAliases[code] ?? code);
}

/**
 * Timetable codes with no attendance row, e.g. because of a code mismatch or a subject with no classes yet. The UI
 * can offer the unmatched attendance subjects as alias candidates.
 */
export function unmatchedCodes(timetableCodes, attendance, codeAliases = {}) {
  const byCode = attendance instanceof Map ? attendance : attendanceByCode(attendance);
  const unmatchedTimetable = [...new Set(timetableCodes.map(normaliseCode))].filter((c) => !byCode.has(attendanceCodeFor(c, codeAliases)));
  const used = new Set(timetableCodes.map((c) => attendanceCodeFor(c, codeAliases)));
  const unusedAttendance = [...byCode.values()].filter((a) => !used.has(a.code));
  return { timetable: unmatchedTimetable, attendance: unusedAttendance };
}
