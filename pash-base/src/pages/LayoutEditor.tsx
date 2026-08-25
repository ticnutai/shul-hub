/**
 * Layout Editor v5 — REAL screenshot as pixel-perfect background canvas
 *
 * Before editing:  node scripts/capture-bg.mjs   (updates public/layout-bg.png)
 * Then open:       http://localhost:5001/layout-editor
 */
import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronLeft, User, BookOpen, RefreshCw, Copy, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeferSelector } from "@/components/SeferSelector";
import { ViewModeToggle } from "@/components/ViewModeToggle";
import { MinimizeButton } from "@/components/MinimizeButton";
import { PasukSimpleNavigator } from "@/components/PasukSimpleNavigator";
import { QuickSelector } from "@/components/QuickSelector";
import { Sefer, FlatPasuk } from "@/types/torah";

// ─── Canvas size — must match scripts/capture-bg.mjs W×H ───────────────────
const CW = 1400;
const CH = 900;

// ─── Mock sefer data ─────────────────────────────────────────────────────────
const MOCK_SEFER: Sefer = {
  sefer_id: 2, sefer_name: "שמות", english_name: "Exodus",
  parshiot: [
    {
      parsha_id: 18, parsha_name: "תצוה",
      perakim: [
        { perek_num: 27, pesukim: Array.from({ length: 21 }, (_, i) => ({ id: 2700 + i + 1, pasuk_num: i + 1, text: i === 0 ? "וְעָשִׂיתָ אֶת־הַמִּזְבֵּחַ עֲצֵי שִׁטִּים חָמֵשׁ אַמּוֹת אֹרֶךְ:" : `פסוק ${i + 1}`, content: [] })) },
        { perek_num: 28, pesukim: Array.from({ length: 43 }, (_, i) => ({ id: 2800 + i + 1, pasuk_num: i + 1, text: `פסוק ${i + 1}`, content: [] })) },
      ],
    },
    {
      parsha_id: 19, parsha_name: "כי תשא",
      perakim: [
        { perek_num: 30, pesukim: Array.from({ length: 16 }, (_, i) => ({ id: 3100 + i, pasuk_num: i + 1, text: `פסוק ${i + 1}`, content: [] })) },
      ],
    },
  ],
};

const MOCK_FLAT: FlatPasuk[] = MOCK_SEFER.parshiot[0].perakim[0].pesukim.map(p => ({
  id: p.id, sefer: 2, sefer_name: "שמות", perek: 27, pasuk_num: p.pasuk_num,
  text: p.text, content: p.content, parsha_id: 18, parsha_name: "תצוה",
}));

// ─── Draggable block types ────────────────────────────────────────────────────
type BlockId = "sefer-selector" | "desktop-controls" | "parsha-nav" | "pasuk-nav" | "quick-selector";

interface Block { id: BlockId; x: number; y: number; label: string; }

// Initial positions measured from the real page screenshot (1400×900)
// Container starts at ~x=60 (Tailwind xl container centred in 1400px)
// Header height ≈ 88px, container py-8 = 32px → content starts at y≈120
const INITIAL: Block[] = [
  { id: "sefer-selector",   x: 60,   y: 118, label: "בורר חומש / פרשה / פסוק" },
  { id: "desktop-controls", x: 60,   y: 304, label: "שורת כלים" },
  { id: "quick-selector",   x: 1000, y: 356, label: "בחירה מהירה (סרגל צד)" },
  { id: "parsha-nav",       x: 60,   y: 356, label: "ניווט פרשה" },
  { id: "pasuk-nav",        x: 60,   y: 408, label: "ניווט פסוקים" },
];

