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

describe("the updater from the website (NativeBridge)", () => {
  const fake = (over: Partial<import("./apkUpdate").ShulTvNative> = {}) => ({
    info: () => JSON.stringify({ versionCode: 37, versionName: "1.36", canInstall: true, downloaded: false }),
    download: () => true,
    install: () => "installing",
    ...over,
  });

  it("is found on a box whose board comes from the website", async () => {
    const { canSelfUpdate } = await import("./apkUpdate");
    expect(canSelfUpdate()).toBe(false);
    (window as { ShulTvNative?: unknown }).ShulTvNative = fake();
    expect(canSelfUpdate()).toBe(true);
    delete (window as { ShulTvNative?: unknown }).ShulTvNative;
  });

  it("reads the installed version and finishes a download when the app says so", async () => {
    const { bridgeUpdater } = await import("./apkUpdate");
    const u = bridgeUpdater(fake());
    expect((await u.info()).versionCode).toBe(37);
    const seen: number[] = [];
    await u.addListener("progress", (e) => seen.push(e.percent));
    const done = u.download({ url: "https://shul-hub.lovable.app/tv.apk" });
    window.dispatchEvent(new CustomEvent("shul-apk", { detail: { type: "progress", percent: 50 } }));
    window.dispatchEvent(new CustomEvent("shul-apk", { detail: { type: "done", bytes: 5_000_000 } }));
    await expect(done).resolves.toEqual({ bytes: 5_000_000 });
    expect(seen).toEqual([50]);
  });

  it("reports a refused download and the permission screen", async () => {
    const { bridgeUpdater } = await import("./apkUpdate");
    await expect(bridgeUpdater(fake({ download: () => false })).download({ url: "https://evil.example/x.apk" })).rejects.toThrow();
    expect(await bridgeUpdater(fake({ install: () => "permission" })).install()).toEqual({ needsPermission: true });
  });
});
