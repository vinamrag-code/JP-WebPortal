function generate_date_seq(date = null) {
  if (date === null) {
    date = new Date();
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(2);
  const weekday = String(date.getDay());
  return day[0] + month[0] + year[0] + weekday + day[1] + month[1] + year[1];
}

function base64Encode(data) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(data)));
}

const IV = new TextEncoder().encode("dcek9wb8frty1pnm");

async function generate_key(date = null) {
  const dateSeq = generate_date_seq(date);
  const keyData = new TextEncoder().encode("qa8y" + dateSeq + "ty1pn");
  return window.crypto.subtle.importKey("raw", keyData, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(data) {
  const key = await generate_key();
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-CBC", iv: IV }, key, data);
  return new Uint8Array(encrypted);
}

export async function serialize_payload(payload) {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  const pbytes = await encrypt(raw);
  return base64Encode(pbytes);
}

const LOCALNAME_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomChars(n) {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += LOCALNAME_CHARSET[Math.floor(Math.random() * LOCALNAME_CHARSET.length)];
  }
  return out;
}

/**
 * The `LocalName` request header the portal's API expects on every call (authenticated or not) - a
 * date-derived nonce, same scheme as the login/session payload encryption above (jsjiit's private `T()`,
 * reimplemented here since jsjiit only exports `WebPortal`/`LoginError`, not this helper). Needed once
 * login stopped going through jsjiit's own `student_login` (see `@/lib/googleAuth`) - jsjiit's `WebPortal`
 * still generates this internally for calls made through it, but a hand-built session's `get_headers()`
 * has to produce the same thing itself.
 */
export async function generateLocalName() {
  const plaintext = new TextEncoder().encode(randomChars(4) + generate_date_seq() + randomChars(5));
  const encrypted = await encrypt(plaintext);
  return base64Encode(encrypted);
}
