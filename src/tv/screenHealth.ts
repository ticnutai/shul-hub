/**
 * What the wall actually looks like, measured on the wall.
 *
 * The admin's preview draws the same board with the same code and the same
 * fonts, and still the box at אהל אברהם showed a different picture: its text
 * was a tenth to a quarter larger than the preview's, with every frame the
 * same size, so the last zmanim hung out under their panel. The frames are
 * sized by the board; the text had been enlarged by Android - its "font size"
 * setting, which Chrome applies by boosting text (text autosizing). Nothing
 * in the preview can show that, and nobody standing in front of the wall
 * can say "the text is 1.2 times what it should be".
 *
 * So the box measures two things and says them:
 *   - `textBoost`: how much larger text is drawn than it was asked to be. The
 *     page now switches the boosting off (tv-global.css); this is how we know
 *     it took, on each box, rather than assuming it did.
 *   - `clipped`: any list or panel whose content is taller than its frame -
 *     what the gabbai would otherwise only find by photographing the wall.
 */

/**
 * Drawn size of text against the size it was asked for.
 *
 * A canvas measures text without any of the page's text boosting, so the
 * same string at the same size, measured both ways, gives the factor. 1 means
 * the wall draws text exactly as laid out.
 */
export function measureTextBoost(doc: Document = document): number | null {
  try {
    const sample = "אבגדהוזחט 0123456789";
    const canvas = doc.createElement("canvas").getContext("2d");
    if (!canvas) return null;
    canvas.font = "100px sans-serif";
    const expected = canvas.measureText(sample).width;
    if (!expected) return null;

    const probe = doc.createElement("span");
    probe.textContent = sample;
    Object.assign(probe.style, {
      position: "absolute",
      visibility: "hidden",
      whiteSpace: "nowrap",
      font: "100px sans-serif",
      left: "-9999px",
      top: "0",
    });
    // Inside the board, where the boosting would apply.
    (doc.querySelector(".tv-root") ?? doc.body).appendChild(probe);
    const drawn = probe.getBoundingClientRect().width;
    probe.remove();
    return drawn ? Math.round((drawn / expected) * 100) / 100 : null;
  } catch {
    return null;
  }
}

/** What is measured for being cut off: the lists and panels a wall shows. */
const CLIPPABLE = [
  ".tv-zman-list",
  ".tv-minyan-list",
  ".tv-timeline",
  ".tv-shiur-list",
  ".tv-card-body",
  ".tv-panel",
];

/** A name a person would recognise, for the log. */
function describe(el: Element): string {
  const panel = el.closest(".tv-panel");
  const title = panel?.querySelector(".tv-panel-title")?.textContent?.trim();
  if (title) return title;
  const heading = el.closest(".tv-slide")?.querySelector(".tv-slide-heading")?.textContent?.trim();
  return heading || el.className.toString().split(" ")[0] || "רכיב";
}

export interface Clipped {
  what: string;
  /** How much is hidden, in CSS pixels. */
  hidden: number;
  /** The last line that is cut, when there is one to name. */
  lastLine?: string;
}

/** Everything on the board whose content is taller than its frame, now. */
export function findClipped(root: ParentNode = document): Clipped[] {
  const out: Clipped[] = [];
  const seen = new Set<string>();
  // Innermost first: a list inside a panel can name the line that is cut,
  // and the panel around it then adds nothing new.
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(CLIPPABLE.join(","))).reverse()) {
    if (!el.offsetParent) continue; // not on screen
    const box = el.getBoundingClientRect();
    if (box.height < 4) continue;
    // What spills: content taller than the element, or children drawn past
    // the frame of the panel they stand in.
    const frame = (el.closest(".tv-panel") as HTMLElement | null) ?? el;
    const bottom = frame.getBoundingClientRect().bottom;
    let hidden = Math.max(0, el.scrollHeight - el.clientHeight);
    let lastLine: string | undefined;
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const b = child.getBoundingClientRect().bottom - bottom;
      if (b > 2) {
        hidden = Math.max(hidden, Math.round(b));
        // "צאת הכוכבים 18:48", not "צאת הכוכבים18:48": a row's parts are separate elements.
        const parts = Array.from(child.children).map((c) => c.textContent?.trim() ?? "").filter(Boolean);
        lastLine = (parts.length ? parts.join(" ") : child.textContent?.trim() ?? "").replace(/\s+/g, " ").slice(0, 40);
      }
    }
    if (hidden <= 2) continue;
    const what = describe(el);
    if (seen.has(what)) continue;
    seen.add(what);
    out.push({ what, hidden: Math.round(hidden), lastLine });
  }
  return out;
}
