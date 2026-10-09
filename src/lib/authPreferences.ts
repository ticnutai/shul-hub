const AUTH_PERSISTENCE_KEY = "torah_auth_remember";
const REMEMBERED_EMAIL_KEY = "torah_remembered_email";
const LEGACY_CREDENTIALS_KEY = "torah_remember_me";
const LEGACY_AUTO_LOGIN_KEY = "torah_auto_login";

const isBrowser = () => typeof window !== "undefined";

export function getAuthPersistence(): boolean {
  if (!isBrowser()) return true;
  // Preserve existing signed-in sessions unless the user explicitly opts out.
  return localStorage.getItem(AUTH_PERSISTENCE_KEY) !== "false";
}

const isSessionKey = (key: string | null): key is string => Boolean(key?.startsWith("sb-") && key.endsWith("-auth-token"));

export function setAuthPersistence(enabled: boolean) {
  if (!isBrowser()) return;
  localStorage.setItem(AUTH_PERSISTENCE_KEY, enabled ? "true" : "false");

  // The signed-in session moves to the storage now chosen - it is not dropped.
  // (Removing it from the old storage without carrying it over signed the
  // user out at the next visit, though "remember me" was on.)
  const from = enabled ? sessionStorage : localStorage;
  const to = enabled ? localStorage : sessionStorage;
  for (let index = from.length - 1; index >= 0; index -= 1) {
    const key = from.key(index);
    if (!isSessionKey(key)) continue;
    const value = from.getItem(key);
    if (value && !to.getItem(key)) to.setItem(key, value);
    from.removeItem(key);
  }
}

export function getRememberedEmail(): string {
  if (!isBrowser()) return "";
  const current = localStorage.getItem(REMEMBERED_EMAIL_KEY)?.trim();
  // Never leave credentials saved by the legacy implementation behind.
  localStorage.removeItem(LEGACY_AUTO_LOGIN_KEY);
  if (current) {
    localStorage.removeItem(LEGACY_CREDENTIALS_KEY);
    return current;
  }

  // One-time safe migration: retain only the email and discard legacy plaintext passwords.
  const legacy = localStorage.getItem(LEGACY_CREDENTIALS_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as { email?: unknown };
      if (typeof parsed.email === "string" && parsed.email.trim()) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, parsed.email.trim());
        return parsed.email.trim();
      }
    } catch {
      // Ignore malformed legacy data.
    } finally {
      localStorage.removeItem(LEGACY_CREDENTIALS_KEY);
    }
  }
  return "";
}

export function setRememberedEmail(email: string | null) {
  if (!isBrowser()) return;
  localStorage.removeItem(LEGACY_CREDENTIALS_KEY);
  localStorage.removeItem(LEGACY_AUTO_LOGIN_KEY);
  if (email?.trim()) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
  else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}

export const authSessionStorage = {
  getItem(key: string) {
    if (!isBrowser()) return null;
    const chosen = getAuthPersistence() ? localStorage : sessionStorage;
    const found = chosen.getItem(key);
    if (found !== null) return found;
    // A session left in the other storage (the choice changed in another tab,
    // or by an older version) is found and carried over, rather than lost.
    const other = chosen === localStorage ? sessionStorage : localStorage;
    const stray = other.getItem(key);
    if (stray !== null && isSessionKey(key)) {
      chosen.setItem(key, stray);
      other.removeItem(key);
    }
    return stray;
  },
  setItem(key: string, value: string) {
    if (!isBrowser()) return;
    (getAuthPersistence() ? localStorage : sessionStorage).setItem(key, value);
  },
  removeItem(key: string) {
    if (!isBrowser()) return;
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
