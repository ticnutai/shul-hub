/**
 * LayoutOverlay — floats on top of the REAL page
 *
 * Activated with Ctrl+Shift+L (or the floating ⚙ button).
 * Scans for all [data-layout] elements, draws coloured borders + drag handles
 * around them, and lets you reposition them via drag.
 *
 * "Copy layout" exports a text block you can paste back to Copilot.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface Zone {
  id: string;
  label: string;
  el: HTMLElement;
  rect: DOMRect;
  dx: number;
  dy: number;
  category: string;
}

/* ── Category definitions ───────────────────────────────────────────── */
interface CategoryDef {
  name: string;        // Hebrew display name
  color: string;       // Main color for the category
  icon: string;        // Emoji icon
}

const CATEGORIES: Record<string, CategoryDef> = {
  "header":   { name: "כותרת",        color: "#1e40af", icon: "📌" },  // blue-800
  "toolbar":  { name: "שורת כלים",     color: "#d97706", icon: "🔧" },  // amber-600
  "nav":      { name: "ניווט",         color: "#7c3aed", icon: "🧭" },  // violet-600
  "content":  { name: "תוכן",         color: "#dc2626", icon: "📄" },  // red-600
  "floating": { name: "אלמנטים צפים",  color: "#0891b2", icon: "🎈" },  // cyan-600
  "panels":   { name: "פאנלים",       color: "#059669", icon: "📋" },  // emerald-600
  "buttons":  { name: "כפתורים בודדים", color: "#6366f1", icon: "🔘" },  // indigo-500
  "dialogs":  { name: "דיאלוגים",      color: "#be185d", icon: "📦" },  // pink-700
};

/* Map each data-layout ID → category key */
const ZONE_CATEGORY: Record<string, string> = {
  // Header
  "header":                "header",
  "header-actions-mobile": "header",
  "header-actions-desktop":"header",
  // Toolbar
  "desktop-controls":      "toolbar",
  "mobile-controls":       "toolbar",
  // Navigation
  "sefer-selector":        "nav",
  "quick-selector":        "nav",
  "parsha-pasuk-nav":      "nav",
  "reading-progress":      "nav",
  // Content
  "verse-cards":           "content",
  // Floating
  "floating-fab":          "floating",
  "floating-settings":     "floating",
  "share-bar":             "floating",
  // Panels
  "side-panel-trigger":    "panels",
  "side-panel":            "panels",
  // Individual buttons
  "btn-calendar":          "buttons",
  "btn-sync":              "buttons",
  "btn-text-settings":     "buttons",
  "btn-selection":         "buttons",
  "btn-search":            "buttons",
  "btn-user":              "buttons",
  "btn-view-mode":         "buttons",
  "btn-user-content":      "buttons",
  "btn-commentary":        "buttons",
  "btn-minimize":          "buttons",
  // Dialogs
  "dialog-settings":       "dialogs",
  "dialog-text-display":   "dialogs",
  "dialog-search":         "dialogs",
  "dialog-bookmarks":      "dialogs",
  "dialog-notes":          "dialogs",
  "dialog-commentary":     "dialogs",
};

/* Per-zone shade offsets (lighter variants within category) */
const ZONE_COLOR_OFFSET: Record<string, string> = {
  "header":                "#1e3a8a",
  "header-actions-mobile": "#2563eb",
  "header-actions-desktop":"#3b82f6",
  "desktop-controls":      "#d97706",
  "mobile-controls":       "#f59e0b",
  "sefer-selector":        "#7c3aed",
  "quick-selector":        "#10b981",
  "parsha-pasuk-nav":      "#8b5cf6",
  "reading-progress":      "#ec4899",
  "verse-cards":           "#ef4444",
  "floating-fab":          "#06b6d4",
  "floating-settings":     "#14b8a6",
  "share-bar":             "#f97316",
  "side-panel-trigger":    "#059669",
  "side-panel":            "#10b981",
  "btn-calendar":          "#818cf8",
  "btn-sync":              "#a78bfa",
  "btn-text-settings":     "#c084fc",
  "btn-selection":         "#e879f9",
  "btn-search":            "#f472b6",
  "btn-user":              "#fb923c",
  "btn-view-mode":         "#fbbf24",
  "btn-user-content":      "#a3e635",
  "btn-commentary":        "#34d399",
  "btn-minimize":          "#22d3ee",
  // Dialogs
  "dialog-settings":       "#be185d",
  "dialog-text-display":   "#db2777",
  "dialog-search":         "#e11d48",
  "dialog-bookmarks":      "#f43f5e",
  "dialog-notes":          "#fb7185",
  "dialog-commentary":     "#fda4af",
};

