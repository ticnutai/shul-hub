// Google Play upload, with the service account (nothing secret printed).
//   node scripts/play-upload.mjs check                 - can it reach the app? (opens and drops a draft)
//   node scripts/play-upload.mjs internal <aab> <notes> - upload to internal testing and commit
//   node scripts/play-upload.mjs listings              - the store page's languages and names
//   node scripts/play-upload.mjs title <lang> <title>  - change the name on the store page
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// The service account file is kept outside the project (never in git).
const KEY = process.env.PLAY_SERVICE_ACCOUNT || "C:/Users/jj121/Documents/Pash-Android-Signing-Backup-KEEP-SAFE/google-play-service-account.json";
const PKG = "com.ticnutai.bsr3synagogue";
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}`;

const sa = JSON.parse(readFileSync(KEY, "utf8"));

// The line to Google drops now and then: each request is tried again, up to five times.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  for (let i = 1; ; i++) {
    try {
      return await realFetch(url, init);
    } catch (e) {
      if (i >= 5) throw e;
      console.log(`network, try ${i + 1}...`);
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
};
const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = createSign("RSA-SHA256").update(body).sign(sa.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${body}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`token: ${r.status} ${j.error ?? ""}`);
  return j.access_token;
}

const [cmd, aab, notes] = process.argv.slice(2);
const t = await token();
const call = async (method, url, body, headers = { "content-type": "application/json" }) => {
  const r = await fetch(url, { method, headers: { authorization: `Bearer ${t}`, ...headers }, body });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url.replace(/^https:\/\/[^/]+/, "")}: ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
};

const edit = await call("POST", `${API}/edits`, "{}");
console.log("draft opened");
try {
  if (cmd === "check") {
    const tracks = await call("GET", `${API}/edits/${edit.id}/tracks`);
    for (const tr of tracks.tracks ?? []) {
      console.log(tr.track, (tr.releases ?? []).map((r) => `${r.name ?? ""} [${(r.versionCodes ?? []).join(",")}] ${r.status}`).join(" | "));
    }
    await call("DELETE", `${API}/edits/${edit.id}`);
    console.log("draft dropped - nothing changed");
  } else if (cmd === "listings") {
    const l = await call("GET", `${API}/edits/${edit.id}/listings`);
    for (const x of l.listings ?? []) console.log(x.language, "|", x.title, "|", (x.shortDescription ?? "").slice(0, 60));
    await call("DELETE", `${API}/edits/${edit.id}`);
    console.log("draft dropped - nothing changed");
  } else if (cmd === "title") {
    // node scripts/play-upload.mjs title <language> <title>: the name on the store page, nothing else.
    const [language, title] = [aab, notes];
    if (!title || [...title].length > 30) throw new Error("Google Play takes a title of up to 30 characters");
    await call("PATCH", `${API}/edits/${edit.id}/listings/${language}`, JSON.stringify({ title }));
    await call("POST", `${API}/edits/${edit.id}:commit`);
    console.log("store title is now:", title);
  } else if (cmd === "internal") {
    // With curl: on a slow line the bundle takes minutes, and fetch gives up
    // waiting for an answer after five.
    const out = execFileSync(
      "curl",
      [
        "-sS", "--fail-with-body", "-m", "3600", "--retry", "3", "--retry-all-errors", "-X", "POST",
        "-H", `authorization: Bearer ${t}`,
        "-H", "content-type: application/octet-stream",
        "--data-binary", `@${aab}`,
        `${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    ).toString();
    const bundle = JSON.parse(out);
    console.log("uploaded versionCode", bundle.versionCode, "sha1", bundle.sha1);
    await call(
      "PUT",
      `${API}/edits/${edit.id}/tracks/internal`,
      JSON.stringify({
        track: "internal",
        releases: [
          {
            name: process.env.RELEASE_NAME || undefined,
            versionCodes: [String(bundle.versionCode)],
            status: "completed",
            releaseNotes: [{ language: "iw-IL", text: notes }],
          },
        ],
      }),
    );
    const done = await call("POST", `${API}/edits/${edit.id}:commit`);
    console.log("committed to internal testing, edit", done.id ? "ok" : JSON.stringify(done));
  }
} catch (e) {
  await call("DELETE", `${API}/edits/${edit.id}`).catch(() => {});
  throw e;
}
