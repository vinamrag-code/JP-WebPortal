/**
 * JIIT timetable PDF parser.
 *
 * Reads the official college timetable PDF (the grid with days down the side and hourly columns across the top)
 * and turns every cell entry into a structured class. It uses text *positions*, not just text: an entry's
 * horizontal centre gives its time column and its vertical position gives its day.
 *
 * Cell entries look like `<L|T|P><batches>(<subject code>)-<room>/<teacher>[/<teacher>…]`, e.g.
 * `LE1E2(24B41EC311)- 226/ANG` or `PE1(24B45EC311)-142/RAP`. Electives shared by every batch use `ALL`,
 * e.g. `LALL(18B12MA312)-3040/MUKESH`.
 *
 * Pure JavaScript with no DOM or platform APIs, so it runs the same in the browser, in Capacitor apps on
 * Android and iOS, and in Node tests. The caller supplies pdf.js ({@link extractPdfPages}).
 *
 * Built and verified against "B.Tech III Yr (V Sem) Timetable, Odd Semester 2026, JIIT-128". Other sheets
 * that use the same grid format should work; anything unusual is reported in `warnings` rather than guessed
 * silently, and users can fix the result in the editor.
 */

export const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const DAY_LABEL = /^(MON|TUE|TUES|WED|WEDNES|THU|THUR|THURS|FRI|SAT|SATUR)(DAY)?$/i;
const ENTRY_START = /^[LTP]\s*(?:ALL|FXFY|[A-Z]{1,3}\d{1,2})/;
const ENTRY = /^([LTP])\s*((?:\s*(?:ALL|FXFY|[A-Z]{1,3}\d+))+)\s*\(\s*([0-9A-Z]+)\s*\)\s*(.*)$/;
/** End time of a header such as "8 - 8:50 AM", "3:00 PM - 3 :50 PM" or "1:00 PM - 1:50PM". */
const HEADER_END_TIME = /(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)\s*$/i;

/** Classes in the grid last 50 minutes per hourly column (a 2-column lab runs 110 minutes). */
const SLOT_MINUTES = 50;
/** Max vertical gap (pt) between a wrapped line and the line above it in the same cell. */
const WRAP_MAX_GAP = 14;

/**
 * Loads a PDF with the given pdf.js build and returns positioned text per page, with y measured from the top.
 *
 * @param {ArrayBuffer|Uint8Array} data PDF bytes. They are copied, so the caller's buffer is never detached by pdf.js.
 * @param {object} pdfjs a pdf.js module (e.g. `pdfjs-dist/legacy/build/pdf.mjs`).
 * @returns {Promise<Array<{width:number,height:number,items:Array<{str:string,x:number,y:number,w:number,h:number}>}>>}
 */
