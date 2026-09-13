# Timetable Widget for JPortal: Progress

Local work on top of [J2V-k/jportal-vhost](https://github.com/J2V-k/jportal-vhost) (React + Vite PWA), on branch
`feature/timetable-widget` in `~/jportal`. **Nothing is pushed.** This is a local clone only, until the owner decides.

> **For a new session:** read this file first. It records what is done, what is next, and facts already verified.
> Background: the earlier native project `~/jiit-widget` (Kotlin; read its `README.md`) built a JIIT portal client, a
> timetable extraction method, and an Android home-screen widget. That work is reused here.

## Goal
1. Students **upload their official timetable PDF**. The app reads it, builds their personal schedule (their batch plus
   their registered electives), and lets them **edit** it.
2. A **"Today" widget section** on both the **Timetable** and **Attendance** pages shows today's classes (or the next
   class day), each with that subject's attendance %.
3. **A mobile app with home-screen widgets:** JPortal packaged as a phone app (Capacitor), with a native widget showing
   the same data. **Android first; iOS planned** (owner will extend to iOS users), so design for both.

### Cross-platform design (Android + iOS)
- **Capacitor** wraps the same web build for Android and iOS. Everything in `src/` (parser, upload, Today section)
  runs unchanged in both apps and in the browser.
- **Keep shared logic in plain JS** (no DOM or platform APIs), e.g. `src/lib/timetable/`.
- **Widgets are native on each platform:** Android = AppWidget with RemoteViews (Kotlin; port from `~/jiit-widget`), iOS =
  WidgetKit extension (Swift). The web app writes **one versioned JSON "widget snapshot"** (today's and the next day's
  classes with attendance %, plus the fetch time) to native storage (Android SharedPreferences / iOS App Group
  UserDefaults) through a small Capacitor plugin. Both widgets only read that snapshot.
- **iOS constraint:** building iOS requires **macOS + Xcode** (this dev machine is Linux). iOS code can be written and
  structured here, but compiling and testing it needs a Mac or a cloud Mac CI (e.g. GitHub Actions macOS runners). iOS
  background refresh is also much more limited than Android's.

## Working rules (same as `~/jiit-widget`)
- One phase at a time. Finish each with its tests passing, commit it, and get the owner's confirmation before the next.
- One commit per phase, conventional commit messages. Git author: `vinamrag-code <agrawalvinamra12@gmail.com>` (repo-local config).
- Keep this file updated as work lands.
- Never commit credentials. Scan the staged diff before every commit.

## Phases

| Phase | What | Status |
|---|---|---|
| J0 | Setup: local clone, install, baseline build, Vitest, this doc | ✅ Done |
| J1 | **Timetable PDF parser** (pure JS, pdf.js): finds the grid, parses `L/T/P + batches + (code) - room / teacher`, filters by batch and electives | ✅ Done (awaiting owner confirmation) |
| J2 | **Mobile app** (Capacitor): Android project builds an installable APK, and portal login/attendance work inside the app; iOS project scaffolded (build needs a Mac) | ⏭️ Next |
| J3 | **Upload and review UI** on the Timetable page: upload PDF → pick batch and electives → preview (with parser warnings) → save into JPortal's timetable; richer editor (type, room, teacher) | ⏳ |
| J4 | **Today section** component on the Timetable and Attendance pages: joins the schedule with attendance (code matching, aliases), switches to the next day after the last class, uses JPortal's attendance goal | ⏳ |
| J5 | **Home-screen widgets:** widget-snapshot bridge plugin; Android widget (port from `~/jiit-widget`), built and tested here; iOS WidgetKit extension written, built on a Mac | ⏳ |
| J6 | **Background refresh** (Android WorkManager; iOS WidgetKit timeline within its limits) with a stale indicator; secure native credential handling (Keystore / Keychain), never plaintext | ⏳ |

Order changed on 13 Sep 2026 at the owner's request ("create the app also"): the app moved up from J4 to J2.

## J1: PDF parser (done)
- **Code:** `src/lib/timetable/pdfTimetableParser.js`, pure JS. The caller passes the pdf.js module (Node tests use
  `pdfjs-dist/legacy/build/pdf.mjs`; the browser/app will do the same in J3). Dependency: `pdfjs-dist@4.10.38`, pinned
  (legacy build, for older Android WebViews and iOS Safari).
- **API:**
  - `extractPdfPages(bytes, pdfjs)` → positioned text per page.
  - `parseTimetablePages(pages)` → `{entries, batches, electives, warnings}`.
  - `selectEntriesForStudent(entries, {batch, electiveCodes})`.
  - `parseEntryText(text)`.
  - Entry fields: `day`, `dayIndex` (1 = Mon, like `Date.getDay()`), `startMinutes`, `durationMinutes` (50 per hourly
    column, 110 for a two-column lab), `type` L/T/P, `batches`, `code`, `room`, `teachers[]`, `raw`, `page`.
- **How it works:**
  - Time header strings (their end time, minus 50 min) → column centres.
  - Day labels → vertical bands (halfway between labels; a day continues onto the next page).
  - The grid stops at "Faculty Abbreviation".
  - Wrapped lines inside a cell are re-joined.
  - An entry's horizontal centre picks the column; a practical centred on a column boundary spans 2 columns.
- **Sheet quirks handled** (reported in `warnings`, never silently guessed):
  - `F1819` → F18, F19.
  - Blank room (`-/VAIBHAV SHARMA`) stays blank.
  - `244VAISHNAVI` → room 244 + teacher.
  - Stray dashes (`3067-`, `-AKB`) trimmed.
  - Missing teacher.
