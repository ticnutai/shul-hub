import { afterEach, describe, expect, it, vi } from "vitest";
import { inlineVariableImages } from "./snapshotImages";

afterEach(() => vi.unstubAllGlobals());

describe("a photo of the board", () => {
  it("carries the pictures its variables point to, and gives the page back as it was", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["wood"], { type: "image/jpeg" }))));
    const root = document.createElement("div");
    root.style.setProperty("--tv-bg-image", 'url("/assets/wood.jpg")');
    root.style.setProperty("--frame-image", 'url("/assets/frame.png")');
    root.style.setProperty("--tv-accent", "#c9a24a");
    const before = root.getAttribute("style");

    const restore = await inlineVariableImages(root);
    expect(root.style.getPropertyValue("--tv-bg-image")).toMatch(/^url\("data:.*;base64,/);
    expect(root.style.getPropertyValue("--frame-image")).toMatch(/^url\("data:/);
    expect(root.style.getPropertyValue("--tv-accent")).toBe("#c9a24a");

    restore();
    expect(root.getAttribute("style")).toBe(before);
  });

  it("leaves a picture that does not load as it was", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const root = document.createElement("div");
    root.style.setProperty("--tv-bg-image", 'url("/assets/wood.jpg")');
    await inlineVariableImages(root);
    expect(root.style.getPropertyValue("--tv-bg-image")).toBe('url("/assets/wood.jpg")');
  });
});
