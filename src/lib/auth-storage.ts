const REMEMBER_AUTH_KEY = "shul-auth-remember";

function shouldRememberAuth() {
  return localStorage.getItem(REMEMBER_AUTH_KEY) !== "false";
}

export function setRememberAuth(remember: boolean) {
  localStorage.setItem(REMEMBER_AUTH_KEY, String(remember));
}

export function getRememberAuth() {
  return typeof window === "undefined" ? true : shouldRememberAuth();
}

export const authStorage = {
  getItem(key: string) {
    const preferred = shouldRememberAuth() ? localStorage : sessionStorage;
    const fallback = shouldRememberAuth() ? sessionStorage : localStorage;
    return preferred.getItem(key) ?? fallback.getItem(key);
  },
  setItem(key: string, value: string) {
    const preferred = shouldRememberAuth() ? localStorage : sessionStorage;
    const other = shouldRememberAuth() ? sessionStorage : localStorage;
    preferred.setItem(key, value);
    other.removeItem(key);
  },
  removeItem(key: string) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
