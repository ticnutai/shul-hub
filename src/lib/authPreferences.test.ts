// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  authSessionStorage,
  getAuthPersistence,
  getRememberedEmail,
  setAuthPersistence,
  setRememberedEmail,
} from "./authPreferences";

describe("auth preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("migrates only a legacy email and removes the plaintext password", () => {
    localStorage.setItem("torah_remember_me", JSON.stringify({
      email: " manager@example.com ",
      password: "must-not-remain",
    }));
    localStorage.setItem("torah_auto_login", "true");

    expect(getRememberedEmail()).toBe("manager@example.com");
    expect(localStorage.getItem("torah_remembered_email")).toBe("manager@example.com");
    expect(localStorage.getItem("torah_remember_me")).toBeNull();
    expect(localStorage.getItem("torah_auto_login")).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain("must-not-remain");
  });

  it("removes stale legacy credentials even when the new remembered email exists", () => {
    localStorage.setItem("torah_remembered_email", "saved@example.com");
    localStorage.setItem("torah_remember_me", JSON.stringify({ password: "legacy-secret" }));

    expect(getRememberedEmail()).toBe("saved@example.com");
    expect(localStorage.getItem("torah_remember_me")).toBeNull();
  });

  it("stores a remembered session locally and a temporary session per browser tab", () => {
    setAuthPersistence(true);
    authSessionStorage.setItem("sb-project-auth-token", "persistent");
    expect(getAuthPersistence()).toBe(true);
    expect(localStorage.getItem("sb-project-auth-token")).toBe("persistent");

    setAuthPersistence(false);
    authSessionStorage.setItem("sb-project-auth-token", "temporary");
    expect(getAuthPersistence()).toBe(false);
    expect(localStorage.getItem("sb-project-auth-token")).toBeNull();
    expect(sessionStorage.getItem("sb-project-auth-token")).toBe("temporary");
  });

  it("keeps the signed-in session when remember-me is turned on after signing in: it moves, it is not dropped", () => {
    // Signed in without "remember me" - the session lives in the tab only.
    setAuthPersistence(false);
    authSessionStorage.setItem("sb-project-auth-token", "signed-in");
    // "Remember me" turned on (the setting, or the next sign-in screen): the session goes along.
    setAuthPersistence(true);
    expect(localStorage.getItem("sb-project-auth-token")).toBe("signed-in");
    expect(sessionStorage.getItem("sb-project-auth-token")).toBeNull();
    // The next visit (a new tab, the app opened again) is still signed in.
    sessionStorage.clear();
    expect(authSessionStorage.getItem("sb-project-auth-token")).toBe("signed-in");
  });

  it("keeps the session of this visit when remember-me is turned off, until the tab closes", () => {
    setAuthPersistence(true);
    authSessionStorage.setItem("sb-project-auth-token", "signed-in");
    setAuthPersistence(false);
    expect(authSessionStorage.getItem("sb-project-auth-token")).toBe("signed-in");
    expect(localStorage.getItem("sb-project-auth-token")).toBeNull();
  });

  it("finds a session left in the other storage and carries it over, rather than signing out", () => {
    setAuthPersistence(true);
    sessionStorage.setItem("sb-project-auth-token", "left-behind");
    expect(authSessionStorage.getItem("sb-project-auth-token")).toBe("left-behind");
    expect(localStorage.getItem("sb-project-auth-token")).toBe("left-behind");
    expect(sessionStorage.getItem("sb-project-auth-token")).toBeNull();
  });

  it("clears remembered email without affecting unrelated settings", () => {
    localStorage.setItem("theme", "jerusalem");
    setRememberedEmail("person@example.com");
    setRememberedEmail(null);

    expect(getRememberedEmail()).toBe("");
    expect(localStorage.getItem("theme")).toBe("jerusalem");
  });
});