// ─── Component ───────────────────────────────────────────────────────────────
export const LayoutEditor = () => {
  const [blocks,   setBlocks]   = useState<Block[]>(INITIAL);
  const [selected, setSelected] = useState<BlockId | null>(null);
  const [copied,   setCopied]   = useState(false);
  const [snap,     setSnap]     = useState(true);
  const [bgOpacity, setBgOpacity] = useState(100);  // 0–100
  const [showHelp,  setShowHelp]  = useState(false);

  const [selectedParsha, setSelectedParsha] = useState<number | null>(18);
  const [selectedPerek,  setSelectedPerek]  = useState<number | null>(27);
  const [selectedPasuk,  setSelectedPasuk]  = useState<number | null>(1);
  const [globalMin,      setGlobalMin]      = useState(false);

  const drag = useRef<{ id: BlockId; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const snap10 = useCallback((v: number) => snap ? Math.round(v / 10) * 10 : Math.round(v), [snap]);

  const startDrag = (e: React.PointerEvent, id: BlockId) => {
    const b = blocks.find(x => x.id === id)!;
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(id);
    e.stopPropagation();
    e.preventDefault();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const { id, sx, sy, ox, oy } = drag.current;
    setBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, x: snap10(ox + e.clientX - sx), y: snap10(oy + e.clientY - sy) } : b
    ));
  };

  const onUp = () => { drag.current = null; };

  const reset = () => { setBlocks(INITIAL.map(b => ({ ...b }))); setSelected(null); };

  const copyLayout = () => {
    const lines = blocks.map(b => `${b.label}:\n  x=${b.x}  y=${b.y}`).join("\n\n");
    const txt = `== פריסה נוכחית (שלח לקופילוט לביצוע) ==\n\n${lines}\n\nמידות canvas: ${CW}×${CH}`;
    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const get = (id: BlockId) => blocks.find(b => b.id === id)!;

  // ── Draggable wrapper — drag handle at top, content below ─────────────────
  const wrap = (id: BlockId, content: React.ReactNode) => {
    const b   = get(id);
    const sel = selected === id;
    return (
      <div
        key={id}
        style={{
          position: "absolute", left: b.x, top: b.y, zIndex: sel ? 20 : 2,
          outline: sel ? "2px solid #3b82f6" : "1.5px dashed rgba(148,163,184,0.6)",
          outlineOffset: 3, borderRadius: 10,
        }}
      >
        {/* ── Drag handle bar ── */}
        <div
          onPointerDown={e => startDrag(e, id)}
          style={{
            height: 24, background: sel ? "#3b82f6" : "#334155",
            borderRadius: "8px 8px 0 0", cursor: "grab", touchAction: "none",
            display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
            userSelect: "none", color: "#fff", fontSize: 11, fontWeight: 700,
          }}
        >
          <span style={{ letterSpacing: 2, opacity: 0.7 }}>⠿⠿</span>
          <span>{b.label}</span>
          <span style={{ marginRight: "auto", opacity: 0.5, fontWeight: 400 }}>
            {b.x},{b.y}
          </span>
        </div>
        {/* ── Real component ── */}
        <div dir="rtl" style={{ direction: "rtl" }}>
          {content}
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f172a", overflow: "hidden" }}>

      {/* ══ Toolbar ══════════════════════════════════════════════════════════ */}
      <div style={{
        background: "#1e293b", borderBottom: "2px solid #334155",
        color: "#f1f5f9", padding: "6px 14px",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        fontSize: 12, flexShrink: 0, zIndex: 200,
      }}>
        <Link to="/" style={{ color: "#94a3b8", textDecoration: "none" }}>← חזור</Link>
        <span style={{ color: "#475569" }}>|</span>
        <span style={{ fontWeight: 700, color: "#e2e8f0" }}>🎨 Layout Editor — גרור מה-badge האפור</span>

        <div style={{ width: 1, height: 20, background: "#334155", margin: "0 4px" }} />

        {/* Bg opacity */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", cursor: "pointer" }}>
          <span>רקע:</span>
          <input type="range" min={0} max={100} value={bgOpacity}
            onChange={e => setBgOpacity(+e.target.value)}
            style={{ width: 80 }} />
          <span style={{ width: 30 }}>{bgOpacity}%</span>
        </label>

        {/* Snap */}
        <label style={{ display: "flex", alignItems: "center", gap: 5, color: "#94a3b8", cursor: "pointer" }}>
          <input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />
          סנאפ 10px
        </label>

        <div style={{ flex: 1 }} />

        {/* Recapture hint */}
        <span style={{ color: "#64748b", fontSize: 11 }}>
          לרענון רקע: <code style={{ background: "#0f172a", padding: "1px 6px", borderRadius: 4 }}>node scripts/capture-bg.mjs</code>
        </span>

        <button onClick={() => window.location.reload()} title="רענן רקע" style={btn("#475569")}>
          <RefreshCw size={12} /> רענן
        </button>
        <button onClick={reset} style={btn("#64748b")}>
          <RotateCcw size={12} /> איפוס
        </button>
        <button onClick={copyLayout} style={btn(copied ? "#16a34a" : "#2563eb")}>
          {copied ? <><Check size={12} /> הועתק!</> : <><Copy size={12} /> העתק פריסה</>}
        </button>
      </div>

      {/* ══ Scrollable outer ═════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>

        {/* ══ Fixed-size Canvas (1400×900) ══════════════════════════════════ */}
        <div
          ref={canvasRef}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onClick={() => setSelected(null)}
          style={{
            position: "relative",
            width: CW, height: CH,
            flexShrink: 0,
            backgroundImage: "url(/layout-bg.png)",
            backgroundSize: `${CW}px ${CH}px`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top left",
            opacity: 1,                    // outer opacity stays 1
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* Bg dimmer overlay — dims only the screenshot, not the components */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 1,
            background: `rgba(15,23,42,${1 - bgOpacity / 100})`,
            pointerEvents: "none",
          }} />

          {/* ── Draggable real components (z≥2, above dimmer) ── */}

          {wrap("sefer-selector",
            <SeferSelector
              sefer={MOCK_SEFER}
              selectedSefer={2}
              onSeferSelect={() => {}}
              selectedParsha={selectedParsha}
              onParshaSelect={setSelectedParsha}
              selectedPerek={selectedPerek}
              onPerekSelect={setSelectedPerek}
              selectedPasuk={selectedPasuk}
              onPasukSelect={setSelectedPasuk}
            />
          )}

          {wrap("desktop-controls",
            <div className="flex justify-start items-center gap-2 py-1">
              <ViewModeToggle seferId={2} />
              <Button variant="outline" size="icon" title="התוכן שלי">
                <User className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" title="פירושים">
                <BookOpen className="h-4 w-4" />
              </Button>
              <MinimizeButton variant="global" isMinimized={globalMin} onClick={() => setGlobalMin(m => !m)} />
            </div>
          )}

          {wrap("quick-selector",
            <div style={{ width: 320 }}>
              <QuickSelector
                sefer={MOCK_SEFER}
                selectedParsha={selectedParsha}
                onParshaSelect={p => { setSelectedParsha(p); setSelectedPerek(null); setSelectedPasuk(null); }}
                selectedPerek={selectedPerek}
                onPerekSelect={p => { setSelectedPerek(p); setSelectedPasuk(null); }}
                totalPesukimInPerek={21}
                selectedPasuk={selectedPasuk}
                onPasukSelect={setSelectedPasuk}
              />
            </div>
          )}

          {wrap("parsha-nav",
            <div className="flex items-center gap-1" dir="rtl">
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-base font-semibold text-primary whitespace-nowrap">תצוה</span>
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
          )}

          {wrap("pasuk-nav",
            <PasukSimpleNavigator
              pesukim={MOCK_FLAT}
              currentPasukNum={selectedPasuk || 1}
              onNavigate={setSelectedPasuk}
            />
          )}
        </div>
      </div>

      {/* ══ Status bar ═══════════════════════════════════════════════════════ */}
      <div style={{
        background: "#1e293b", borderTop: "1px solid #334155",
        padding: "4px 16px", display: "flex", gap: 20, fontSize: 11, color: "#64748b", flexShrink: 0,
      }}>
        {selected
          ? (() => { const b = get(selected); return <span style={{ color: "#94a3b8" }}>📍 <b>{b.label}</b> — x={b.x} y={b.y}</span>; })()
          : <span>לחץ על badge כחול/אפור בראש כל אלמנט כדי לגרור</span>
        }
        <span style={{ marginRight: "auto" }}>canvas {CW}×{CH}px</span>
        <span>רקע: /layout-bg.png</span>
      </div>
    </div>
  );
};

function btn(bg: string): React.CSSProperties {
  return {
    background: bg, color: "#fff", border: "none", borderRadius: 5,
    padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 4,
  };
}

export default LayoutEditor;