- **Verified on the official PDF:**
  - 267/267 grid entries read, 22 batches, 20 shared electives, 4 warnings (all genuine sheet typos).
  - **E1 plus electives (18B12MA312, 26B42EC311, 26B42EC313) = exactly the 22 verified slots.**
  - Cross-engine: 247/248 entries from the Phase-5 `pdftotext` extractor are reproduced. The one difference is `244B`,
    where the new parser correctly joins a wrapped line; the remaining differences are trimmed dashes.
  - The parser also recovers 19 wrapped entries the old extractor missed.
- **Not a valid reference:** jiit-planner-cdn matches the E batches exactly, but its CS (F-batch) rooms and classes come
  from an **older timetable version**, so it cannot be used to check F batches.
- **Tests (20):**
  - `pdfTimetableParser.test.js`, 15 synthetic-layout tests: entry formats, blank room, dashes, typos, positions, labs,
    wrapping, page continuation, table cut-off, selection.
  - `pdfTimetableParser.pdf.test.js`, golden tests against the real PDF (Node environment). They **skip if the PDF is
    missing**; set `TIMETABLE_PDF=/path/to.pdf` to choose the file. The PDF is not committed.
  - Mutation-checked: breaking line joining, lab spans or blank-room handling each makes tests fail.
- **Limits:**
  - Built for this JIIT grid format. Other campuses/years with a different layout need testing; send sample PDFs.
  - A 3-hour lab would be read as 1 hour (none on this sheet).
  - The VLSI portal code alias (`25B22EC311`) and course titles are not handled by the parser; that is J3/J4 matching.

## J0: Setup (done)
- Cloned to `~/jportal`, branch `feature/timetable-widget`, from upstream commit `351f41a` (v2.260815).
- **Install with pnpm** (the maintainers' lockfile): `npx pnpm@10 install --frozen-lockfile`.
  - `npm ci` fails upstream: `package-lock.json` is out of sync with `package.json`, and there is an `@types/react` 19 vs
    `@types/react-dom` 18 peer conflict. `package-lock.json` is left untouched and stale.
- Commands:
  ```bash
  npx pnpm@10 run dev      # dev server (HashRouter: routes under #/...)
  npx pnpm@10 run build    # production build, succeeds at baseline
  npx pnpm@10 test         # Vitest (jsdom + React Testing Library)
  npx pnpm@10 run lint     # NOTE: baseline already has 931 problems (895 errors) in upstream files
  ```
- Added: `vitest.config.js` (separate from `vite.config.js`, so there is no PWA plugin in tests), `src/test/setup.js`,
  `src/test/smoke.test.jsx`. Lint rule for this work: **new files must be lint-clean**; upstream errors are not ours to fix.
- Node 20.20.2 on the dev machine.

## Verified facts about JPortal (upstream)
- Uses **jsjiit 0.0.28 from a CDN** (`App.jsx`) plus a bundled copy in `src/lib/jsjiit.js`. It calls the portal **directly
  from the browser**: `src/lib/api.js` is **empty**, so `proxy_url` is undefined and jsjiit uses its default API URL.
- **Existing Timetable page** (`src/components/Timetable.jsx`): the user generates a timetable on the external site
  `simple-timetable.tashif.codes`, or imports an `.ics` file, or adds classes by hand. It shows a weekly grid (Mon–Sat)
  with edit and delete. Storage: localStorage via `getTimetableModifiedEvents` / `getTimetableIcs` in
  `src/components/scripts/cache.js`. Events are `{summary, location, start: Date, end: Date}`, with the type encoded as a
  `"L - "` / `"T - "` / `"P - "` prefix in `summary`. **There is no PDF reading and no attendance link.**
- **Attendance cache** keys look like `attendance-<username>-<semKey>`. The attendance goal is in `localStorage.attendanceGoal`.
- Navigation: `src/components/Navbar.jsx`. Routes are in `src/App.jsx` (`/attendance`, `/timetable`, …).
- Credentials are kept in **plaintext localStorage** (`username`, `password`) for auto-login. That is an upstream design
  choice, and J6 must not copy it to the native side.
- `.env` (a Cloudflare analytics value, `CF_ANAL`) **is tracked in upstream git**. It's not ours; don't spread it further.
- Licence: WTFPL.

## Verified: PDF reading works in JS (checked before J1)
`pdfjs-dist@4.10.38` (legacy build, Node) on the official PDF "2026_ B. Tech. III Yr(V SEMESTER) TIMETABLE ODD SEMESTER
2026, JIIT-128 - Sheet2.pdf" (kept outside the repo at `~/Documents/`):
- 3 pages, 842×595 pt. Page 1 has 347 text items. **Each timetable cell entry is a single item** with x/y/width, e.g.
  `"PE1(24B45EC311)-142/RAP"` x=608.8 w=52.8 → centre 635, on the 2 PM|3 PM boundary, so it's a 2-hour lab.
- Coordinates match `pdftotext -bbox-layout` from Phase 5 of `~/jiit-widget` (e.g. `MONDAY` x=26.6), so that proven
  method carries over: time headers → column centres; day labels → row bands; lab = centred on a boundary.
- Expected golden result for batch **E1** with electives 18B12MA312, 26B42EC311, 26B42EC313: the **22 slots** in
  `~/jiit-widget/app/src/main/java/com/vinamra/jiitwidget/timetable/TimetableData.kt`.
- Known quirks to handle: electives are printed as `LALL(...)`; the portal lists VLSI as `25B22EC311` while the PDF has
  `26B42EC313`; portal subject codes appear as `"NAME(CODE)"`; teacher abbreviation tables in the PDF are unreliable.
