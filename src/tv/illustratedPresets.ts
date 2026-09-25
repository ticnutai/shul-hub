import type { IllustratedStyle } from "./config";

/**
 * Ready palettes for a painted board ("עיצובים מוכנים"): each sets the
 * picture's colour, the stones, the frames and - on the dark ones - light
 * text, so the times stay readable. One tap, then fine-tune by hand.
 * The frames' shape (rectangle / arch) is left as the admin chose it.
 */
export type IllustratedPreset = {
  id: string;
  name: string;
  /** Two swatch colours for the button: the stones and the frames. */
  swatch: [string, string];
  style: Omit<IllustratedStyle, "scale" | "rows" | "frameShape">;
};

const base = {
  brightness: 1,
  saturation: 1,
  hue: 0,
  stoneTint: null,
  stoneTintStrength: 0.35,
  frameFill: null,
  frameFillOpacity: 0.5,
  frameDepth: 0,
  frameLine: null,
  frameLineWidth: 2,
  ink: null,
  accent: null,
  clockInk: null,
} satisfies IllustratedPreset["style"];

const p = (id: string, name: string, swatch: [string, string], s: Partial<IllustratedPreset["style"]>): IllustratedPreset => ({
  id,
  name,
  swatch,
  style: { ...base, ...s },
});

export const ILLUSTRATED_PRESETS: IllustratedPreset[] = [
  p("original", "כמו בציור", ["#d9b77e", "#f3e4c4"], {}),
  p("grey", "אבן אפורה", ["#7d7f82", "#eceae6"], {
    saturation: 0.35, stoneTint: "#7d7f82", stoneTintStrength: 0.5, frameFill: "#eceae6", frameFillOpacity: 0.55,
    frameLine: "#8b8d90", frameLineWidth: 1.5, frameDepth: 0.5, ink: "#2b2d30", accent: "#55585d", clockInk: "#2b2d30",
  }),
  p("silver", "אפור כסוף", ["#55595e", "#eff0f1"], {
    brightness: 0.85, saturation: 0.15, stoneTint: "#55595e", stoneTintStrength: 0.5, frameFill: "#eff0f1", frameFillOpacity: 0.6,
    frameLine: "#8d9299", frameLineWidth: 2, frameDepth: 0.6, ink: "#25282c", accent: "#4b5058", clockInk: "#25282c",
  }),
  p("mocha", "מוקה", ["#6f4e37", "#efe2d2"], {
    brightness: 0.92, stoneTint: "#6f4e37", stoneTintStrength: 0.55, frameFill: "#efe2d2", frameFillOpacity: 0.55,
    frameLine: "#8a6a4f", frameLineWidth: 2, frameDepth: 0.5, ink: "#3b2a1e", accent: "#6f4e37", clockInk: "#3b2a1e",
  }),
  p("latte", "לאטה", ["#a88a6c", "#f6eee4"], {
    saturation: 0.7, stoneTint: "#a88a6c", stoneTintStrength: 0.45, frameFill: "#f6eee4", frameFillOpacity: 0.6,
    frameLine: "#a88a6c", frameLineWidth: 1.5, frameDepth: 0.4, ink: "#3d2f22", accent: "#7a5c3e", clockInk: "#3d2f22",
  }),
  p("chocolate", "שוקולד כהה", ["#4a3226", "#2f2119"], {
    brightness: 0.75, stoneTint: "#4a3226", stoneTintStrength: 0.6, frameFill: "#2f2119", frameFillOpacity: 0.78,
    frameLine: "#c9a26b", frameLineWidth: 2, frameDepth: 0.7, ink: "#f3e6d3", accent: "#e0b574", clockInk: "#f3e6d3",
  }),
  p("charcoal", "פחם", ["#3a3d42", "#1f2226"], {
    brightness: 0.7, saturation: 0.2, stoneTint: "#3a3d42", stoneTintStrength: 0.6, frameFill: "#1f2226", frameFillOpacity: 0.78,
    frameLine: "#b8bcc4", frameLineWidth: 1.5, frameDepth: 0.7, ink: "#eef0f3", accent: "#d8c38f", clockInk: "#eef0f3",
  }),
  p("night", "כחול לילה", ["#24345a", "#16203a"], {
    brightness: 0.75, stoneTint: "#24345a", stoneTintStrength: 0.55, frameFill: "#16203a", frameFillOpacity: 0.78,
    frameLine: "#d4b366", frameLineWidth: 2, frameDepth: 0.7, ink: "#eef2ff", accent: "#f0cf73", clockInk: "#f5e6b8",
  }),
  p("marble", "שיש לבן", ["#d9d6d0", "#ffffff"], {
    brightness: 1.12, saturation: 0.25, stoneTint: "#d9d6d0", stoneTintStrength: 0.4, frameFill: "#ffffff", frameFillOpacity: 0.65,
    frameLine: "#b9b4aa", frameLineWidth: 1.5, frameDepth: 0.4, ink: "#2a2a2a", accent: "#7a6a4a", clockInk: "#2a2a2a",
  }),
  p("jerusalem", "אבן ירושלמית חמה", ["#d7a85e", "#fff4dc"], {
    saturation: 1.15, stoneTint: "#d7a85e", stoneTintStrength: 0.3, frameFill: "#fff4dc", frameFillOpacity: 0.45,
    frameLine: "#b8912f", frameLineWidth: 2, frameDepth: 0.5, ink: "#3a2a12", accent: "#8a5d12", clockInk: "#3a2a12",
  }),
  p("olive", "זית", ["#6b6b3a", "#f1efdc"], {
    brightness: 0.9, stoneTint: "#6b6b3a", stoneTintStrength: 0.45, frameFill: "#f1efdc", frameFillOpacity: 0.55,
    frameLine: "#7b7a45", frameLineWidth: 2, frameDepth: 0.5, ink: "#2f2f18", accent: "#5e5d2c", clockInk: "#2f2f18",
  }),
  p("terracotta", "טרקוטה", ["#9a5b3c", "#f5e8dc"], {
    stoneTint: "#9a5b3c", stoneTintStrength: 0.45, frameFill: "#f5e8dc", frameFillOpacity: 0.55,
    frameLine: "#9a5b3c", frameLineWidth: 2, frameDepth: 0.5, ink: "#3b2016", accent: "#8a4a2b", clockInk: "#3b2016",
  }),
  p("bordeaux", "בורדו", ["#5e1f2b", "#f7ece6"], {
    brightness: 0.85, stoneTint: "#5e1f2b", stoneTintStrength: 0.5, frameFill: "#f7ece6", frameFillOpacity: 0.6,
    frameLine: "#8c3a44", frameLineWidth: 2, frameDepth: 0.6, ink: "#3a141b", accent: "#7a1f2b", clockInk: "#3a141b",
  }),
];
