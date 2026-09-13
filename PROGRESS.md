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
| J1 | **Timetable PDF parser** (pure JS, pdf.js): finds the grid, parses `L/T/P + batches + (code) - room / teacher`, filters by batch and electives | ✅ Done |
| J1.5 | **Shared logic**: schedule data model + persistence, portal/PDF subject-code matching (incl. code aliases), "Today" view logic, widget-snapshot JSON contract | ✅ Done |
| J2 | **Upload and review UI** on the Timetable page: upload PDF → pick batch and electives → preview (with parser warnings) → save into JPortal's timetable; richer editor (type, room, teacher) | ⏭️ Next |
| J3 | **Today section** component on the Timetable and Attendance pages, wired to the real app (`w`, `AuthenticatedApp`) using J1.5's `today.js` | ⏳ |
| J4 | **Mobile app** (Capacitor): Android project builds an installable APK, and portal login/attendance work inside the app; iOS project scaffolded (build needs a Mac) | ⏳ |
| J5 | **Home-screen widgets:** widget-snapshot bridge plugin; Android widget (port from `~/jiit-widget`), built and tested here; iOS WidgetKit extension written, built on a Mac | ⏳ |
| J6 | **Background refresh** (Android WorkManager; iOS WidgetKit timeline within its limits) with a stale indicator; secure native credential handling (Keystore / Keychain), never plaintext | ⏳ |

Order note: on 13 Sep the owner asked to move the app earlier ("create the app also"), then asked to pause that and
"keep building the web app" while they prepare UI designs to share. J1.5 (schedule/matching/today logic) was pulled
forward from J3/J4 because none of it depends on the Capacitor wrapper, so it was ready to build immediately. The
mobile app (J4) resumes once there's a UI to wrap, or sooner if the owner asks.

## Git remote (set up, push pending)
- `origin` = `https://github.com/vinamrag-code/JP-WebPortal.git` (private, created, currently empty).
- `upstream` = the original `J2V-k/jportal-vhost` (kept, so upstream updates can still be pulled).
- Repo-local credential helper uses the `vinamrag-code` GitHub CLI token, independent of whichever account is
  active elsewhere on this machine (work account `coreworks-vin` stays the default for everything else).
- **Push of `main` failed once**: GitHub rejected it because `.github/workflows/deploy-docs.yml` needs the CLI
  token's `workflow` OAuth scope, which `vinamrag-code`'s token doesn't have yet. Fix (either one): re-run
  `gh auth refresh -h github.com -s workflow` for `vinamrag-code` and approve it in the browser, or drop the
  `.github/workflows/` directory from what gets pushed. Paused at the owner's request before finishing this.
- `feature/timetable-widget` has not been pushed either (blocked on the same thing, since it shares history with `main`).
- Once resolved: `git push origin main && git push -u origin feature/timetable-widget`, then push after every future commit.

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
  - The VLSI portal code alias (`25B22EC311`) and course titles are not handled by the parser; that is handled one
    layer up, in `subjectMatching.js` (see J1.5).

## J1.5: Schedule model, subject matching, Today/widget-snapshot logic (done)

Built ahead of schedule because none of it needs the Capacitor wrapper. All pure JS in `src/lib/timetable/`, all with
Vitest tests (34 new tests, 42 total across the phase). Not yet wired into any UI — that's J2 (upload/editor) and J3
(Today section).

- **`subjectMatching.js`**: reconciles three sources of subject codes that don't always agree — the PDF, the portal's
  registered-subjects list (`w.get_registered_subjects_and_faculties`), and attendance rows (whose `subjectcode` field
  is really `"NAME(CODE)"`).
  - `extractSubjectCode` / `extractSubjectName` split `"NAME(CODE)"`.
  - `subjectNamesByCode` builds a code→name map from registered subjects (jsjiit `RegisteredSubject`).
  - `suggestElectives` filters the PDF's elective codes down to ones the student is actually registered for — the
    "auto-detect my electives" step for J2's upload flow.
  - `rankBatches` scores each timetable batch by how many of its subject codes match the student's registered
    subjects, so the upload UI can suggest "you're probably E1" instead of asking the student to know their own batch
    code cold.
  - `attendanceByCode` indexes attendance rows by portal code with numeric percentages (tolerates strings like
    `"80.0"`, matching what Phase 4 of `~/jiit-widget` found the portal actually returns).
  - `attendanceCodeFor` / `unmatchedCodes` apply and surface **confirmed** code aliases (e.g. PDF `26B42EC313` → portal
    `25B22EC311` for VLSI, the exact mismatch found in `~/jiit-widget` Phase 5). Aliases are never guessed — J2's UI
    will ask the student to confirm one when `unmatchedCodes` reports a leftover on each side.
- **`schedule.js`**: the student's personal schedule — `buildSchedule` turns parsed PDF entries into it via
  `selectEntriesForStudent` (batch + chosen electives), giving each class a stable `id` and a name where the portal's
  registered-subjects list has one. `upsertClass` / `removeClass` / `setCodeAlias` are pure functions (return a new
  schedule) with validation (`validateClass`) covering day range, valid L/T/P type, and start-before-end-before-midnight.
  `toTimetableEvents` converts to the `{summary, location, start, end}` shape JPortal's **existing** `Timetable.jsx`
  weekly grid already renders, so J2 doesn't need a new grid UI — the current one just needs data.
- **`timetableStore.js`**: localStorage persistence (`SCHEDULE_STORAGE_KEY`), validated on load
  (`isValidSchedule`, wrong-version or corrupt data reported as `"unreadable"` rather than crashing or silently
  resetting), and keeps JPortal's `timetable_modified_events` cache key in sync on every save so the existing weekly
  grid picks it up for free.
- **`today.js`**: the "Today" view — which day to show (today until its last class ends, then the next day with
  classes; Saturday evening and Sunday both lead to Monday), attendance joined onto each row via `subjectMatching`,
  and a `belowGoal` flag against a configurable attendance goal (JPortal already has `attendanceGoal` in
  `localStorage`/`App.jsx`; J3 will pass it in instead of the 75% default). This is a JS port of `ScheduleBuilder.kt`
  from `~/jiit-widget`, so the two apps agree on what "today's schedule" means.
- **`widgetSnapshot.js`**: the versioned JSON contract the web app will eventually write for the native widgets to
  read (J5). Deliberately carries the **whole week**, not just today, because a widget renders at times the app isn't
  running and has to pick the current day itself; documented inline with the exact JSON shape both Kotlin and Swift
  will decode.
- **Tests**: `subjectMatching.test.js` (6), `schedule.test.js` (9, including a full add/edit/move/delete/alias
  round-trip and `toTimetableEvents` date-math checks), `today.test.js` (7, covering the day-rollover matrix and a
  round-trip through `buildWidgetSnapshot` confirming it's plain-JSON-safe via `JSON.parse(JSON.stringify(x))`).
- **Verified**: full suite green (42/42), `eslint` clean on every new file, production build (`vite build`) unaffected.

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
