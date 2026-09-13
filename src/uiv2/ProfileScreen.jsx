import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { removePassword } from "@/components/scripts/cache";

/**
 * Profile screen for the Nocturne UI, matching the owner's Claude Design canvas: avatar initials, name,
 * branch, a field list, a link to Subjects, and logout. Reuses the real `profileData` already fetched by
 * `AuthenticatedApp` (`w.get_personal_info()`, see App.jsx) — same data source as the legacy `Profile.jsx`,
 * just the design's simpler field set (registrationno/designation/batch/studentemailid) rather than every
 * field the legacy page shows (hostel, parents, address, ...).
 *
 * Restores logout: the app shell (AppShell.jsx) dropped the old Header's logout button when it replaced it,
 * so this was the only screen left that could bring it back.
 */
export default function ProfileScreen({ profileData, setIsAuthenticated }) {
  const navigate = useNavigate();
  const info = profileData?.generalinformation || {};

  const initials = (info.studentname || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

  const fields = [
    { label: "Enrollment No.", value: info.registrationno || "—" },
    { label: "Branch", value: info.designation || info.programcode || "—" },
    { label: "Batch", value: info.batch || "—" },
    { label: "Institute Email", value: info.studentemailid || "—" },
  ];

  const handleLogout = () => {
    removePassword();
    setIsAuthenticated(false);
    navigate("/login");
  };

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-3">
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-2xl font-bold"
          style={{ background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
        >
          {initials}
        </div>
        <p className="text-[17px] font-medium text-center m-0">{info.studentname || "Student"}</p>
        <p className="text-[12.5px] text-center m-0" style={{ color: "hsl(var(--muted-foreground))" }}>
          {info.designation || info.programcode || ""}
          {info.semester ? ` · Semester ${info.semester}` : ""}
        </p>
      </div>

      <div className="wp-card" style={{ padding: 0 }}>
        {fields.map((f, i) => (
          <div
            key={f.label}
            className="flex justify-between items-start gap-3 px-3.5 py-2.5"
            style={i < fields.length - 1 ? { borderBottom: "1px solid hsl(var(--border))" } : undefined}
          >
            <span className="text-[13px] flex-none" style={{ color: "hsl(var(--muted-foreground))" }}>
              {f.label}
            </span>
            <span className="text-[13.5px] font-medium text-right break-words">{f.value}</span>
          </div>
        ))}
      </div>

      <button
        className="wp-card flex-row items-center gap-3 cursor-pointer text-left"
        style={{ border: "none" }}
        onClick={() => navigate("/subjects")}
      >
        <i className="ph ph-books" style={{ fontSize: 18, color: "hsl(var(--accent-foreground))" }} />
        <span className="flex-1 text-sm">Registered Subjects &amp; Faculty</span>
        <i className="ph ph-caret-right" style={{ color: "hsl(var(--muted-foreground))" }} />
      </button>

      <button
        className="wp-btn"
        style={{ borderColor: "hsl(var(--destructive))", color: "hsl(var(--destructive))" }}
        onClick={handleLogout}
      >
        <i className="ph ph-sign-out" />
        <span>Log out</span>
      </button>
    </div>
  );
}

ProfileScreen.propTypes = {
  profileData: PropTypes.object,
  setIsAuthenticated: PropTypes.func.isRequired,
};
