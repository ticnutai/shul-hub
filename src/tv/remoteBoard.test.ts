import { describe, expect, it } from "vitest";
import {
  BOARD_MARKER,
  HANDOFF_KEYS,
  REMOTE_BOARD_URL,
  applyHandoff,
  boardScript,
  encodeHandoff,
  fetchRemoteBoard,
  isRemoteBoard,
} from "./remoteBoard";

function store(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const identity = JSON.stringify({ id: "3f1c0e0a-0000-4000-8000-000000000001", secret: "ab".repeat(32) });
const community = JSON.stringify({ id: "c9a6", name: "בית הכנסת אפי קפיטל" });

describe("the board from the website (remoteBoard)", () => {
  it("knows the website's origin", () => {
    expect(isRemoteBoard(new URL(REMOTE_BOARD_URL).origin)).toBe(true);
    expect(isRemoteBoard("https://localhost")).toBe(false);
  });

  it("hands the screen's identity and synagogue over, and nothing else", () => {
    const apk = store({ "shul-tv-device": identity, "shul-tv-community": community, "shul-tv-seen-commands": "[1,2]" });
    const site = store();
    const hash = `#${encodeHandoff(apk, "https://localhost/")}`;
    expect(applyHandoff(hash, site)).toBe(true);
    expect(site.data.get("shul-tv-device")).toBe(identity);
    expect(site.data.get("shul-tv-community")).toBe(community);
    expect(site.data.has("shul-tv-seen-commands")).toBe(false);
    expect(site.data.get("shul-tv-local-url")).toBe("https://localhost/");
    expect(HANDOFF_KEYS).toEqual(["shul-tv-device", "shul-tv-community"]);
  });

  it("lets the APK's identity win over one the website's copy made itself", () => {
    const site = store({ "shul-tv-device": JSON.stringify({ id: "other", secret: "cd".repeat(32) }) });
    applyHandoff(`#${encodeHandoff(store({ "shul-tv-device": identity }), "https://localhost/")}`, site);
    expect(site.data.get("shul-tv-device")).toBe(identity);
  });

  it("ignores a missing or broken handoff, and a way back that is not the APK", () => {
    const site = store();
    expect(applyHandoff("", site)).toBe(false);
    expect(applyHandoff("#handoff=%7Bnot-json", site)).toBe(false);
    applyHandoff(`#handoff=${encodeURIComponent(JSON.stringify({ values: {}, localUrl: "https://evil.example/" }))}`, site);
    expect(site.data.has("shul-tv-local-url")).toBe(false);
  });

  it("reads the published board's script", () => {
    expect(boardScript('<script type="module" crossorigin src="/assets/index-tv-NP5bQ982.js"></script>')).toBe(
      "/assets/index-tv-NP5bQ982.js",
    );
    expect(boardScript("<html></html>")).toBeNull();
  });

  it("accepts only a page that is the board", async () => {
    const answer = (body: string, ok = true) => (async () => ({ ok, text: async () => body })) as unknown as typeof fetch;
    expect(await fetchRemoteBoard(answer(`<meta ${BOARD_MARKER} content="1">`))).toContain(BOARD_MARKER);
    expect(await fetchRemoteBoard(answer("<html>login</html>"))).toBeNull();
    expect(await fetchRemoteBoard(answer(`<meta ${BOARD_MARKER}>`, false))).toBeNull();
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await fetchRemoteBoard(offline)).toBeNull();
  });
});
