# Timetable Widget for JPortal: Progress

Local work on top of [J2V-k/jportal-vhost](https://github.com/J2V-k/jportal-vhost) (React + Vite PWA), on branch
`feature/timetable-widget` in `~/projects/jiit-jportal/jportal`. **Nothing is pushed.** This is a local clone only, until the owner decides.

> **For a new session:** read this file first. It records what is done, what is next, and facts already verified.
> Background: the earlier native project `~/projects/jiit-jportal/jiit-widget` (Kotlin; read its `README.md`) built a JIIT portal client, a
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
- **Widgets are native on each platform:** Android = AppWidget with RemoteViews (Kotlin; port from `~/projects/jiit-jportal/jiit-widget`), iOS =
  WidgetKit extension (Swift). The web app writes **one versioned JSON "widget snapshot"** (today's and the next day's
  classes with attendance %, plus the fetch time) to native storage (Android SharedPreferences / iOS App Group
  UserDefaults) through a small Capacitor plugin. Both widgets only read that snapshot.
- **iOS constraint:** building iOS requires **macOS + Xcode** (this dev machine is Linux). iOS code can be written and
  structured here, but compiling and testing it needs a Mac or a cloud Mac CI (e.g. GitHub Actions macOS runners). iOS
  background refresh is also much more limited than Android's.

## Working rules (same as `~/projects/jiit-jportal/jiit-widget`)
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
| J2 | **Upload and review UI** on the Timetable page: upload PDF → pick batch and electives → preview (with parser warnings) → save into JPortal's timetable; richer editor (type, room, teacher) | ✅ Done |
| J3 | **Today section** component on the Timetable and Attendance pages, wired to the real app (`w`) using J1.5's `today.js` | ✅ Done |
| J4 | **Mobile app** (Capacitor): Android project builds an installable APK; iOS project not yet scaffolded (build needs a Mac) | ✅ Android build works; iOS not started |
| J4b | **New UI design import & implementation** ("JP WebPortal" Nocturne-theme redesign: 7 screens + bottom nav + home-screen widget mockup, from a Claude Design canvas) — reskin the real app to match, wiring each screen to real portal data | 🚧 In progress (colors + nav done; per-screen layouts not started) |
| J5 | **Home-screen widgets:** widget-snapshot bridge plugin; Android widget (port from `~/projects/jiit-jportal/jiit-widget`), built and tested here; iOS WidgetKit extension written, built on a Mac | ⏳ |
| J6 | **Background refresh** (Android WorkManager; iOS WidgetKit timeline within its limits) with a stale indicator; secure native credential handling (Keystore / Keychain), never plaintext | ⏳ |

**The web app (J0–J3) is now complete** — this is what the owner meant by "complete the whole building of the web
app" on 13 Sep, as distinct from J4–J6 (wrapping it as a native mobile app with widgets, a separate kind of build).
J4 resumes when the owner asks, or once there's a UI design to build the native shell around.

**Awaiting the owner's UI design.** J2/J3 were built to match JPortal's *existing* shadcn/Tailwind visual language
(the same Card/Button/Select/Dialog components and Tailwind classes the legacy Timetable/Attendance pages already
use) rather than a new design — the owner said "let me know when you want the UI design", i.e. build now with
sensible defaults, ask only if something needs it. Nothing here is blocked; if the owner's design differs
meaningfully from the existing app style, expect a restyle pass over `PdfTimetableImport.jsx`, `ScheduleGrid.jsx`,
`TimetableClassEditor.jsx`, and `TodaySection.jsx` — the logic underneath (all of `src/lib/timetable/`) shouldn't
need to change, since it's UI-agnostic.

**Not yet done for J2/J3, worth knowing:**
- No visual/browser check was possible in this environment (no display, no screenshot tooling) — verified via
  60 passing Vitest/RTL tests plus a production `vite build`, not by looking at the rendered page. Worth a manual
  look once there's a way to run `npx pnpm@10 run dev` and open it (or once the owner reviews the design).
- `PdfTimetableImport`'s "Portal calls this subject differently" alias field lives in the class editor
  (`TimetableClassEditor.jsx`), discovered reactively when `TodaySection` can't find attendance for a class —
  not surfaced automatically at import time as an upfront prompt. That was a deliberate simplification; revisit
  if it turns out students don't discover the field.
- `ScheduleGrid` doesn't show attendance percentages in the grid itself (only `TodaySection` does) — kept scope
  narrow per the original plan ("Today" section is the attendance-linked view; the weekly grid is structural).

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

## J2 + J3: Upload UI, schedule editor, Today section (done)

All new components live in `src/components/` (not `src/lib/timetable/`, which stays pure logic) and are wired into
the existing pages rather than replacing them.

- **`PdfTimetableImport.jsx`**: the upload wizard. Choose file → parse (pdf.js loaded on demand, see below) →
  batch `<Select>` pre-picked by `rankBatches` with the match ratio shown per option → elective chips
  pre-toggled by `suggestElectives`, freely togglable → parser warnings in a collapsible `Alert` → a compact
  per-day preview → Save (`saveSchedule`, which also refreshes the legacy `timetable_modified_events` cache key
  for free). Needs `registeredSubjects` (the portal's `get_registered_subjects_and_faculties().subjects`) passed
  in; `Timetable.jsx` reads it from `subjectData[currentSemId]`, matching how the existing customizer does it.
- **`pdfjsBrowser.js`**: pdf.js defaults to a relative `./pdf.worker.mjs` for its worker script, which 404s under
  Vite. Fixed with a `?url` import so Vite emits the worker and hands back its real built URL — works in dev,
  prod build, and inside a future Capacitor WebView. **Lazy-loaded** (`import()`) only from inside
  `PdfTimetableImport`'s file-upload handler, not statically: pdf.js is ~380KB and only needed on one page for
  one occasional action, so it now ships as its own chunk instead of bloating every page load. This dropped the
  main bundle from 1.1MB to 726KB (gzip 331KB → 217KB).
- **`TimetableClassEditor.jsx`**: shared add/edit dialog (day/type `<Select>`, `<input type="time">` start/end
  with a live 12-hour preview, code/name/room/teachers text fields), reusing `validateClass` from `schedule.js`
  for the same validation the logic layer already tests. Also carries the **code-alias field** — "Portal calls
  this subject differently" — that calls `setCodeAlias` alongside the class edit, the discoverable fix for
  cases like the VLSI PDF/portal code mismatch found in `~/projects/jiit-jportal/jiit-widget`.
- **`ScheduleGrid.jsx`**: the personal schedule as a 6-day grid, deliberately styled to match the legacy
  ICS-based grid already in `Timetable.jsx` (same card shapes, badge colors per L/T/P, "today" ring highlight)
  so the page doesn't visually fork depending on which timetable source is active. Click a class to edit it
  (via `TimetableClassEditor`), "Add class" for a new one.
- **`TodaySection.jsx`**: the "Today" card, mounted on **both** the Timetable and Attendance pages as the
  original goal asked. Self-contained rather than prop-drilled: it reads the saved schedule itself
  (`loadSchedule`), and fetches attendance itself when `w.session` exists (reusing the existing
  `getAttendanceFromCache`/`saveAttendanceToCache` cache helpers so it doesn't duplicate a fetch the Attendance
  page may have already done), so it works correctly regardless of which page loads first. Shows an "Import
  timetable" prompt with no schedule, a per-class attendance percentage colored against `attendanceGoal`
  (default 75%, matching `ScheduleBuilder.kt`'s constant from `~/projects/jiit-jportal/jiit-widget`), and re-derives "now" every 60s
  so a class transitioning from upcoming → live → finished, or the whole view flipping to the next class day,
  shows up without a page reload.
- **`Timetable.jsx`** (existing file, edited): the schedule is read via a **lazy `useState` initializer**
  (`useState(() => loadSchedule().schedule)`), not a `useEffect`, specifically so there's no one-frame flash of
  the legacy UI before the saved schedule is known — same synchronous-localStorage-read pattern the file already
  uses elsewhere (e.g. `attendanceGoal` in `App.jsx`). When a schedule exists it replaces the whole page body
  with the new header + `ScheduleGrid` (+ "Re-import PDF" / "Reset" actions); when it doesn't, **all three
  existing flows are untouched** (Automated Parser / ICS import / manual add), with `PdfTimetableImport` offered
  as a new card above them.
- **`Attendance.jsx` / `App.jsx`** (existing files, edited): one `<TodaySection>` added near the top of
  Attendance's render, and `attendanceGoal` threaded down to the `/timetable` route so both pages agree on the
  same goal percentage.

**Tests (18 new, 60 total)**: `PdfTimetableImport.test.jsx` (parse → suggest → preview → save, with `pdfTimetableParser`
and `pdfjsBrowser` mocked via `vi.hoisted` + `importOriginal` so `schedule.js`'s real, unmocked use of
`selectEntriesForStudent` from the same module keeps working), `ScheduleGrid.test.jsx` (per-day rendering, today
highlight, click-to-edit pre-fill including alias, save/delete wiring, add-class, empty day), `TimetableClassEditor.test.jsx`
(add vs. edit modes, id preservation, alias pass-through, validation-blocks-save), `TodaySection.test.jsx` (no
schedule / no session / live fetch / failed fetch, using `vi.useFakeTimers({toFake: ["Date"]})` — faking only
`Date` and not `setTimeout`/`setInterval`, so Testing Library's own real-timer-based `waitFor`/`findBy` polling
isn't starved).

**Mutation-checked**: breaking `schedule.js`'s day filter fails 6 tests across two files (confirms `ScheduleGrid`
genuinely depends on the shared logic, not a copy of it); bypassing the editor's validation gate, removing the
`belowGoal` color branch, and removing elective auto-selection each turn a specific test red.

**Verified clean**: `eslint` reports zero errors on every new file (including the four new test files); the
build (`vite build`) succeeds; the pre-existing files touched (`Timetable.jsx`, `Attendance.jsx`, `App.jsx`)
gained no new lint errors beyond one line matching a pattern (missing PropTypes) already present on every other
prop in that file — confirmed by comparing before/after `eslint` output line by line, not just checking exit codes.

## J4: Capacitor Android wrapper (Android build done, iOS not started)

Wraps the existing built web app (dist/) as a native Android app, so the whole real JPortal — including the J2/J3
timetable upload, editor and Today section — runs as an installable APK, not just a browser tab.

- **App identity**: `appId com.jportal.app`, `appName "JP WebPortal"` (different from `~/projects/jiit-jportal/jiit-widget`'s
  `com.vinamra.jiitwidget`, so both can be installed on the same phone without conflict).
- **Toolchain additions** (all local, no root, nothing shared with `jiit-widget` touched):
  - **Node 22** at `~/.local/node22` — Capacitor 8's CLI refuses to run under Node <22; the system/other-projects'
    Node 20 is untouched. Use `export PATH=~/.local/node22/bin:$PATH` for any `cap` command.
  - **JDK 21** at `~/.local/jdk-21` — Capacitor 8's Android Gradle module needs Java 21 to compile (`invalid source
    release: 21` under JDK 17). `jiit-widget`'s own Gradle build stays on JDK 17 (`~/.local/jdk-17`), unaffected —
    use `export JAVA_HOME=~/.local/jdk-21` only for this repo's `android/` build.
  - **Android SDK platform 36 + build-tools 36.0.0** installed into the existing `~/Android/Sdk` (platform 35/
    build-tools 35 from the jiit-widget setup are untouched, both coexist) — Capacitor 8's `android/variables.gradle`
    targets/compiles against SDK 36.
- **What's committed**: the native `android/` project (manifest, Capacitor's own bridge plugin sources, Gradle
  wrapper, `variables.gradle`) — everything Capacitor's own generated `android/.gitignore` doesn't already exclude
  (`build/`, `.gradle/`, `local.properties`). 56 files, ~1600 lines, no build output.
- **Build command**:
  ```bash
  export PATH=~/.local/node22/bin:$PATH JAVA_HOME=~/.local/jdk-21
  cd ~/projects/jiit-jportal/jportal && npx pnpm@10 run build && npx pnpm@10 exec cap sync android
  cd android && echo "sdk.dir=$HOME/Android/Sdk" > local.properties && ./gradlew assembleDebug
  # APK at android/app/src/main/assets → app/build/outputs/apk/debug/app-debug.apk
  ```
- **Verified**: `assembleDebug` succeeds (manifest merge, resource compilation for every locale, dexing, packaging
  all pass); the built APK was unzipped and scanned — no credentials or the timetable PDF leaked in; `aapt2 dump
  badging` confirms `com.jportal.app`, targetSdk 36, and the `INTERNET` permission (required for portal calls).
- **Not verified here**: actual on-device/emulator behavior. There is no display and no KVM on this dev machine
  (same constraint as `jiit-widget`), so whether the WebView actually loads the app and completes a real login has
  not been checked interactively — only that the Gradle build itself succeeds. **The owner's phone is the first
  real test of this APK**, same as `jiit-widget` v0.1 was.
- **iOS**: not started. `npx cap add ios` needs Xcode (macOS-only); the Node/JS side (web build, Capacitor config)
  is already platform-neutral and ready for it whenever a Mac is available.

## J4b: Increment 1 (colors + nav visibility) — done

- **`src/lib/nocturneTheme.js`**: the design's `colors()` dark/light palettes ported into JPortal's existing
  theme-preset schema (the same `theme.styles.{light,dark}` shape as `public/theme-presets.json`'s presets), with
  every translucent `rgba(...)` token (the design's `textMuted`/`divider`) pre-flattened to solid hex composited
  over that mode's background — Tailwind wraps every color token as `hsl(var(--token))` and can't consume rgba.
- **Bundled, not fetched**: `theme.js`'s existing preset system fetches its CDN list from
  `cdn.jsdelivr.net/gh/J2V-k/jportal-vhost@main/public/theme-presets.json` — **upstream's own repo/branch**, not
  ours — so editing our local `public/theme-presets.json` would never actually reach the running app. Nocturne is
  instead merged into `getAllThemePresets()`/`getPresetsByCategory()` in code, so it's selectable and (unlike the
  CDN ones) works fully offline and on first run before any fetch completes.
- **New-install default**: `ThemeContext.jsx`'s `initializeTheme()` now applies Nocturne instead of the old ad-hoc
  "Vercel Dark" object when nothing is saved yet. Anyone who already picked a theme keeps it — this only changes
  what a fresh install boots with.
- **Free reskin of J1-J3**: because `TodaySection`/`ScheduleGrid`/`PdfTimetableImport`/`TimetableClassEditor` were
  built on the existing shadcn `Card`/`Badge`/`Button`/`Dialog` components (which read these same CSS variables)
  rather than hardcoded colors, they now render in Nocturne's palette automatically — no component changes needed.
- **Timetable tab always shown**: `getShowTimetableInNavbar()` (`cache.js`) now defaults to `true` for anyone who
  has never touched the setting (it was `false`), since Timetable does real work now. An explicit prior choice
  (on or off) is still respected exactly.
- **Tests (7 new)**: `nocturneTheme.test.js` — every color value is solid hex not rgba, dark/light have matching
  keys, `applyTheme()` actually sets the right DOM class and CSS variables (asserted structurally — an HSL-triplet
  shape and dark-vs-light lightness relationship — rather than a hand-computed exact HSL string, since
  `hexToHsl`'s rounding isn't reimplemented in the test), and the preset is found by `getAllThemePresets`/
  `getPresetById`/`getPresetsByCategory` even when `fetch` is stubbed to reject (offline-safe). Plus
  `cache.showTimetable.test.js` (2 tests) for the new default. Mutation-checked. 67/67 tests pass, `vite build`
  succeeds, and a rebuilt Android APK (`jportal-v1.1-debug.apk`) was scanned clean and sent to the owner.
- **Not verified visually at the time**: no display on this dev machine yet had a workaround — checked via
  `applyTheme`'s actual DOM/CSS-variable output in tests and by grepping the built JS bundle for the accent color,
  not by looking at a rendered screen. See below for how that changed for increment 2.

## J4b pivot (13 Sep, later the same day): recreate the actual screens, not just recolor

After increment 1 (colors + nav default) shipped, the owner clarified the real ask: **recreate the design's
actual screens** (login, bottom-nav shell, Attendance, Timetable, Exams, Grades, Subjects, Profile) using
Phosphor icons as the design does, with JPortal's real logic underneath — not JPortal's existing page
components restyled. New screens live in `src/uiv2/`, built one at a time, wired into the existing
`App.jsx`/`AuthenticatedApp` data-fetching (unchanged) rather than a parallel app.

**A dev-server + headless-browser workflow was set up to make this possible without a display**: `vite dev
--host` bound to `0.0.0.0` (reachable from the owner's phone on the same LAN, or `localhost` for a resized
desktop browser), plus a cached Playwright Chromium (`~/.cache/ms-playwright/chromium-1234`) driven via
`playwright-core` (installed ad hoc in the scratchpad, not added to the project) to actually render pages at
a 393×852 mobile viewport and screenshot them. This is the first point in J4b where visual results were
verified by *looking at them*, not just inferred from tests and a build — every screen from here on is
screenshot-checked before being called done, including logging in with the real portal account to see real
data render (session saved via Playwright's `storageState` between checks, not re-entered each time).

### Login screen — done (`src/uiv2/LoginScreen.jsx`)
Matches the design's layout (compass logo, enrollment/password fields with Phosphor icons, password
visibility toggle, loading spinner, error banner, "OR CONTINUE WITHOUT LOGIN" + Offline Mode). Same
`{w, onLoginSuccess}` contract as the legacy `Login.jsx` it replaces in `LoginWrapper`, so it reuses the
real `w.student_login()` call, `setCredentials` persistence, `LoginError` handling, and the existing
`ArtificialWebPortal` offline fallback — only the presentation is new.

**Found and fixed a real cross-cutting CSS bug** while getting this screen right, worth knowing before
building the rest: **Tailwind v3's `@layer` directive only resolves in the file holding the matching
`@tailwind components` declaration** (`index.css`). A separately-imported stylesheet using `@layer
components` either fails the build outright, or — if left unlayered — permanently loses to Tailwind's own
utilities regardless of specificity or source order (CSS cascade layers give *any* layered rule priority
over unlayered CSS). This is exactly what caused the login screen's icon and placeholder text to overlap on
first pass. Fix: the design's `.wp-*` component classes (input, button, icon-button, segmented control,
card, chip, nav item, select) now live directly in `index.css` inside `@layer components`, not a separate
`src/uiv2/*.css` file. **Every future uiv2 screen can safely mix `.wp-*` classes with Tailwind utilities on
the same element** because of this fix — worth remembering if a new `.wp-*` class is ever added elsewhere.

Verified end-to-end against the live proxy backend (`https://render-proxy-gfn4.onrender.com/...`, see
`src/lib/api.js` — corrects an earlier, wrong note in this doc that `api.js` was empty and the app used no
proxy; it does, and that's *why* CORS isn't the issue it would be calling the portal directly from a
browser): typing, the password toggle, the loading state, and a real wrong-password error round-trip all
render correctly, and a real login with the owner's account succeeds and reaches the app shell below.

### App shell (top bar + bottom nav) — done (`src/uiv2/AppShell.jsx`)
Replaces the legacy `Navbar` (sidebar/bottom-bar) + `Header` chrome for authenticated routes with the
design's top bar (logo or back button, page title, theme toggle, profile icon) and 5-tab bottom nav
(Attendance/Grades/Timetable/Exams/Subjects), wired around the existing `<Routes>` in `App.jsx` — no route,
page component, or data-fetching logic touched.

Screenshot-verified with a real logged-in session: the shell renders correctly, and — confirming the same
"free reskin" effect seen in J1–J3 — the **untouched** `Attendance.jsx` page picked up the full Nocturne
theme automatically, since it already used the shared shadcn `Card`/`Badge` components. A first check using
a Playwright `fullPage` screenshot showed the fixed bottom nav floating in the middle of the page; re-checked
with a normal viewport-sized screenshot and confirmed this was a `position:fixed` + `fullPage` screenshot
artifact, not a real overlap bug.

**Known gap, not an oversight**: logout was only reachable via the old `Header`, which authenticated routes
no longer render — **there is currently no way to log out** until the Profile screen (next) adds the
design's own logout button. `setIsAuthenticated`/`messMenuOpen`/`onMessMenuChange` are kept flowing into
`AuthenticatedApp` for exactly that reason, unused for now (hence a jump in `App.jsx`'s pre-existing
no-props-validation lint count, 13 → 16 — same pattern, not a new category of problem).

### Not started yet
Attendance's actual card layout (ring charts, day-to-day calendar), Timetable (day/week toggle — the real
schedule/editor from J1–J3 needs a visual pass, not new logic), Exams, Grades (charts), Subjects, and
Profile (including restoring logout — see the App shell section above). Continuing screen by screen, same
pattern: build against real data, screenshot-verify, test/lint/build, commit.

Deliberately not changed so far: the design's buttons are outline/ghost style (transparent fill, accent
border+text — see the canvas's own `.btn-primary`); JPortal's shared `Button` component defaults to
solid-fill. Matching that exactly means restyling a component used by every button in the whole app — worth
doing once more screens are done and it can be checked broadly, not piecemeal. Icons use Phosphor (matching
the design) only within `src/uiv2/`; the untouched legacy pages still under J1–J3 (`ScheduleGrid`,
`TimetableClassEditor`, etc.) keep `lucide-react`.

On 13 Sep the owner shared a Claude Design canvas — `claude.ai/design/p/c9761a04-842d-42d7-bc94-6c272e0ca578`,
project "# JIIT Campus App Design", file `JP WebPortal.dc.html` — and asked to implement it and ship an APK.
Given the size (a full app-shell redesign, not a component tweak), the APK above was shipped first as J4 so there
is something real to test while J4b is scoped; **J4b itself has not been started**.

**What the design contains** (read via the `DesignSync` tool after `/design-login`; full content saved for
reference — see the design system's own `_ds/nocturne-…/readme.md` and `styles.css` for the token source):
- **Visual language ("Nocturne")**: dark theme by default (`#161826` bg, `#232532` surface, `#9184d9` accent purple,
  Inter font), a light theme variant, Phosphor icons, card/chip/segmented-control/dialog primitives already defined
  as reusable CSS classes in the design system bundle.
- **App shell**: login screen → bottom-nav app with 5 tabs (Attendance, Grades, Timetable, Exams, Subjects) plus a
  Profile screen (reached via a top-bar icon, not the bottom nav) and a full-screen Edit-Timetable grid editor.
- **Screens, each substantially different from JPortal's current pages**:
  - *Attendance*: Overview (ring-chart cards per subject, target-goal input) / Day-to-day (calendar + daily log)
    tabs, plus a per-subject detail screen with a "reach your target" slider calculator.
  - *Timetable*: Day view (chip day-picker + list) / Week view (6-column mini-grid) toggle, plus a separate
    Edit-Timetable screen: a 10-slot × 6-day tap-to-add/remove grid with an add/delete dialog.
  - *Exams*: semester + exam-event pickers, a dated list with seat numbers and a "SOON" badge on the nearest exam.
  - *Grades*: Overview (SGPA/CGPA line chart + per-semester GP/credits cards) / Marks (per-test progress bars) /
    Semester (expandable grade lists) tabs.
  - *Subjects*: Registered (credit total + L/T/P component badges, filterable) / Choices / MOOC tabs.
  - *Profile*: avatar-initials, a field list, a link to Subjects, logout.
  - *Home-screen widget mockup*: a card showing the current/next class with room, time and attendance %, plus an
    "Upcoming" list — a design target for the eventual native widget (J5), not itself code to run.
- **Demo data only**: every screen is driven by hardcoded arrays (`SUBJECTS`, `TIMETABLE`, `EXAM_GROUPS_RAW`,
  `GRADE_HISTORY`, `DAILY_LOG`) in the canvas's own template script — none of it calls `w.*` or reads real portal
  data. The canvas's own timetable editor (`EDIT_GRID`, add/remove dialog) is a from-scratch grid, unrelated to and
  not integrated with our J1–J3 PDF-parser/schedule/editor pipeline.

**Reconciling with J1–J3**: the design's Timetable tab (day/week view + its own grid editor) and Attendance tab
overlap substantially with what `ScheduleGrid.jsx`, `TimetableClassEditor.jsx`, `TodaySection.jsx`, and the
`Attendance.jsx`/`Timetable.jsx` pages already do with real data. J4b's job is to restyle those real, working
pieces to match this visual language (cards, dark theme, bottom nav, chips) rather than to build the mockup's demo
version from scratch a second time — the design should be read as **the target look**, with our existing
J1–J3 logic underneath, not as a parallel app to wire up independently. Grades/Exams/Subjects have no equivalent
built yet on our side (JPortal's existing `Grades.jsx`/`Exams.jsx`/`Subjects.jsx` pages already fetch real data;
J4b would restyle those to match too).

**Suggested scope for when J4b actually starts** (not yet agreed with the owner — propose and confirm first):
1. Global shell: dark/light theme tokens, bottom nav, top bar, applied around the existing routed pages.
2. Attendance + Timetable screens restyled against real data (most direct win, most overlap with J1–J3).
3. Grades / Exams / Subjects restyled against their existing real data sources.
4. Home-screen widget visual redesign, once J5 (the actual native widget) exists to redesign.

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
    `"80.0"`, matching what Phase 4 of `~/projects/jiit-jportal/jiit-widget` found the portal actually returns).
  - `attendanceCodeFor` / `unmatchedCodes` apply and surface **confirmed** code aliases (e.g. PDF `26B42EC313` → portal
    `25B22EC311` for VLSI, the exact mismatch found in `~/projects/jiit-jportal/jiit-widget` Phase 5). Aliases are never guessed — J2's UI
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
  from `~/projects/jiit-jportal/jiit-widget`, so the two apps agree on what "today's schedule" means.
- **`widgetSnapshot.js`**: the versioned JSON contract the web app will eventually write for the native widgets to
  read (J5). Deliberately carries the **whole week**, not just today, because a widget renders at times the app isn't
  running and has to pick the current day itself; documented inline with the exact JSON shape both Kotlin and Swift
  will decode.
- **Tests**: `subjectMatching.test.js` (6), `schedule.test.js` (9, including a full add/edit/move/delete/alias
  round-trip and `toTimetableEvents` date-math checks), `today.test.js` (7, covering the day-rollover matrix and a
  round-trip through `buildWidgetSnapshot` confirming it's plain-JSON-safe via `JSON.parse(JSON.stringify(x))`).
- **Verified**: full suite green (42/42), `eslint` clean on every new file, production build (`vite build`) unaffected.

## J0: Setup (done)
- Cloned to `~/projects/jiit-jportal/jportal`, branch `feature/timetable-widget`, from upstream commit `351f41a` (v2.260815).
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
- Coordinates match `pdftotext -bbox-layout` from Phase 5 of `~/projects/jiit-jportal/jiit-widget` (e.g. `MONDAY` x=26.6), so that proven
  method carries over: time headers → column centres; day labels → row bands; lab = centred on a boundary.
- Expected golden result for batch **E1** with electives 18B12MA312, 26B42EC311, 26B42EC313: the **22 slots** in
  `~/projects/jiit-jportal/jiit-widget/app/src/main/java/com/vinamra/jiitwidget/timetable/TimetableData.kt`.
- Known quirks to handle: electives are printed as `LALL(...)`; the portal lists VLSI as `25B22EC311` while the PDF has
  `26B42EC313`; portal subject codes appear as `"NAME(CODE)"`; teacher abbreviation tables in the PDF are unreliable.