export async function extractPdfPages(data, pdfjs) {
  // pdf.js rejects Node Buffers (a Uint8Array subclass), so always hand it a plain Uint8Array copy.
  const bytes = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
    : new Uint8Array(data.slice(0));
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const { width, height } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items
        .filter((i) => typeof i.str === "string" && i.str.trim())
        .map((i) => ({ str: i.str.trim(), x: i.transform[4], y: height - i.transform[5], w: i.width, h: i.height }));
      pages.push({ width, height, items });
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/**
 * Parses positioned text into classes.
 *
 * @param {Array<{items:Array<{str:string,x:number,y:number,w:number,h:number}>}>} pages from {@link extractPdfPages}
 * @returns {{entries: Array<TimetableEntry>, batches: string[], electives: string[], warnings: string[]}}
 *
 * @typedef {object} TimetableEntry
 * @property {string} day e.g. "MONDAY"
 * @property {number} dayIndex 1 = Monday … 6 = Saturday (same numbering as JS `Date.getDay()`)
 * @property {number} startMinutes minutes after midnight
 * @property {number} durationMinutes 50 per hourly column
 * @property {"L"|"T"|"P"} type lecture / tutorial / practical
 * @property {string[]} batches e.g. ["E1","E2"], or ["ALL"] for an elective
 * @property {string} code subject code as printed, e.g. "24B41EC311"
 * @property {string} room
 * @property {string[]} teachers abbreviations as printed
 * @property {string} raw the joined source text
 * @property {number} page 1-based
 */
export function parseTimetablePages(pages) {
  const warnings = [];
  const entries = [];
  let columns = null;
  let carryDay = null; // day still running at the bottom of the previous page

  pages.forEach((page, pageIndex) => {
    columns = findColumns(page.items) ?? columns;
    const labels = findDayLabels(page.items, columns);
    if (!columns || (labels.length === 0 && !carryDay)) {
      return; // no grid on this page (e.g. the faculty/course tables)
    }

    const gridTop = columns.headerBottom;
    const gridBottom = findGridBottom(page, gridTop);
    const bands = dayBands(labels, gridTop, gridBottom, carryDay);
    if (labels.length) carryDay = labels[labels.length - 1].day;

    const inGrid = page.items.filter((i) => i.y > gridTop && i.y < gridBottom && i.x > columns.gridLeft && !isNoise(i));
    for (const fragment of joinWrappedLines(inGrid)) {
      if (!ENTRY_START.test(fragment.text)) continue;
      const parsed = parseEntryText(fragment.text);
      if (!parsed) {
        warnings.push(`Page ${pageIndex + 1}: couldn't read "${fragment.text}"`);
        continue;
      }
      const centreY = fragment.y + fragment.h / 2;
      const band = bands.find((b) => centreY >= b.top && centreY < b.bottom);
      if (!band) {
        warnings.push(`Page ${pageIndex + 1}: no day found for "${fragment.text}"`);
        continue;
      }
      const slot = slotFor(columns.centres, (fragment.x0 + fragment.x1) / 2, parsed.type);
      if (parsed.warning) warnings.push(`Page ${pageIndex + 1}: ${parsed.warning} in "${fragment.text}"`);
      entries.push({
        day: band.day,
        dayIndex: DAYS.indexOf(band.day) + 1,
        startMinutes: columns.startMinutes[slot.index],
        durationMinutes: slot.span * 60 - (60 - SLOT_MINUTES),
        type: parsed.type,
        batches: parsed.batches,
        code: parsed.code,
        room: parsed.room,
        teachers: parsed.teachers,
        raw: fragment.text,
        page: pageIndex + 1,
      });
    }
  });

  if (!columns) warnings.push("No time columns found; is this a JIIT timetable PDF?");

  entries.sort((a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes || a.code.localeCompare(b.code));
  const batches = [...new Set(entries.flatMap((e) => e.batches).filter((b) => b !== "ALL"))].sort(naturalCompare);
  const electives = [...new Set(entries.filter((e) => e.batches.includes("ALL")).map((e) => e.code))].sort();
  return { entries, batches, electives, warnings };
}

/**
 * The classes one student attends: every entry for their batch, plus shared (`ALL`) entries whose code they chose.
 *
 * @param {TimetableEntry[]} entries
 * @param {{batch: string, electiveCodes?: string[]}} selection
 */
export function selectEntriesForStudent(entries, { batch, electiveCodes = [] }) {
  const wanted = batch.trim().toUpperCase();
  const electives = new Set(electiveCodes.map((c) => c.trim().toUpperCase()));
  return entries.filter((e) => e.batches.includes(wanted) || (e.batches.includes("ALL") && electives.has(e.code)));
}

/** Convenience: load, then parse. */
export async function parseTimetablePdf(data, pdfjs) {
  return parseTimetablePages(await extractPdfPages(data, pdfjs));
}

/**
 * Parses one entry's text. Exported for tests.
 * @returns {{type:string,batches:string[],code:string,room:string,teachers:string[],warning?:string}|null}
 */
export function parseEntryText(text) {
  const m = ENTRY.exec(text.replace(/\s+/g, " ").trim());
  if (!m) return null;
  const [, type, batchText, code, rest] = m;
  const detail = rest.replace(/^[\s\-–—]+/, "").trim();
  // Split positionally: in "-/VAIBHAV SHARMA" the room is blank and must not be filled by the teacher.
  // Stray dashes around parts ("3067-", "-AKB") are typing noise in the sheet.
  let [room = "", ...teacherParts] = detail.split("/").map(cleanPart);
  const { batches, malformed } = readBatches(batchText);

  const problems = [];
  if (malformed.length) problems.push(`unusual batch list ${malformed.join(", ")} read as ${batches.join(", ")}`);
  if (detail && !detail.includes("/")) {
    // e.g. "244VAISHNAVI": the room number runs straight into the teacher's name.
    const joined = /^([A-Z]{0,3}\d+)([A-Z]{4,}(?: [A-Z]+)*)$/.exec(room);
    if (joined) [, room, teacherParts[0]] = joined;
  }
  const result = { type, batches, code, room, teachers: teacherParts.filter(Boolean) };

  if (!detail) problems.push("no room or teacher");
  else if (!detail.includes("/")) problems.push("room and teacher not separated by '/'");
  else {
    if (!room) problems.push("no room");
    if (result.teachers.length === 0) problems.push("no teacher");
  }
  if (problems.length) result.warning = problems.join("; ");
  return result;
}

function cleanPart(part) {
  return part.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "");
}

/**
 * Batch tokens like E1, F12, FXFY, ALL. The PDF occasionally drops a letter ("F1819" for "F18F19"), so a run of 3–4
 * digits after the letter is split into two-digit batch numbers and reported as malformed.
 */
function readBatches(batchText) {
  const batches = [];
  const malformed = [];
  for (const token of batchText.replace(/\s+/g, "").match(/ALL|FXFY|[A-Z]{1,3}\d+/g) ?? []) {
    const m = /^([A-Z]{1,3})(\d{3,4})$/.exec(token);
    if (m && token !== "FXFY") {
      malformed.push(token);
      const digits = m[2];
      const first = digits.length === 4 ? digits.slice(0, 2) : digits.slice(0, 1);
      batches.push(`${m[1]}${first}`, `${m[1]}${digits.slice(first.length)}`);
    } else {
      batches.push(token);
    }
  }
  return { batches, malformed };
}

// ---------------------------------------------------------------------------------------------------------------

function findColumns(items) {
  const headers = items
    .map((i) => ({ item: i, m: HEADER_END_TIME.exec(i.str) }))
    .filter(({ item, m }) => m && /-/.test(item.str) && item.y < 120)
    .map(({ item, m }) => {
      let hour = Number(m[1]) % 12;
      if (m[3].toUpperCase() === "PM") hour += 12;
      return { item, endMinutes: hour * 60 + Number(m[2]) };
    })
    .sort((a, b) => a.item.x - b.item.x);
  if (headers.length < 3) return null;

  return {
    centres: headers.map((h) => h.item.x + h.item.w / 2),
    startMinutes: headers.map((h) => h.endMinutes - SLOT_MINUTES),
    headerBottom: Math.max(...headers.map((h) => h.item.y + h.item.h)) + 1,
    // Anything left of the first column's left edge is the day-label column.
    gridLeft: headers[0].item.x - (headers[1].item.x - headers[0].item.x) / 2,
  };
}

function findDayLabels(items, columns) {
  const left = columns ? columns.gridLeft : Infinity;
  return items
    .filter((i) => DAY_LABEL.test(i.str) && i.x < left)
    .map((i) => ({ day: normaliseDay(i.str), centre: i.y + i.h / 2 }))
    .filter((l) => l.day)
    .sort((a, b) => a.centre - b.centre);
}

function normaliseDay(label) {
  const prefix = label.slice(0, 3).toUpperCase();
  return DAYS.find((d) => d.startsWith(prefix)) ?? null;
}

/** The grid ends where the faculty/course tables begin, or at the page end. */
function findGridBottom(page, gridTop) {
  const tableHeader = page.items.find((i) => /Faculty Abbreviation|COURSE CODE/i.test(i.str) && i.y > gridTop);
  return tableHeader ? tableHeader.y - 1 : page.height ?? Infinity;
}

/**
 * Day labels are vertically centred in their row band, so band edges sit halfway between neighbouring labels,
 * and the outermost edges mirror the nearest gap. Rows above the first label belong to the day carried over
 * from the previous page (a label repeated at the top of the page is treated the same way).
 */
function dayBands(labels, gridTop, gridBottom, carryDay) {
  if (labels.length === 0) return carryDay ? [{ day: carryDay, top: gridTop, bottom: gridBottom }] : [];
  const bands = labels.map((label, i) => {
    const prev = labels[i - 1];
    const next = labels[i + 1];
    const halfUp = prev ? (label.centre - prev.centre) / 2 : next ? (next.centre - label.centre) / 2 : Infinity;
    const halfDown = next ? (next.centre - label.centre) / 2 : prev ? (label.centre - prev.centre) / 2 : Infinity;
    return { day: label.day, top: label.centre - halfUp, bottom: Math.min(label.centre + halfDown, gridBottom) };
  });
  if (carryDay && bands[0].top > gridTop && bands[0].day !== carryDay) {
    bands.unshift({ day: carryDay, top: gridTop, bottom: bands[0].top });
  }
  bands[0].top = Math.min(bands[0].top, gridTop);
  return bands;
}

function isNoise(item) {
  return /^\d{1,3}$/.test(item.str); // page numbers
}

/**
 * Re-joins entries that wrap onto several lines inside a cell, e.g. "LF10F11F12F13F14F16F17F18F19" followed by
 * "(26B12CS311) -226/JDK", or "LF1…F9(26B12CS318) -244" followed by "B/JSH". A line that doesn't start a new entry
 * is appended to the closest fragment just above it that overlaps horizontally.
 */
function joinWrappedLines(items) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const fragments = [];
  for (const item of sorted) {
    const x0 = item.x;
    const x1 = item.x + item.w;
    if (!ENTRY_START.test(item.str)) {
      const above = fragments
        .filter((f) => item.y - f.lastY > 0.5 && item.y - f.lastY <= WRAP_MAX_GAP && x0 < f.x1 && x1 > f.x0)
        .sort((a, b) => b.lastY - a.lastY || Math.abs(centre(a) - (x0 + x1) / 2) - Math.abs(centre(b) - (x0 + x1) / 2))[0];
      if (above) {
        above.text = joinText(above.text, item.str);
        above.x0 = Math.min(above.x0, x0);
        above.x1 = Math.max(above.x1, x1);
        above.lastY = item.y;
        continue;
      }
    }
    fragments.push({ text: item.str, x0, x1, y: item.y, h: item.h, lastY: item.y });
  }
  return fragments;
}

