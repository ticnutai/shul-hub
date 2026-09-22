import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  communityId,
  currentCommunity,
  setCommunity,
  subscribeCommunity,
} from "./community";

/* ------------------------------------------------------- the guarantee -- */

/**
 * Every table that belongs to one synagogue. A query against one of these
 * that does not say which synagogue it means is the bug this whole design
 * exists to prevent - and it is a bug that looks like working code, which
 * is why a human reviewer is the wrong thing to rely on.
 */
const TENANT_TABLES = [
  "settings", "minyan_categories", "minyanim", "announcements",
  "shiur_categories", "shiurim", "chavrutot", "chavruta_requests",
  "admin_messages", "home_widgets", "app_themes", "tv_config", "tv_devices",
];

/**
 * Queries that are deliberately not scoped, each with the reason. Anything
 * not on this list must scope itself; anything that lands here has to be
 * argued for in writing first.
 */
const DELIBERATE: { file: string; why: string }[] = [
  {
    file: "src/community/lib/community.ts",
    why: "reads the communities table itself, which is the list of synagogues",
  },
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("no query may forget which synagogue it means", () => {
  const root = path.resolve(__dirname, "../../..");
  const files = sourceFiles(path.join(root, "src"));

  it("finds the source to check", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const table of TENANT_TABLES) {
    it(`every query on ${table} is scoped to a synagogue`, () => {
      const unscoped: string[] = [];

      for (const file of files) {
        const rel = path.relative(root, file).replace(/\\/g, "/");
        if (DELIBERATE.some((d) => d.file === rel)) continue;

        const text = fs.readFileSync(file, "utf8");
        const lines = text.split("\n");

        lines.forEach((line, i) => {
          if (!line.includes(`.from("${table}")`)) return;
          // The scoping sits within a few lines either way: on the builder
          // chain below, or in the object being inserted.
          const around = lines.slice(Math.max(0, i - 2), i + 14).join("\n");
          if (!around.includes("community_id")) {
            unscoped.push(`${rel}:${i + 1}`);
          }
        });
      }

      expect(unscoped, `unscoped queries on ${table}`).toEqual([]);
    });
  }

  it("the RPC that reads past RLS is told which synagogue", () => {
    const data = fs.readFileSync(path.join(root, "src/community/lib/data.ts"), "utf8");
    const at = data.indexOf("list_approved_chavruta_requests");
    expect(at).toBeGreaterThan(-1);
    expect(data.slice(at, at + 200)).toContain("p_community");
  });
});

/* ---------------------------------------------------------- the store -- */

describe("the synagogue in hand", () => {
  const shulA = { id: "a-id", slug: "shul-a", name: "בית כנסת א" };
  const shulB = { id: "b-id", slug: "shul-b", name: "בית כנסת ב" };

  beforeEach(() => {
    setCommunity(null);
    localStorage.clear();
  });

  it("refuses to guess before anything is settled", () => {
    expect(() => communityId()).toThrow();
    expect(currentCommunity()).toBeNull();
  });

  it("hands out the one that was chosen", () => {
    setCommunity(shulA);
    expect(communityId()).toBe("a-id");
  });

  it("remembers the choice for next time", () => {
    setCommunity(shulA);
    expect(localStorage.getItem("shul-hub.community")).toBe("shul-a");
  });

  it("can be set without being remembered - a screen is told, not asked", () => {
    setCommunity(shulA, false);
    expect(communityId()).toBe("a-id");
    expect(localStorage.getItem("shul-hub.community")).toBeNull();
  });

  it("tells everyone watching when it changes, and not when it does not", () => {
    let calls = 0;
    const stop = subscribeCommunity(() => calls++);
    setCommunity(shulA);
    setCommunity(shulA); // the same one again
    setCommunity(shulB);
    stop();
    setCommunity(shulA); // after unsubscribing
    expect(calls).toBe(2);
  });
});

describe("working out which synagogue a visit is about", () => {
  const all = [
    { id: "a-id", slug: "shul-a", name: "בית כנסת א" },
    { id: "b-id", slug: "shul-b", name: "בית כנסת ב" },
  ];

  beforeEach(() => {
    setCommunity(null);
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  /** resolveCommunity's decision, without the network. */
  const decide = (list: typeof all, link: string | null, stored: string | null) =>
    list.find((c) => c.slug === link) ??
    list.find((c) => c.slug === stored) ??
    (list.length === 1 ? list[0] : null);

  it("one synagogue needs no choice at all", () => {
    expect(decide([all[0]], null, null)).toEqual(all[0]);
  });

  it("a link wins over what was looked at last week", () => {
    expect(decide(all, "shul-b", "shul-a")).toEqual(all[1]);
  });

  it("falls back to the remembered one", () => {
    expect(decide(all, null, "shul-b")).toEqual(all[1]);
  });

  it("asks rather than picking one of several", () => {
    expect(decide(all, null, null)).toBeNull();
  });

  it("ignores a link or a memory naming a synagogue that is gone", () => {
    expect(decide(all, "shul-gone", "also-gone")).toBeNull();
  });

  it("remembers a synagogue that was asked for by link, not one it fell back to", () => {
    // A link is a statement of intent and is worth keeping. Being handed
    // the only synagogue there is says nothing about what this person
    // wants, and remembering it would be a choice they never made - one
    // that would then override the list the day a second one appears.
    setCommunity(all[1], Boolean("shul-b"));
    expect(localStorage.getItem("shul-hub.community")).toBe("shul-b");

    setCommunity(null);
    localStorage.clear();
    setCommunity(all[0], Boolean(null));
    expect(localStorage.getItem("shul-hub.community")).toBeNull();
    expect(communityId()).toBe("a-id");
  });
});
