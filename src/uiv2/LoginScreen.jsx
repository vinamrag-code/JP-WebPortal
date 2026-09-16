import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { showSuccessToast } from "@/lib/toastUtils";
import { ArtificialWebPortal } from "@/components/scripts/artificialW";
import { buildBookmarklet, WEBKIOSK_LOGIN_URL } from "@/lib/googleAuth";
import {
  hasCachedProfile,
  hasAnyAttendance,
  hasAnyGrades,
} from "@/components/scripts/cache";

/**
 * Login screen for the Nocturne UI (src/uiv2/), matching the owner's Claude Design canvas
 * ("JP WebPortal.dc.html"). Same integration contract as the legacy `Login.jsx` (`{ w, onLoginSuccess }`), so
 * it drops into `LoginWrapper` in App.jsx unchanged.
 *
 * The portal dropped username/password login for students in favor of Google Sign-In (16 Sep 2026), and a
 * button rendered on jportal's own origin cannot work - Google only authorizes the portal's own origin for
 * that OAuth client, and there's no SDK/library workaround (see `@/lib/googleAuth` and PROGRESS.md for the
 * full trail). So this screen walks the student through the bookmarklet handoff instead: sign in on the
 * portal's own real page once, and a small script captures the resulting session for jportal. The offline
 * (cached-data) fallback is unchanged.
 */
export default function LoginScreen({ onLoginSuccess }) {
  const [hasCache, setHasCache] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bookmarklet, setBookmarklet] = useState("");

  useEffect(() => {
    setHasCache(hasCachedProfile() || hasAnyAttendance() || hasAnyGrades());
    setBookmarklet(buildBookmarklet());
  }, []);

  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied(true);
      showSuccessToast("Copied", "Paste this as a new bookmark's URL.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleOfflineMode = () => {
    if (!hasCache) {
      showSuccessToast("Offline unavailable", "No cached data available yet - sign in online first.");
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

      <div className="flex-1 flex flex-col justify-center px-6 py-6 gap-5 overflow-y-auto">
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

        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "hsl(var(--muted))" }}>
          <p className="text-[12.5px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
            The portal now requires Google sign-in, which only works on its own site — so sign in there once,
            then use this sign-in helper to bring your session here:
          </p>
          <ol className="text-[12.5px] flex flex-col gap-1.5 list-decimal list-inside" style={{ color: "hsl(var(--muted-foreground))" }}>
            <li>
              Drag this to your bookmarks bar (or, on mobile, copy it below and paste as a new bookmark&apos;s
              URL):{" "}
              <a
                href={bookmarklet}
                className="inline-block px-2 py-1 rounded-md text-[11.5px] font-semibold"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                onClick={(e) => e.preventDefault()}
              >
                JP Sign-In Helper
              </a>
            </li>
            <li>
              Open{" "}
              <a
                href={WEBKIOSK_LOGIN_URL}
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: "hsl(var(--primary))" }}
              >
                the WebKiosk login page
              </a>{" "}
              in a new tab.
            </li>
            <li>Tap the bookmarklet first (it&apos;ll show a &quot;Ready&quot; alert).</li>
            <li>Then click &quot;Sign in with Google&quot; as normal — you&apos;ll land back here signed in.</li>
          </ol>
          <button
            type="button"
            className="wp-btn"
            style={{ background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            onClick={copyBookmarklet}
          >
            <i className={`ph ${copied ? "ph-check" : "ph-copy"}`} />
            <span>{copied ? "Copied" : "Copy sign-in helper code"}</span>
          </button>
        </div>

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
  onLoginSuccess: PropTypes.func.isRequired,
};
