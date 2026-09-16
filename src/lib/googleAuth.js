/**
 * Student login via Google Sign-In, replacing the username/password flow the portal removed for students
 * (16 Sep 2026 - see PROGRESS.md).
 *
 * A plain "Sign in with Google" button rendered on jportal's own origin CANNOT work: the portal's Google
 * OAuth client (`395311773821-....apps.googleusercontent.com`) only authorizes `webportal.jiit.ac.in`'s
 * own origin in Google Cloud Console - Google returns `origin_mismatch` for any other origin, in a real
 * browser or a WebView, and there is no library/SDK workaround (confirmed: Android's Credential Manager
 * has the same restriction from the other direction - it requires *our* app to be registered under
 * *JIIT's* Google Cloud project). Google also blocks its sign-in flow entirely inside embedded WebViews
 * since July 2023, independent of origin, which rules out proxying/iframing the real page too.
 *
 * The only path that needs no cooperation from JIIT and breaks no Google policy: the student signs in
 * once on the portal's own real, authorized page (`webportal.jiit.ac.in:6011/studentportal/`), and a
 * **bookmarklet** (`buildBookmarklet`) - which runs *as that page's own script*, so it's not
 * cross-origin - captures the resulting session and hands it to jportal via a redirect. It intercepts the
 * `generatetokengooglesignin` network response directly (rather than reading the page's own
 * `localStorage` afterward) because the portal's own frontend doesn't persist every field jsjiit's session
 * needs (`memberid`, notably) to `localStorage` - only the live response has everything.
 *
 * Once a session exists, everything downstream is unchanged: the response is shaped like jsjiit's own
 * login response (token, clientid, enrollmentno, membertype, name, ...), so every other `WebPortal` method
 * keeps working once `w.session` is set to an object shaped like jsjiit's own (private, unexported)
 * `WebPortalSession`. jsjiit's `LocalName` header generator isn't exported either, so it's reimplemented
 * in `@/lib/jiitCrypto`.
 */
import { generateLocalName } from "@/lib/jiitCrypto";
import { setGoogleSession, getGoogleSession, clearGoogleSession } from "@/components/scripts/cache";

const REFRESH_PATH = "/token/refreshTokenRequest";

/**
 * The bookmarklet source, as readable JS (see `buildBookmarklet` for the `javascript:`-URI-encoded form
 * actually installed as a bookmark). Patches `fetch` to watch for the Google-login response *before* the
 * user clicks "Sign in with Google" - install and run it on the WebKiosk login page first, then sign in
 * normally.
 */
function bookmarkletSource(targetOrigin) {
  return `(function(){
    var origFetch = window.fetch;
    window.fetch = function(){
      var args = arguments;
      return origFetch.apply(this, args).then(function(res){
        var url = args[0];
        if (typeof url === 'string' && url.indexOf('generatetokengooglesignin') !== -1) {
          res.clone().json().then(function(data){
            var r = data && data.response;
            if (r && r.token) {
              var qs = new URLSearchParams(r).toString();
              window.location.href = ${JSON.stringify(targetOrigin)} + '/#/import-session?' + qs;
            }
          }).catch(function(){});
        }
        return res;
      });
    };
    alert('Ready. Now click "Sign in with Google" on this page.');
  })();`;
}

/** A `javascript:` URI suitable for a bookmark's URL field (drag-to-bookmarks-bar or paste-into-a-new-bookmark). */
export function buildBookmarklet(targetOrigin = window.location.origin) {
  return "javascript:" + encodeURIComponent(bookmarkletSource(targetOrigin));
}

export const WEBKIOSK_LOGIN_URL = "https://webportal.jiit.ac.in:6011/studentportal/";

/**
 * Builds a jsjiit-`WebPortalSession`-shaped object from a captured `generatetokengooglesignin` response
 * (from the bookmarklet's redirect, or a cached snapshot with the same fields - see `restoreSession`).
 * `get_headers()` matches what every other `WebPortal` method already calls on `this.session`, so
 * attaching this to `w.session` is enough for the rest of the app - attendance, grades, timetable,
 * everything - to keep working unchanged. It also proactively refreshes near the token's baked-in expiry
 * so an active session doesn't surface a 401 mid-use.
 */
