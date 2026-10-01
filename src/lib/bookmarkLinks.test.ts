import { describe, expect, it } from "vitest";

import { bookmarkHref, bookmarkLabel, parseTehillimBookmark, tehillimBookmarkId } from "./bookmarkLinks";

describe("where a bookmark leads", () => {
  it("a Tehillim bookmark opens the Siddur on Tehillim, at its chapter and verse", () => {
    expect(bookmarkHref(tehillimBookmarkId(23, 4))).toBe("/siddur?tab=tehillim&perek=23&pasuk=4");
    expect(bookmarkHref(tehillimBookmarkId(119, null))).toBe("/siddur?tab=tehillim&perek=119");
  });

  it("a Chumash bookmark opens the Chumash, as it did in the bookmarks dialog", () => {
    expect(bookmarkHref("bereishit-1-1")).toBe("/chumash?sefer=bereishit&perek=1&pasuk=1");
    expect(bookmarkHref("1-2-3")).toBe("/chumash?sefer=1&perek=2&pasuk=3");
  });

  it("a commentary id opens its page; anything else leads nowhere", () => {
    expect(bookmarkHref("1:2:3")).toBe("/commentaries/1/2/3");
    expect(bookmarkHref("nonsense")).toBeNull();
  });

  it("refuses a chapter Tehillim does not have", () => {
    expect(parseTehillimBookmark("tehillim-151-1")).toBeNull();
    expect(parseTehillimBookmark("tehillim-0-1")).toBeNull();
  });

  it("names a Tehillim bookmark in words", () => {
    expect(bookmarkLabel("tehillim-23-4")).toBe("תהילים פרק 23, פסוק 4");
    expect(bookmarkLabel("tehillim-1-0")).toBe("תהילים פרק 1");
    expect(bookmarkLabel("bereishit-1-1")).toBe("bereishit-1-1");
  });
});
