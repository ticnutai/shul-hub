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

  it("clears remembered email without affecting unrelated settings", () => {
    localStorage.setItem("theme", "jerusalem");
    setRememberedEmail("person@example.com");
    setRememberedEmail(null);

    expect(getRememberedEmail()).toBe("");
    expect(localStorage.getItem("theme")).toBe("jerusalem");
  });
});
