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
3. A **real Android home-screen widget**: JPortal packaged as an Android app, with a native widget showing the same data.

## Working rules (same as `~/jiit-widget`)
- One phase at a time. Finish each with its tests passing, commit it, and get the owner's confirmation before the next.
- One commit per phase, conventional commit messages. Git author: `vinamrag-code <agrawalvinamra12@gmail.com>` (repo-local config).
- Keep this file updated as work lands.
- Never commit credentials. Scan the staged diff before every commit.

## Phases

| Phase | What | Status |
|---|---|---|
| J0 | Setup: local clone, install, baseline build, Vitest, this doc | ✅ Done |
| J1 | **Timetable PDF parser** (pure JS, pdf.js): finds the grid, parses `L/T/P + batches + (code) - room / teacher`, filters by batch and registered subjects | ⏭️ Next |
| J2 | **Upload and review UI** on the Timetable page: upload PDF → pick batch → preview → save into JPortal's timetable; richer editor (type, room, teacher) | ⏳ |
| J3 | **Today section** component on the Timetable and Attendance pages: joins the schedule with attendance (code matching, aliases), switches to the next day after the last class, uses JPortal's attendance goal | ⏳ |
| J4 | **Android app wrapper** (Capacitor): JPortal as an installable APK; verify portal calls work from the WebView | ⏳ |
| J5 | **Native home-screen widget** in that app: web→native data bridge, port of the Kotlin widget from `~/jiit-widget` | ⏳ |
| J6 | **Background refresh** in the widget (WorkManager) with a stale indicator; secure credential handling on the native side | ⏳ |

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
