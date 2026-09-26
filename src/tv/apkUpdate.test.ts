import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { newerVersion, updateText } from "./apkUpdate";

describe("board app self-update", () => {
  const ok = { versionCode: 36, versionName: "1.35", apk: "https://shul-hub.lovable.app/tv.apk" };

  it("offers only a newer version from the board's own site", () => {
    expect(newerVersion(ok, 35)).toEqual(ok);
    expect(newerVersion(ok, 36)).toBeNull();
    expect(newerVersion(ok, 40)).toBeNull();
    expect(newerVersion({ ...ok, apk: "https://evil.example/tv.apk" }, 1)).toBeNull();
    expect(newerVersion({ ...ok, apk: "http://shul-hub.lovable.app/tv.apk" }, 1)).toBeNull();
    expect(newerVersion({ ...ok, versionCode: "x" }, 1)).toBeNull();
    expect(newerVersion(null, 1)).toBeNull();
  });

  it("says what to do on the screen", () => {
    expect(updateText({ phase: "idle" })).toBeNull();
    expect(updateText({ phase: "ready", version: "1.35" })).toContain("OK");
  });

  it("publishes the same version the TV app is built as", () => {
    const published = JSON.parse(readFileSync("public/tv-version.json", "utf8"));
    const gradle = readFileSync("android-tv/app/build.gradle", "utf8");
    expect(`versionCode ${published.versionCode}`).toBe(gradle.match(/versionCode \d+/)![0]);
    expect(`versionName "${published.versionName}"`).toBe(gradle.match(/versionName "[^"]+"/)![0]);
    expect(newerVersion(published, 0)).not.toBeNull();
  });
});
