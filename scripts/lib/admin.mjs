/**
 * Signing in as the administrator, once, for all the screen tools.
 *
 * Seven scripts here each read .env, post the same login and take
 * `access_token` off the answer. Three of them, when that login was refused,
 * printed "sign-in failed" and stopped - so the one thing worth knowing, the
 * sentence the server sent back, was the one thing thrown away. The rest did
 * not check at all: `undefined` became the bearer token, every query came
 * back as an error object, and the first loop over it said "devices is not
 * iterable", which is a true statement about nothing that matters.
 *
 * It is the same shape of mistake as tv-snap.mjs asking for a column that had
 * been renamed and reporting "no stored screenshots": a quiet, wrong answer
 * to a question that had an answer. Somewhere to put it once seemed better
 * than fixing it in seven places and waiting for the eighth.
 *
 * The credentials are never in the repository. They come from the Windows
 * user environment, and nothing here prints them.
 */
import fs from "node:fs";

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

export const env = readEnvFile(".env");

export const url = env.VITE_SUPABASE_URL;
export const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Who administers *this* project.
 *
 * There is a machine-wide MIGRATION_ADMIN_EMAIL for whichever project is
 * usually in hand, and .env.migrations.local for the one that is not - here,
 * a different account entirely. The per-project file has to win, or these
 * tools sign in as somebody who is not an admin of this synagogue and the
 * server answers, correctly, "Invalid login credentials" - which reads as a
 * wrong password and sends you off to change one that was never wrong.
 *
 * An empty value in the file means "use the machine's", which is how the
 * file ships: the email is project-specific, the password is not.
 */
const local = readEnvFile(".env.migrations.local");
const pick = (name) => local[name] || process.env[name] || undefined;

/**
 * Says why, and stops - without process.exit().
 *
 * Node 24 on Windows aborts on process.exit() while a connection from fetch
 * is still open ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"),
 * which replaces the explanation that was just printed with a crash and exit
 * code 127. Setting the exit code and unwinding leaves the message standing
 * and exits 1.
 */
class Stop extends Error {}

// A top-level `await` that rejects in the entry module arrives as an
// uncaught exception, not as an unhandled rejection; both are registered so
// it does not matter which one a given script produces.
const fell = (e) => {
  if (!(e instanceof Stop)) console.error(e); // Stop has already explained itself
  process.exitCode = 1;
};
process.on("unhandledRejection", fell);
process.on("uncaughtException", fell);

function stop(...lines) {
  for (const l of lines) if (l) console.error(l);
  process.exitCode = 1;
  throw new Stop();
}

/**
 * Returns headers that carry the admin's session, or explains and stops.
 *
 * `json: true` adds the Content-Type that PostgREST wants for writes.
 */
export async function signIn({ json = false } = {}) {
  const email = pick("MIGRATION_ADMIN_EMAIL");
  const password = pick("MIGRATION_ADMIN_PASSWORD");
  if (!email || !password) {
    stop(
      "no administrator credentials.",
      "set MIGRATION_ADMIN_EMAIL and MIGRATION_ADMIN_PASSWORD in the Windows user environment,",
      "or put this project's own values in .env.migrations.local.",
    );
  }

  let res;
  try {
    res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    stop(`could not reach ${url}: ${e.message}`);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const said = body.msg ?? body.error_description ?? body.error ?? res.statusText;
    stop(
      `the server refused the login for ${email}: ${said}`,
      body.error_code === "invalid_credentials"
        ? `check that ${email} is the administrator of this project and that the password matches - ` +
          "MIGRATION_ADMIN_EMAIL / MIGRATION_ADMIN_PASSWORD, or .env.migrations.local."
        : `(status ${res.status}${body.error_code ? `, ${body.error_code}` : ""})`,
    );
  }

  const headers = { apikey: key, Authorization: `Bearer ${body.access_token}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/**
 * A GET that comes back as rows, or says why it did not.
 *
 * PostgREST answers an error with an object, not a list, so every caller that
 * goes straight to `.map` or `for..of` turns a readable message into a type
 * error. This keeps the message.
 */
export async function rows(headers, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  const body = await res.json().catch(() => null);
  if (!Array.isArray(body)) {
    stop(
      `${path.split("?")[0]}: ${res.status} ${body?.message ?? JSON.stringify(body)}`,
      body?.hint ? `hint: ${body.hint}` : "",
    );
  }
  return body;
}
