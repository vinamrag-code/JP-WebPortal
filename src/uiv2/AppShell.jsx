import PropTypes from "prop-types";
import { useNavigate, useLocation } from "react-router-dom";
import useTheme from "@/context/ThemeContext";

/**
 * Top bar + bottom nav for the Nocturne UI (src/uiv2/), matching the owner's Claude Design canvas. Replaces
 * the legacy Header/Navbar chrome for routes rendered under this shell; the routed page content itself
 * (Attendance, Timetable, ...) is passed as `children` and unaffected by this component.
 *
 * The design's own top bar only carries a theme toggle and a profile icon (no mess-menu/settings icons, no
 * notice banner) — those legacy Header features aren't reachable from here yet. Deliberate scope decision
 * to match the design as given rather than bolt extra chrome onto it unasked; revisit if the owner wants
 * them back.
 */
const NAV_ITEMS = [
  { path: "/attendance", label: "Attendance", icon: "ph-check-circle" },
  { path: "/grades", label: "Grades", icon: "ph-graduation-cap" },
  { path: "/timetable", label: "Timetable", icon: "ph-calendar-blank" },
  { path: "/exams", label: "Exams", icon: "ph-exam" },
  { path: "/subjects", label: "Subjects", icon: "ph-books" },
];

const TITLES = {
  "/attendance": "Attendance",
  "/grades": "Grades",
  "/timetable": "Timetable",
  "/exams": "Exam Schedule",
  "/subjects": "Subjects",
  "/profile": "Profile",
};

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { themeMode, darkTheme, lightTheme } = useTheme();

  const path = (location.pathname || (location.hash ? location.hash.replace("#", "") : "/")).split("?")[0];
  const showBack = path === "/profile";
  const title = TITLES[path] ?? "JP WebPortal";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
      <div className="flex items-center gap-1.5 px-3.5" style={{ height: 56 }}>
        {showBack ? (
          <button className="wp-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
            <i className="ph ph-arrow-left text-xl" />
          </button>
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-none"
            style={{ border: "1.5px solid hsl(var(--primary))" }}
          >
            <i className="ph ph-compass" style={{ fontSize: 16, color: "hsl(var(--accent-foreground))" }} />
          </div>
        )}
        <h1 className="flex-1 text-lg font-medium truncate m-0">{title}</h1>
        {!showBack && (
          <>
            <button
              className="wp-icon-btn"
              onClick={() => (themeMode === "dark" ? lightTheme() : darkTheme())}
              aria-label="Toggle theme"
            >
              <i className={`ph ${themeMode === "dark" ? "ph-sun" : "ph-moon"}`} style={{ fontSize: 19 }} />
            </button>
            <button className="wp-icon-btn" onClick={() => navigate("/profile")} aria-label="Profile">
              <i className="ph ph-user-circle" style={{ fontSize: 22 }} />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-2" style={{ paddingBottom: "calc(60px + env(safe-area-inset-bottom))" }}>
        {children}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 flex"
        style={{
          height: 60,
          paddingBottom: "env(safe-area-inset-bottom)",
          borderTop: "1px solid hsl(var(--border))",
          background: "hsl(var(--background))",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = path === item.path;
          return (
            <button
              key={item.path}
              className="wp-navitem"
              style={{ color: active ? "hsl(var(--accent-foreground))" : "hsl(var(--muted-foreground))" }}
              onClick={() => navigate(item.path)}
            >
              <i className={`ph${active ? "-fill" : ""} ${item.icon}`} style={{ fontSize: 22 }} />
              <span className="lbl">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

AppShell.propTypes = {
  children: PropTypes.node,
};