function centre(f) {
  return (f.x0 + f.x1) / 2;
}

/** Joins wrapped text: "VAIBHAV" + "SHARMA" gets a space; "-244" + "B/JSH" and "…F19" + "(26B…" do not. */
function joinText(a, b) {
  return /[A-Za-z]$/.test(a) && /^[A-Za-z]/.test(b) ? `${a} ${b}` : `${a}${b}`;
}

/**
 * Picks the hourly column for an entry centred at `x`. A practical (lab) centred on the boundary between two columns
 * spans both. Lectures and tutorials take the single nearest column.
 */
function slotFor(centres, x, type) {
  let nearest = 0;
  centres.forEach((c, i) => {
    if (Math.abs(c - x) < Math.abs(centres[nearest] - x)) nearest = i;
  });
  if (type === "P" && centres.length > 1) {
    let boundary = 0;
    for (let i = 0; i < centres.length - 1; i++) {
      const b = (centres[i] + centres[i + 1]) / 2;
      const best = (centres[boundary] + centres[boundary + 1]) / 2;
      if (Math.abs(b - x) < Math.abs(best - x)) boundary = i;
    }
    const boundaryX = (centres[boundary] + centres[boundary + 1]) / 2;
    if (Math.abs(boundaryX - x) < Math.abs(centres[nearest] - x)) return { index: boundary, span: 2 };
  }
  return { index: nearest, span: 1 };
}

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true });
}
