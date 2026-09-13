import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { LoginError } from "https://cdn.jsdelivr.net/npm/jsjiit@0.0.28/dist/jsjiit.esm.js";
import { showErrorToast, showSuccessToast } from "@/lib/toastUtils";
import { ArtificialWebPortal } from "@/components/scripts/artificialW";
import {
  setCredentials,
  getUsername,
  getPassword,
  hasCachedProfile,
  hasAnyAttendance,
  hasAnyGrades,
} from "@/components/scripts/cache";

/**
 * Login screen for the Nocturne UI (src/uiv2/), matching the owner's Claude Design canvas
 * ("JP WebPortal.dc.html"). Same integration contract as the legacy `Login.jsx` (`{ w, onLoginSuccess }`), so
 * it drops into `LoginWrapper` in App.jsx unchanged — only the presentation is new; the login call
 * (`w.student_login`), credential persistence, error handling and the offline (cached-data) fallback are the
 * same real logic the rest of the app already relies on.
 */
export default function LoginScreen({ w, onLoginSuccess }) {
  const [enrollment, setEnrollment] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasCache, setHasCache] = useState(false);

  useEffect(() => {
    setHasCache(hasCachedProfile() || hasAnyAttendance() || hasAnyGrades());
    const savedUsername = getUsername();
    const savedPassword = getPassword();
    if (savedUsername && savedPassword) {
      setEnrollment(savedUsername);
      setPassword(savedPassword);
    }
  }, []);

  const submit = async () => {
    if (!enrollment.trim() || !password.trim()) {
      setError("Enter your enrollment number and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await w.student_login(enrollment.trim(), password);
      setCredentials(enrollment.trim(), password);
      showSuccessToast("Login successful", "Welcome back!");
      onLoginSuccess(w);
    } catch (err) {
      const isAuthError = err instanceof LoginError;
      const cached = hasCachedProfile() || hasAnyAttendance() || hasAnyGrades();
      if (isAuthError) {
        setError(err.message || "Login failed. Please check your credentials.");
        showErrorToast("Login Failed", err.message || "Please check your credentials.");
      } else if (cached) {
        showSuccessToast("Offline mode enabled", "Using cached data for offline access.");
        onLoginSuccess(new ArtificialWebPortal());
        return;
      } else {
        setError(err.message || "Unable to login. Please try again.");
        showErrorToast("Login Failed", err.message || "Unable to login. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineMode = () => {
    if (!hasCache) {
      setError("No cached data available. Please login online first to use offline mode.");
      showErrorToast("Offline unavailable", "No cached data available. Please login online first.");
      return;
    }
    showSuccessToast("Offline mode enabled", "Using cached data for offline access.");
    onLoginSuccess(new ArtificialWebPortal());
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
      <div className="flex items-center justify-between px-5 pt-6 pb-2">
        <h1 className="text-lg font-bold" style={{ fontFamily: "Inter, sans-serif" }}>
          JP WebPortal
        </h1>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-6 gap-6">
        <div className="flex flex-col gap-1.5 items-start">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ border: "1.5px solid hsl(var(--primary))" }}
          >
            <i className="ph ph-compass text-2xl" style={{ color: "hsl(var(--accent-foreground))" }} />
          </div>
          <h2 className="text-[22px] mt-1 whitespace-nowrap">Welcome back</h2>
          <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            For JIIT students — your whole portal, one app.
          </p>
        </div>

        <div
          className="rounded-2xl p-3 text-sm"
          style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
        >
          <p className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
            {hasCache ? "Cached data is available for offline use." : "Sign in to refresh your data."}
          </p>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Enrollment Number
            </label>
            <div className="relative">
              <i
                className="ph ph-user absolute left-3 top-1/2 -translate-y-1/2 text-base"
                style={{ color: "hsl(var(--muted-foreground))" }}
              />
              <input
                className="wp-input pl-9"
                type="text"
                value={enrollment}
                onChange={(e) => setEnrollment(e.target.value)}
                placeholder="e.g. 23103045"
                autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Password
            </label>
            <div className="relative">
              <i
                className="ph ph-lock absolute left-3 top-1/2 -translate-y-1/2 text-base"
                style={{ color: "hsl(var(--muted-foreground))" }}
              />
              <input
                className="wp-input pl-9 pr-11"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button
                type="button"
                className="wp-icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`ph ${showPassword ? "ph-eye-slash" : "ph-eye"}`} style={{ fontSize: 18 }} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "hsl(var(--destructive))" }} role="alert">
            <i className="ph ph-warning-circle" />
            <span>{error}</span>
          </div>
        )}

        <button className="wp-btn" onClick={submit} disabled={loading}>
          {loading ? (
            <>
              <i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} />
              <span>Signing in…</span>
            </>
          ) : (
            <span>Log in</span>
          )}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
          <span className="text-[10.5px] font-semibold tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
            OR CONTINUE WITHOUT LOGIN
          </span>
          <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
        </div>

        <button
          className="wp-btn"
          style={{ background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
          onClick={handleOfflineMode}
        >
          <i className="ph ph-device-mobile" />
          <span>Offline Mode</span>
        </button>
      </div>

      <p className="text-center text-[11px] pb-6 px-6" style={{ color: "hsl(var(--muted-foreground))" }}>
        Created with ♥ for JIIT students only
      </p>
    </div>
  );
}

LoginScreen.propTypes = {
  w: PropTypes.object.isRequired,
  onLoginSuccess: PropTypes.func.isRequired,
};
