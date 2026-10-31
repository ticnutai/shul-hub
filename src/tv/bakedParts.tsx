import { useEffect, useLayoutEffect, useReducer, useRef } from "react";
import type { BoardElement } from "./elements";

/**
 * The pictures of a board of parts, painted once for the screen.
 *
 * A kit cut from one painting (the sapphire wall at אפי קפיטל: the wall, its
 * columns, arches, clock and crown) is up to twenty pieces of the same
 * picture, each laid where it belongs so the gabbai can move it. On the TV
 * box every piece drew the whole painting again - enlarged, masked, cut to
 * its corner - and a page of it took about five times as long to come up as
 * a page with one picture (measured 31.10.2026).
 *
 * Here the pieces that follow one another, with nothing live between them,
 * are drawn once - by the browser itself, from the same marks the board uses
 * (an SVG of them, ElementArt's) - into one canvas, and the canvas stands in
 * their place: the same pixels, one layer. The times and texts stay live and
 * where they were, above and below. Only on a screen (`setPartBaking`, from
 * the TV app); the editor keeps the pieces, to be taken and moved.
 */

let baking = false;
/** Turned on by the TV app only. */
export function setPartBaking(on: boolean) {
  baking = on;
}

/** The board as pixels, for the painting: a TV's size; the paintings are no finer than this. */
const BOARD_W = 1920;
const BOARD_H = 1080;

/** A piece of picture that draws the same every time: no filter, no turn, nothing from the day. */
export function bakeable(e: BoardElement): boolean {
  if (e.kind !== "image" || !e.image || e.hidden || e.imageTune || e.backdrop || e.shape) return false;
  if (e.rotation) return false;
  if (e.crop && e.symbol) return false;
  return true;
}

/** Pieces in a row with nothing between them, two or more: each row painted as one. */
export function bakeableRuns(elements: BoardElement[]): BoardElement[][] {
  const runs: BoardElement[][] = [];
  let run: BoardElement[] = [];
  const close = () => {
    if (run.length > 1) runs.push(run);
    run = [];
  };
  for (const e of elements) {
    if (e.hidden) continue;
    if (bakeable(e)) run.push(e);
    else close();
  }
  close();
  return runs;
}

const r2 = (n: number) => Math.round(n * 1000) / 1000;

/** Everything that decides the row's pixels. */
export function runKey(run: BoardElement[]): string {
  return JSON.stringify(run.map((e) => [e.image, r2(e.x), r2(e.y), r2(e.width), r2(e.height), e.crop, e.sourceMask, e.fit, e.opacity]));
}

/** Where the row stands on the board, in its percent. */
export function runBox(run: BoardElement[]) {
  const x0 = Math.max(0, Math.min(...run.map((e) => e.x)));
  const y0 = Math.max(0, Math.min(...run.map((e) => e.y)));
  const x1 = Math.min(100, Math.max(...run.map((e) => e.x + e.width)));
  const y1 = Math.min(100, Math.max(...run.map((e) => e.y + e.height)));
  return { x: x0, y: y0, width: Math.max(0.1, x1 - x0), height: Math.max(0.1, y1 - y0) };
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** One piece, as ElementArt draws it, in the board's pixels. */
function pieceSvg(e: BoardElement, href: string, i: number): string {
  const x = (e.x * BOARD_W) / 100, y = (e.y * BOARD_H) / 100, w = (e.width * BOARD_W) / 100, h = (e.height * BOARD_H) / 100;
  const box = `x="${x}" y="${y}" width="${w}" height="${h}"`;
  const opacity = e.opacity ?? 1;
  let inner: string;
  if (e.sourceMask) {
    const m = e.sourceMask, c = e.crop ?? { x: 0, y: 0, width: 100, height: 100 };
    const id = `m${i}`;
    inner = `<svg ${box} viewBox="${(c.x * m.width) / 100} ${(c.y * m.height) / 100} ${(c.width * m.width) / 100} ${(c.height * m.height) / 100}" preserveAspectRatio="none">`
      + `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${m.width}" height="${m.height}" style="mask-type:luminance">`
      + `<path d="${attr(m.path)}" fill="white" shape-rendering="crispEdges"/>`
      + m.holes.map((d) => `<path d="${attr(d)}" fill="black" shape-rendering="crispEdges"/>`).join("")
      + `</mask></defs><image href="${href}" width="${m.width}" height="${m.height}" preserveAspectRatio="none" mask="url(#${id})"/></svg>`;
  } else if (e.crop) {
    const c = e.crop;
    inner = `<svg ${box} viewBox="${c.x} ${c.y} ${c.width} ${c.height}" preserveAspectRatio="none"><image href="${href}" width="100" height="100" preserveAspectRatio="none"/></svg>`;
  } else {
    inner = `<svg ${box}><image href="${href}" width="100%" height="100%" preserveAspectRatio="xMidYMid ${e.fit === "cover" ? "slice" : "meet"}"/></svg>`;
  }
  return opacity < 1 ? `<g opacity="${opacity}">${inner}</g>` : inner;
}

/** A picture as data, so the painting holds it (an SVG drawn as a picture fetches nothing). */
const asData = new Map<string, Promise<string>>();
function dataUrl(url: string): Promise<string> {
  let p = asData.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((b) => new Promise<string>((done, fail) => {
        const fr = new FileReader();
        fr.onload = () => done(String(fr.result));
        fr.onerror = () => fail(fr.error);
        fr.readAsDataURL(b);
      }));
    p.catch(() => asData.delete(url));
    asData.set(url, p);
  }
  return p;
}