function getZoneColor(id: string): string {
  return ZONE_COLOR_OFFSET[id] || CATEGORIES[ZONE_CATEGORY[id]]?.color || "#ec4899";
}

function getZoneCategory(id: string): string {
  return ZONE_CATEGORY[id] || "content";
}

/* Is this zone a small button? */
function isSmallZone(id: string): boolean {
  return id.startsWith("btn-");
}

/* Is this zone a dialog? Needs higher z-index for overlay */
function isDialogZone(id: string): boolean {
  return id.startsWith("dialog-");
}

export const LayoutOverlay = () => {
  const [active, setActive]   = useState(false);
  const [zones,  setZones]    = useState<Zone[]>([]);
  const [copied, setCopied]   = useState(false);
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());
  const [legendOpen, setLegendOpen] = useState(true);
  const [devVisible, setDevVisible] = useState(() => {
    try {
      const floatingEnabled = localStorage.getItem("dev-floating-buttons-enabled") !== "false";
      const layoutEditorRaw = localStorage.getItem("dev-layout-editor-enabled");
      const layoutEditorEnabled = layoutEditorRaw === null ? false : layoutEditorRaw === "true";
      return floatingEnabled && layoutEditorEnabled;
    } catch {
      return false;
    }
  });
  const isSmallViewport = typeof window !== "undefined" && window.innerWidth < 768;
  const dragRef = useRef<{
    zoneId: string; startX: number; startY: number; origDx: number; origDy: number;
  } | null>(null);

  // ── Listen for dev-features toggle changes ───────────────────────
  useEffect(() => {
    const handler = () => {
      try {
        const floatingEnabled = localStorage.getItem("dev-floating-buttons-enabled") !== "false";
        const layoutEditorRaw = localStorage.getItem("dev-layout-editor-enabled");
        const layoutEditorEnabled = layoutEditorRaw === null ? false : layoutEditorRaw === "true";
        setDevVisible(floatingEnabled && layoutEditorEnabled);
      } catch {
        // ignore
      }
    };
    window.addEventListener("dev-features:changed", handler);
    return () => window.removeEventListener("dev-features:changed", handler);
  }, []);

  // ── Keyboard shortcut: Ctrl+Shift+L ──────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setActive(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Scan DOM for data-layout zones ───────────────────────────────
  const scan = useCallback(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-layout]");
    const found: Zone[] = [];
    els.forEach(el => {
      const id    = el.getAttribute("data-layout")!;
      const label = el.getAttribute("data-layout-label") || id;
      const rect  = el.getBoundingClientRect();
      const category = getZoneCategory(id);
      // Preserve existing offsets
      const existing = zones.find(z => z.id === id);
      found.push({ id, label, el, rect, dx: existing?.dx || 0, dy: existing?.dy || 0, category });
    });
    setZones(found);
  }, [zones]);

  useEffect(() => {
    if (active) {
      scan();
      const onScroll = () => scan();
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);

      // MutationObserver to auto-rescan when dialogs/portals appear
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of Array.from(m.addedNodes)) {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute("data-layout") || node.querySelector?.("[data-layout]")) {
                scan();
                return;
              }
            }
          }
          for (const node of Array.from(m.removedNodes)) {
            if (node instanceof HTMLElement) {
              if (node.hasAttribute("data-layout") || node.querySelector?.("[data-layout]")) {
                scan();
                return;
              }
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onScroll);
        observer.disconnect();
      };
    } else {
      zones.forEach(z => {
        z.el.style.transform  = "";
        z.el.style.transition = "";
        z.el.style.zIndex     = "";
        z.el.style.position   = "";
      });
      setZones([]);
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply CSS transforms ─────────────────────────────────────────
  useEffect(() => {
    zones.forEach(z => {
      if (hiddenCats.has(z.category)) return;
      z.el.style.position  = "relative";
      z.el.style.transform = z.dx !== 0 || z.dy !== 0 ? `translate(${z.dx}px, ${z.dy}px)` : "";
      z.el.style.transition = "none";
      z.el.style.zIndex    = z.dx !== 0 || z.dy !== 0 ? "99999" : "";
    });
  }, [zones, hiddenCats]);

  // ── Drag handlers ────────────────────────────────────────────────
  const startDrag = (e: React.PointerEvent, z: Zone) => {
    dragRef.current = { zoneId: z.id, startX: e.clientX, startY: e.clientY, origDx: z.dx, origDy: z.dy };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = d.origDx + (e.clientX - d.startX);
    const dy = d.origDy + (e.clientY - d.startY);
    setZones(prev => prev.map(z => z.id === d.zoneId ? { ...z, dx, dy } : z));
  }, []);

  const onUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [active, onMove, onUp]);

  // ── Reset ────────────────────────────────────────────────────────
  const reset = () => {
    setZones(prev => prev.map(z => {
      z.el.style.transform = "";
      return { ...z, dx: 0, dy: 0 };
    }));
  };

  // ── Toggle category visibility ───────────────────────────────────
  const toggleCat = (cat: string) => {
    setHiddenCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // ── Copy layout ──────────────────────────────────────────────────
  const copyLayout = () => {
    const moved = zones.filter(z => z.dx !== 0 || z.dy !== 0);
    const catGroups = new Map<string, Zone[]>();
    zones.forEach(z => {
      const cat = z.category;
      if (!catGroups.has(cat)) catGroups.set(cat, []);
      catGroups.get(cat)!.push(z);
    });

    let txt = `== פריסה חדשה (שלח לקופילוט) ==\n`;
    txt += `viewport: ${window.innerWidth}×${window.innerHeight}\n`;
    txt += `סה"כ אזורים: ${zones.length} | הוזזו: ${moved.length}\n\n`;

    for (const [catKey, catZones] of catGroups) {
      const catDef = CATEGORIES[catKey];
      txt += `── ${catDef?.icon || "📦"} ${catDef?.name || catKey} ──\n`;
      for (const z of catZones) {
        const movedMark = (z.dx !== 0 || z.dy !== 0) ? ` ← הוזז! dx=${z.dx} dy=${z.dy}` : "";
        txt += `  ${z.label} (${z.id}): top=${Math.round(z.rect.top)} left=${Math.round(z.rect.left)} w=${Math.round(z.rect.width)} h=${Math.round(z.rect.height)}${movedMark}\n`;
      }
      txt += "\n";
    }

    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  if (!active) {
    if (isSmallViewport || !devVisible) return null;
    return createPortal(
      <button
        onClick={() => setActive(true)}
        title="Layout Editor (Ctrl+Shift+L)"
        style={{
          position: "fixed", bottom: 72, left: 16, zIndex: 99999,
          width: 44, height: 44, borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff", border: "2px solid rgba(255,255,255,0.3)",
          fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
          transition: "transform 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.15)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "")}
      >
        ⚙
      </button>,
      document.body,
    );
  }

  // Count per category
  const catCounts: Record<string, number> = {};
  zones.forEach(z => { catCounts[z.category] = (catCounts[z.category] || 0) + 1; });

  // ── Active overlay ───────────────────────────────────────────────
  return createPortal(
    <>
      {/* ── Toolbar ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100001,
        background: "rgba(15,23,42,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "2px solid #6366f1", padding: "6px 16px",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#e2e8f0",
        direction: "rtl",
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#a5b4fc" }}>🎨 מצב עריכת פריסה</span>
        <span style={{ color: "#475569" }}>|</span>
        <span style={{ color: "#94a3b8", fontSize: 11 }}>
          {zones.length} אזורים • {zones.filter(z => z.dx !== 0 || z.dy !== 0).length} הוזזו
        </span>

        <div style={{ flex: 1 }} />

        <span style={{ color: "#64748b", fontSize: 11 }}>Ctrl+Shift+L לסגירה</span>
        <button onClick={() => setLegendOpen(p => !p)} style={tbtn("#6366f1")}>
          {legendOpen ? "◀ הסתר מקרא" : "▶ הצג מקרא"}
        </button>
        <button onClick={reset} style={tbtn("#64748b")}>↺ איפוס</button>
        <button onClick={() => scan()} style={tbtn("#6366f1")}>⟳ סריקה</button>
        <button onClick={copyLayout} style={tbtn(copied ? "#16a34a" : "#3b82f6")}>
          {copied ? "✓ הועתק!" : "📋 העתק פריסה"}
        </button>
        <button onClick={() => setActive(false)} style={tbtn("#ef4444")}>✕ סגור</button>
      </div>

      {/* ── Legend / Filter Panel ── */}
      {legendOpen && (
        <div style={{
          position: "fixed", top: 44, right: 8, zIndex: 100001,
          background: "rgba(15,23,42,0.95)", backdropFilter: "blur(12px)",
          border: "1px solid #334155", borderRadius: 12, padding: 12,
          fontFamily: "system-ui, sans-serif", fontSize: 11, color: "#e2e8f0",
          direction: "rtl", maxHeight: "calc(100vh - 60px)", overflowY: "auto",
          minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#a5b4fc" }}>
            🗂️ מקרא קטגוריות
          </div>
          {Object.entries(CATEGORIES).map(([key, cat]) => {
            const isHidden = hiddenCats.has(key);
            const count = catCounts[key] || 0;
            if (count === 0) return null;
            return (
              <div
                key={key}
                onClick={() => toggleCat(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", margin: "2px 0", borderRadius: 6,
                  cursor: "pointer", opacity: isHidden ? 0.4 : 1,
                  background: isHidden ? "transparent" : `${cat.color}15`,
                  transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: `2px solid ${cat.color}`,
                  background: isHidden ? "transparent" : cat.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: "#fff",
                }}>
                  {!isHidden && "✓"}
                </div>
                <span>{cat.icon}</span>
                <span style={{ fontWeight: 600 }}>{cat.name}</span>
                <span style={{ color: "#64748b", marginRight: "auto" }}>({count})</span>
              </div>
            );
          })}
          <div style={{ borderTop: "1px solid #334155", marginTop: 8, paddingTop: 8, fontSize: 10, color: "#64748b" }}>
            לחץ על קטגוריה להסתרה/הצגה
          </div>
        </div>
      )}

      {/* ── Zone highlights + drag handles ── */}
      {zones.map(z => {
        if (hiddenCats.has(z.category)) return null;
        const color = getZoneColor(z.id);
        const r = z.el.getBoundingClientRect();
        const small = isSmallZone(z.id);
        const dialog = isDialogZone(z.id);
        const badgeH = small ? 18 : 24;
        const fontSize = small ? 9 : 11;
        // Dialogs are portaled at very high z-index, need even higher
        const zIdx = dialog ? 2147483640 : 100000;
        // Side handle dimensions
        const sideHandleW = small ? 16 : 24;
        const sideHandleH = Math.max(small ? 40 : 60, Math.min(r.height * 0.6, 120));
        // Extra grab margin beyond element edges (allows dragging from outside)
        const grabMargin = 40;

        return (
          <div key={z.id} style={{ position: "fixed", pointerEvents: "none", zIndex: zIdx }}>
            {/* Full-area invisible drag surface — extends BEYOND the element edges for easy grabbing */}
            <div
              onPointerDown={e => startDrag(e, z)}
              style={{
                position: "fixed",
                top: r.top - badgeH - 4 - grabMargin,
                left: r.left - 2 - grabMargin,
                width: r.width + 4 + grabMargin * 2,
                height: r.height + badgeH + 8 + grabMargin * 2,
                cursor: "grab", touchAction: "none", pointerEvents: "auto",
                borderRadius: small ? 4 : 8,
                zIndex: zIdx,
                // Transparent but clickable
                background: "transparent",
              }}
            />

            {/* Border highlight (visual only) */}
            <div style={{
              position: "fixed",
              top: r.top - 2, left: r.left - 2,
              width: r.width + 4, height: r.height + 4,
              border: `${dialog ? "3" : "2"}px ${small ? "dashed" : "solid"} ${color}`,
              borderRadius: small ? 4 : 8,
              pointerEvents: "none",
              boxShadow: `0 0 0 1px ${color}33, inset 0 0 ${small ? "4" : "12"}px ${color}15`,
            }} />

            {/* Left side drag handle */}
            <div
              onPointerDown={e => startDrag(e, z)}
              style={{
                position: "fixed",
                top: r.top + (r.height - sideHandleH) / 2,
                left: r.left - sideHandleW - 2,
                width: sideHandleW,
                height: sideHandleH,
                background: `${color}cc`,
                borderRadius: `${small ? 3 : 6}px 0 0 ${small ? 3 : 6}px`,
                cursor: "grab", touchAction: "none", pointerEvents: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `-2px 0 8px ${color}44`,
                zIndex: zIdx + 1,
                userSelect: "none",
              }}
            >
              <span style={{ writingMode: "vertical-rl", color: "#fff", fontSize: small ? 8 : 10, letterSpacing: 2, opacity: 0.8 }}>⠿⠿</span>
            </div>

            {/* Right side drag handle */}
            <div
              onPointerDown={e => startDrag(e, z)}
              style={{
                position: "fixed",
                top: r.top + (r.height - sideHandleH) / 2,
                left: r.right + 2,
                width: sideHandleW,
                height: sideHandleH,
                background: `${color}cc`,
                borderRadius: `0 ${small ? 3 : 6}px ${small ? 3 : 6}px 0`,
                cursor: "grab", touchAction: "none", pointerEvents: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `2px 0 8px ${color}44`,
                zIndex: zIdx + 1,
                userSelect: "none",
              }}
            >
              <span style={{ writingMode: "vertical-rl", color: "#fff", fontSize: small ? 8 : 10, letterSpacing: 2, opacity: 0.8 }}>⠿⠿</span>
            </div>

            {/* Top drag handle bar (label + delta) */}
            <div
              onPointerDown={e => startDrag(e, z)}
              style={{
                position: "fixed",
                top: r.top - badgeH - 4, left: r.left,
                height: badgeH,
                maxWidth: small ? 160 : undefined,
                minWidth: small ? 60 : 120,
                background: color,
                borderRadius: `${small ? 4 : 8}px ${small ? 4 : 8}px 0 0`,
                display: "flex", alignItems: "center", gap: small ? 3 : 6,
                padding: `0 ${small ? 6 : 10}px`,
                cursor: "grab", touchAction: "none", pointerEvents: "auto",
                color: "#fff", fontSize, fontWeight: 700,
                userSelect: "none", whiteSpace: "nowrap",
                boxShadow: `0 -2px 8px ${color}44`,
                opacity: small ? 0.9 : 1,
                zIndex: zIdx + 2,
              }}
            >
              <span style={{ letterSpacing: small ? 1 : 2, opacity: 0.7, fontSize: small ? 8 : 11 }}>⠿⠿</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{z.label}</span>
              {(z.dx !== 0 || z.dy !== 0) && (
                <span style={{ opacity: 0.6, fontWeight: 400, marginRight: 4, fontSize: small ? 8 : 10 }}>
                  Δ{Math.round(z.dx)},{Math.round(z.dy)}
                </span>
              )}
            </div>

            {/* Bottom drag handle bar */}
            <div
              onPointerDown={e => startDrag(e, z)}
              style={{
                position: "fixed",
                top: r.bottom + 2,
                left: r.left + (r.width - Math.min(r.width * 0.6, 200)) / 2,
                width: Math.min(r.width * 0.6, 200),
                height: small ? 10 : 14,
                background: `${color}aa`,
                borderRadius: `0 0 ${small ? 3 : 6}px ${small ? 3 : 6}px`,
                cursor: "grab", touchAction: "none", pointerEvents: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 2px 8px ${color}44`,
                zIndex: zIdx + 1,
                userSelect: "none",
              }}
            >
              <span style={{ color: "#fff", fontSize: small ? 6 : 8, letterSpacing: 3, opacity: 0.7 }}>⠿⠿⠿</span>
            </div>
          </div>
        );
      })}
    </>,
    document.body,
  );
};

function tbtn(bg: string): React.CSSProperties {
  return {
    background: bg, color: "#fff", border: "none", borderRadius: 5,
    padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 4,
  };
}