function buildSession(apiUrl, response) {
  const token = response.token;
  let expiry = null;
  try {
    expiry = new Date(JSON.parse(atob(token.split(".")[1])).exp * 1000);
  } catch {
    expiry = null;
  }

  const session = {
    institute: response.label,
    instituteid: response.value ?? response.instituteid,
    memberid: response.memberid,
    userid: response.userid,
    token,
    expiry,
    clientid: response.clientid,
    membertype: response.membertype,
    name: response.name,
    enrollmentno: response.enrollmentno,
    googleUsername: response.Username,
    tokenDate: new Date().toISOString(),
    async get_headers() {
      if (this.expiry && this.expiry.getTime() - Date.now() < 60_000) {
        await refreshSession(apiUrl, this);
      }
      return { Authorization: `Bearer ${this.token}`, LocalName: await generateLocalName() };
    },
  };

  setGoogleSession({
    instituteid: session.instituteid,
    institute: session.institute,
    memberid: session.memberid,
    userid: session.userid,
    token: session.token,
    expiry: session.expiry ? session.expiry.toISOString() : null,
    clientid: session.clientid,
    membertype: session.membertype,
    name: session.name,
    enrollmentno: session.enrollmentno,
    googleUsername: session.googleUsername,
    tokenDate: session.tokenDate,
  });

  return session;
}

/**
 * Builds a session from the params the bookmarklet's redirect carries (`#/import-session?token=...&...`)
 * and attaches it to `w`. `params` is anything `Object.fromEntries` accepts (e.g. `URLSearchParams`).
 */
export function importSession(w, params) {
  const response = params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;
  if (!response?.token) throw new Error("Missing session token in the imported link.");
  w.session = buildSession(w.apiUrl, response);
  return w.session;
}

/**
 * Extends the current session server-side using the portal's own `refreshTokenRequest` - no Google
 * credential needed, so this is what keeps a signed-in student from seeing the bookmarklet flow again on
 * every 401, not just every app launch. Per the portal's own frontend, a "Success" response means the
 * *existing* bearer token keeps working; it does not return a new one.
 */
export async function refreshSession(apiUrl, session) {
  try {
    const localName = await generateLocalName();
    const res = await fetch(apiUrl + REFRESH_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
        LocalName: localName,
      },
      body: JSON.stringify({ username: session.googleUsername, tokendate: session.tokenDate ?? new Date().toISOString() }),
    });
    const data = await res.json().catch(() => null);
    const ok = data?.response?.msg === "Success";
    if (ok) {
      session.tokenDate = new Date().toISOString();
      setGoogleSession({ ...getGoogleSession(), tokenDate: session.tokenDate });
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * Rebuilds a session object from the last cached snapshot (see `buildSession`), for app launches that
 * shouldn't need the bookmarklet flow again. Callers should still expect a possible 401 on first use if
 * the portal has actually invalidated the session server-side - `get_headers()`'s proactive refresh only
 * covers the token's own baked-in expiry, not a server-side revoke.
 */
export function restoreSession(apiUrl) {
  const cached = getGoogleSession();
  if (!cached?.token) return null;
  const session = {
    institute: cached.institute,
    instituteid: cached.instituteid,
    memberid: cached.memberid,
    userid: cached.userid,
    token: cached.token,
    expiry: cached.expiry ? new Date(cached.expiry) : null,
    clientid: cached.clientid,
    membertype: cached.membertype,
    name: cached.name,
    enrollmentno: cached.enrollmentno,
    googleUsername: cached.googleUsername,
    tokenDate: cached.tokenDate,
    async get_headers() {
      if (this.expiry && this.expiry.getTime() - Date.now() < 60_000) {
        await refreshSession(apiUrl, this);
      }
      return { Authorization: `Bearer ${this.token}`, LocalName: await generateLocalName() };
    },
  };
  return session;
}

export function clearSavedGoogleSession() {
  clearGoogleSession();
}