/** The rows painted, by key; a few, the last used kept. */
const painted = new Map<string, Promise<HTMLCanvasElement | null>>();
const ready = new Map<string, HTMLCanvasElement>();
const KEEP = 12;

function paint(run: BoardElement[], key: string): Promise<HTMLCanvasElement | null> {
  let p = painted.get(key);
  if (p) return p;
  p = (async () => {
    try {
      const urls = [...new Set(run.map((e) => e.image!))];
      const data = new Map(await Promise.all(urls.map(async (u) => [u, await dataUrl(u)] as const)));
      const b = runBox(run);
      const bx = (b.x * BOARD_W) / 100, by = (b.y * BOARD_H) / 100, bw = (b.width * BOARD_W) / 100, bh = (b.height * BOARD_H) / 100;
      const cw = Math.max(1, Math.ceil(bw)), ch = Math.max(1, Math.ceil(bh));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="none">`
        + run.map((e, i) => pieceSvg(e, data.get(e.image!)!, i)).join("") + `</svg>`;
      const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        const img = new Image();
        img.src = blobUrl;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, cw, ch);
        ready.set(key, canvas);
        while (ready.size > KEEP) {
          const oldest = ready.keys().next().value as string;
          ready.delete(oldest);
          painted.delete(oldest);
        }
        return canvas;
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      // A picture that cannot be fetched: its pieces stay as they are.
      return null;
    }
  })();
  painted.set(key, p);
  return p;
}

/** The rows of these parts that are painted and ready, by their first part. */
export function useBakedParts(elements: BoardElement[], on: boolean) {
  const [, again] = useReducer((n: number) => n + 1, 0);
  const runs = on && baking ? bakeableRuns(elements) : [];
  const keys = runs.map(runKey);
  const joined = keys.join("\n");
  useEffect(() => {
    if (!joined) return;
    let live = true;
    joined.split("\n").forEach((key, i) => {
      if (ready.has(key)) return;
      void paint(runs[i], key).then((c) => live && c && again());
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  const byFirst = new Map<string, { run: BoardElement[]; canvas: HTMLCanvasElement }>();
  runs.forEach((run, i) => {
    const canvas = ready.get(keys[i]);
    if (canvas) byFirst.set(run[0].id, { run, canvas });
  });
  return byFirst;
}

/** A painted row in its place: drawn before the frame is shown, so it is never seen empty. */
export function BakedRun({ run, source }: { run: BoardElement[]; source: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = source.width;
    c.height = source.height;
    ctx.drawImage(source, 0, 0);
  }, [source]);
  const b = runBox(run);
  return (
    <canvas
      ref={ref}
      data-baked-parts={run.map((e) => e.id).join(" ")}
      data-baked-pictures={[...new Set(run.map((e) => e.image))].join(" ")}
      aria-hidden
      style={{ position: "absolute", left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%`, pointerEvents: "none", display: "block" }}
    />
  );
}
