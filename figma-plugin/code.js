/**
 * "שלח ללוח" - takes the colours of the open Figma file to the synagogue
 * board's editor, in one click.
 *
 * Why a plugin and not the REST API: Figma's variables REST endpoint is
 * Enterprise-only, and Figma's own documentation says that on every other
 * plan you read variables from a client-side plugin. So this runs inside
 * Figma, where the variables are available on any plan, and hands the palette
 * to the board by opening its editor with the colours in the URL fragment.
 *
 * Nothing is uploaded and no key is needed: `figma.openExternal` opens the
 * admin's own browser, the fragment never reaches a server (browsers do not
 * send it), and nothing is saved until the admin presses "שמור ושדר".
 */

const MAX_COLOURS = 200;

/** Figma keeps channels as 0..1 floats. */
function toHex(paint) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, "0");
  const base = `#${c(paint.r)}${c(paint.g)}${c(paint.b)}`;
  const a = typeof paint.a === "number" ? paint.a : 1;
  return a >= 1 ? base : `${base}${c(a)}`;
}

/** Every colour in the file: its variables first, then its paint styles. */
async function collectColours() {
  const out = [];
  const seen = new Set();
  const add = (name, value) => {
    if (!name || !value || seen.has(name) || out.length >= MAX_COLOURS) return;
    seen.add(name);
    out.push({ n: name, v: value });
  };

  try {
    const variables = await figma.variables.getLocalVariablesAsync("COLOR");
    for (const variable of variables) {
      const modes = Object.values(variable.valuesByMode || {});
      const value = modes.find((m) => m && typeof m === "object" && typeof m.r === "number");
      if (value) add(variable.name, toHex(value));
    }
  } catch (e) {
    // A file with no variables, or an editor that predates them.
  }

  try {
    const styles = await figma.getLocalPaintStylesAsync();
    for (const style of styles) {
      const paint = (style.paints || []).find((p) => p.type === "SOLID" && p.visible !== false);
      if (paint) add(style.name, toHex({ ...paint.color, a: paint.opacity }));
    }
  } catch (e) {
    /* nothing to add */
  }

  return out;
}

/** UTF-8 safe base64url, so Hebrew variable names survive the trip. */
function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

figma.showUI(__html__, { width: 300, height: 260, themeColors: true });

(async () => {
  const colours = await collectColours();
  const url = (await figma.clientStorage.getAsync("boardUrl")) || "";
  figma.ui.postMessage({ type: "ready", count: colours.length, url, file: figma.root.name });
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "send") {
      await figma.clientStorage.setAsync("boardUrl", msg.url);
      if (!colours.length) {
        figma.notify("לא נמצאו צבעים בקובץ הזה");
        return;
      }
      const payload = encodePayload({ v: 1, name: figma.root.name, colors: colours });
      const base = msg.url.replace(/#.*$/, "").replace(/\/+$/, "");
      figma.openExternal(`${base}/admin/tv-board?draft=1#figma=${payload}`);
      figma.notify(`נשלחו ${colours.length} צבעים ללוח`);
    } else if (msg.type === "close") {
      figma.closePlugin();
    }
  };
})();
