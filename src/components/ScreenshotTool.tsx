import { useState, useRef, useEffect, useCallback } from 'react';
import { loadGallery, saveGalleryItem, deleteGalleryItem as dbDeleteItem, clearGalleryDB, updateGalleryItem, migrateFromLocalStorage } from '../lib/galleryDB';
import type { GalleryItem as DBGalleryItem } from '../lib/galleryDB';
import {
  captureElement,
  captureElementToCanvas,
  steppedDownscale,
  saveWithFileSystemAccess,
  getDisplayDPR,
  getCaptureScale,
  setupHQContext,
  gpuBlur,
  drawPressureStroke,
  type PressurePoint,
} from '../lib/screenshotEngine';

/* ═══════════════════════════════════════════════════════════
   ScreenshotTool — כלי צילום מסך משוכלל v4 (Advanced Engine)
   ─────────────────────────────────────────────────────────
   • html-to-image (מהיר ×70 מ-html2canvas, fallback אוטומטי)
   • Multi-pass stepped downscale (Lanczos-quality preview)
   • GPU-accelerated blur (ctx.filter)
   • PointerEvents + pressure-sensitive freehand
   • File System Access API (native OS save dialog)
   • Shape dragging — גרור סימונים בבחירה
   • createImageBitmap (async image loading)
   • imageSmoothingQuality='high' everywhere
   • בחירת אזור / דף מלא / אלמנט
   • עורך לא חוסם — ניתן לגרור ולהזיז את החלון
   • Ctrl+Z / Ctrl+Y (undo/redo)
   • גלריה מלאה + מועדפים + ZIP export + השוואה
   • קיצורי מקלדת גלובליים
   ═══════════════════════════════════════════════════════════ */

type ToolType = 'select' | 'rect' | 'circle' | 'arrow' | 'freehand' | 'text' | 'highlight' | 'blur' | 'stamp' | 'measure' | 'eyedropper';
type Phase = 'idle' | 'selecting' | 'editing' | 'gallery' | 'compare';

interface Shape {
  id: number;
  tool: Exclude<ToolType, 'select' | 'eyedropper'>;
  points: { x: number; y: number }[];
  color: string;
  text?: string;
  lineWidth: number;
  number?: number;
  stamp?: string;
  measuredPx?: number;
  pressurePoints?: PressurePoint[];  // pressure-sensitive freehand
}

interface Favorite {
  id: number;
  dataUrl: string;
  label: string;
  timestamp: number;
}

interface GalleryItem {
  id: number;
  dataUrl: string;
  label: string;
  timestamp: number;
  pinned: boolean;
  favorite: boolean;
}

const LS_FAV_KEY = 'screenshot-tool-favorites';
const LS_PIN_KEY = 'screenshot-tool-pinned';
// Gallery now stored in IndexedDB — see lib/galleryDB.ts
const LS_SIDEBAR_KEY = 'screenshot-tool-sidebar';
const LS_SIDEBAR_PIN_KEY = 'screenshot-tool-sidebar-pinned';
let shapeIdCounter = 0;
let annotationCounter = 0;

export function ScreenshotTool() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fullImage, setFullImage] = useState<HTMLImageElement | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);

  // Region selection state
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selEnd, setSelEnd] = useState<{ x: number; y: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);

  // Annotation state  
  const [tool, setTool] = useState<ToolType>('rect');
  const [color, setColor] = useState('#f43f5e');
  const [lineWidth, setLineWidth] = useState(3);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [curPoints, setCurPoints] = useState<{ x: number; y: number }[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // Undo/redo history
  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [histIdx, setHistIdx] = useState(0);

  // Selected shape
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Favorites & pin
  const [favorites, setFavorites] = useState<Favorite[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_FAV_KEY) || '[]'); } catch { return []; }
  });
  const [pinned, setPinned] = useState(() => localStorage.getItem(LS_PIN_KEY) === 'true');
  const [showFavorites, setShowFavorites] = useState(false);

  // Draggable dialog
  const [dialogPos, setDialogPos] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [dialogSize, setDialogSize] = useState<{ w: number; h: number }>({
    w: Math.min(window.innerWidth - 80, 900),
    h: Math.min(window.innerHeight - 80, 700),
  });
  const [draggingDialog, setDraggingDialog] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Shapes list panel
  const [showShapeList, setShowShapeList] = useState(false);

  // Gallery
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const galleryLoadedRef = useRef(false);
  const [gallerySearch, setGallerySearch] = useState('');

  // Zoom
  const [zoom, setZoom] = useState(1);

  // Sidebar mode
  const [sidebarMode, setSidebarMode] = useState(() => localStorage.getItem(LS_SIDEBAR_KEY) === 'true');
  const [sidebarPinned, setSidebarPinned] = useState(() => localStorage.getItem(LS_SIDEBAR_PIN_KEY) === 'true');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delayed capture (timer)
  const [captureDelay, setCaptureDelay] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Stamp selection
  const [currentStamp, setCurrentStamp] = useState('✓');

  // Compare mode
  const [compareItems, setCompareItems] = useState<[GalleryItem | null, GalleryItem | null]>([null, null]);

  // Element capture
  const [elementCaptureMode, setElementCaptureMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);

  // Gallery hover preview
  const [galleryPreview, setGalleryPreview] = useState<{ dataUrl: string; x: number; y: number } | null>(null);

  // Keep captures sharp even on low-DPI screens
  const captureScale = getCaptureScale();

  // Shape dragging state
  const [draggingShape, setDraggingShape] = useState<{ id: number; startMouse: { x: number; y: number }; startPoints: { x: number; y: number }[] } | null>(null);

  // Pressure-sensitive freehand points
  const [pressurePoints, setPressurePoints] = useState<PressurePoint[]>([]);

  // Double-tap shortcuts on numpad (* to open draw mode, + to snapshot)
  const lastNumpadMultiplyAtRef = useRef(0);
  const lastNumpadPlusAtRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editImgRef = useRef<HTMLImageElement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  /* ── persist ── */
  useEffect(() => { try { localStorage.setItem(LS_FAV_KEY, JSON.stringify(favorites)); } catch { /* quota */ } }, [favorites]);
  useEffect(() => { localStorage.setItem(LS_PIN_KEY, String(pinned)); }, [pinned]);
  // Load gallery from IndexedDB on mount (migrate localStorage if needed)
  useEffect(() => {
    (async () => {
      const migrated = await migrateFromLocalStorage();
      const items = migrated.length > 0 ? migrated : await loadGallery();
      setGallery(items);
      galleryLoadedRef.current = true;
    })();
  }, []);
  // Persist gallery changes to IndexedDB (skip initial empty-state write)
  const prevGalleryRef = useRef<GalleryItem[]>([]);
  useEffect(() => {
    if (!galleryLoadedRef.current) return;
    const prev = prevGalleryRef.current;
    const cur = gallery;
    prevGalleryRef.current = cur;
    // Detect added items
    const prevIds = new Set(prev.map(g => g.id));
    for (const item of cur) {
      if (!prevIds.has(item.id)) {
        saveGalleryItem(item);
      } else {
        // Check if item was updated (pin/favorite/label change)
        const old = prev.find(g => g.id === item.id);
        if (old && (old.pinned !== item.pinned || old.favorite !== item.favorite || old.label !== item.label)) {
          updateGalleryItem(item.id, { pinned: item.pinned, favorite: item.favorite, label: item.label });
        }
      }
    }
    // Detect removed items
    const curIds = new Set(cur.map(g => g.id));
    for (const item of prev) {
      if (!curIds.has(item.id)) {
        dbDeleteItem(item.id);
      }
    }
  }, [gallery]);
  useEffect(() => { localStorage.setItem(LS_SIDEBAR_KEY, String(sidebarMode)); }, [sidebarMode]);
  useEffect(() => { localStorage.setItem(LS_SIDEBAR_PIN_KEY, String(sidebarPinned)); }, [sidebarPinned]);

  /* ── Sidebar edge hover detection ── */
  useEffect(() => {
    if (!sidebarMode || sidebarPinned || phase !== 'idle') return;
    const onMove = (e: MouseEvent) => {
      const edgeZone = 12;
      const nearEdge = e.clientX <= edgeZone;
      if (nearEdge && !sidebarVisible) {
        if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current);
        setSidebarVisible(true);
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [sidebarMode, sidebarPinned, sidebarVisible, phase]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (sidebarPinned) return;
    sidebarTimerRef.current = setTimeout(() => setSidebarVisible(false), 400);
  }, [sidebarPinned]);

  const handleSidebarMouseEnter = useCallback(() => {
    if (sidebarTimerRef.current) clearTimeout(sidebarTimerRef.current);
  }, []);

  /* ── push to history whenever shapes change from user action ── */
  const pushHistory = useCallback((newShapes: Shape[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, histIdx + 1);
      return [...trimmed, newShapes];
    });
    setHistIdx(prev => prev + 1);
    setShapes(newShapes);
  }, [histIdx]);

  const undo = useCallback(() => {
    if (histIdx <= 0) return;
    const newIdx = histIdx - 1;
    setHistIdx(newIdx);
    setShapes(history[newIdx]);
    setSelectedId(null);
  }, [histIdx, history]);

  const redo = useCallback(() => {
    if (histIdx >= history.length - 1) return;
    const newIdx = histIdx + 1;
    setHistIdx(newIdx);
    setShapes(history[newIdx]);
    setSelectedId(null);
  }, [histIdx, history]);

  /* ── Gallery helpers ── */
  const addToGallery = useCallback((dataUrl: string) => {
    const item: GalleryItem = {
      id: Date.now(),
      dataUrl,
      label: `צילום ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
      timestamp: Date.now(),
      pinned: false,
      favorite: false,
    };
    setGallery(prev => [item, ...prev].slice(0, 100));
  }, []);

  const deleteGalleryItem = useCallback((id: number) => {
    setGallery(prev => prev.filter(g => g.id !== id));
  }, []);

  const toggleGalleryPin = useCallback((id: number) => {
    setGallery(prev => prev.map(g => g.id === id ? { ...g, pinned: !g.pinned } : g));
  }, []);

  const toggleGalleryFavorite = useCallback((id: number) => {
    setGallery(prev => prev.map(g => g.id === id ? { ...g, favorite: !g.favorite } : g));
  }, []);

  const clearGallery = useCallback(() => { setGallery([]); }, []);

  const copyGalleryItem = useCallback(async (dataUrl: string) => {
    try {
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setSaved('הועתק!');
      setTimeout(() => setSaved(null), 2000);
    } catch { /* ignore */ }
  }, []);

  /* ── Capture (html-to-image with html2canvas fallback) ── */
  const doCapture = useCallback(async () => {
    setCapturing(true);
    if (phase === 'gallery') setPhase('idle');
    try {
      const skipEls = btnRef.current ? [btnRef.current] : [];
      if (btnRef.current) btnRef.current.style.display = 'none';
      const dataUrl = await captureElement(document.body, captureScale, {
        skipElements: skipEls,
        width: document.documentElement.scrollWidth,
        height: window.innerHeight,
      });
      if (btnRef.current) btnRef.current.style.display = '';
      addToGallery(dataUrl);
      const img = new Image();
      img.onload = () => {
        setFullImage(img);
        setPhase('selecting');
        setSelStart(null);
        setSelEnd(null);
        setSelectedRegions([]);
      };
      img.src = dataUrl;
    } catch (err) {
      console.error('Screenshot failed:', err);
      if (btnRef.current) btnRef.current.style.display = '';
    } finally {
      setCapturing(false);
    }
  }, [addToGallery, phase, captureScale]);

  const startCapture = useCallback(async () => {
    if (captureDelay > 0) {
      setCountdown(captureDelay);
      for (let i = captureDelay; i > 0; i--) {
        setCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(null);
    }
    doCapture();
  }, [captureDelay, doCapture]);

  /* ── Region selection ── */
  const handleSelDown = useCallback((e: React.MouseEvent) => {
    setIsSelecting(true);
    const pt = { x: e.clientX, y: e.clientY };
    setSelStart(pt);
    setSelEnd(pt);
  }, []);
  const handleSelMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting) return;
    setSelEnd({ x: e.clientX, y: e.clientY });
  }, [isSelecting]);

  const enterEditing = useCallback((dataUrl: string) => {
    setCroppedDataUrl(dataUrl);
    setShapes([]);
    setCurPoints([]);
    setHistory([[]]);
    setHistIdx(0);
    setSelectedId(null);
    setZoom(1);
    annotationCounter = 0;
    setDialogPos({ x: 40, y: 40 });
    setDialogSize({
      w: Math.min(window.innerWidth - 80, 900),
      h: Math.min(window.innerHeight - 80, 700),
    });
    setPhase('editing');
  }, []);

  const startDrawModeFromCurrentScreen = useCallback(async () => {
    setCapturing(true);
    if (phase === 'gallery') setPhase('idle');
    try {
      if (btnRef.current) btnRef.current.style.display = 'none';
      const dataUrl = await captureElement(document.body, captureScale, {
        skipElements: btnRef.current ? [btnRef.current] : [],
        width: document.documentElement.scrollWidth,
        height: window.innerHeight,
      });
      if (btnRef.current) btnRef.current.style.display = '';
      addToGallery(dataUrl);
      enterEditing(dataUrl);
      setSaved('מצב ציור הופעל. לחץ פעמיים + לצילום הסופי');
      setTimeout(() => setSaved(null), 2600);
    } catch (err) {
      console.error('Open draw mode failed:', err);
      if (btnRef.current) btnRef.current.style.display = '';
    } finally {
      setCapturing(false);
    }
  }, [addToGallery, enterEditing, phase, captureScale]);

  const handleSelUp = useCallback(() => {
    if (!isSelecting || !selStart || !selEnd || !fullImage) return;
    setIsSelecting(false);
    const x1 = Math.min(selStart.x, selEnd.x);
    const y1 = Math.min(selStart.y, selEnd.y);
    const w = Math.abs(selEnd.x - selStart.x);
    const h = Math.abs(selEnd.y - selStart.y);
    if (w < 20 || h < 20) return;
    setSelectedRegions(prev => [...prev, { left: x1, top: y1, width: w, height: h }]);
    setSelStart(null);
    setSelEnd(null);
  }, [isSelecting, selStart, selEnd, fullImage]);

  const removeSelectedRegion = useCallback((idx: number) => {
    setSelectedRegions(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const finalizeSelectedRegions = useCallback(() => {
    if (!fullImage || selectedRegions.length === 0) return;
    const ratio = fullImage.naturalWidth / window.innerWidth;
    const spacing = 16;
    const widths = selectedRegions.map(r => Math.round(r.width * ratio));
    const heights = selectedRegions.map(r => Math.round(r.height * ratio));
    const outW = Math.max(...widths);
    const outH = heights.reduce((s, h) => s + h, 0) + spacing * (selectedRegions.length - 1);

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);

    let y = 0;
    selectedRegions.forEach((r, i) => {
      const sw = Math.round(r.width * ratio);
      const sh = Math.round(r.height * ratio);
      const sx = Math.round(r.left * ratio);
      const sy = Math.round(r.top * ratio);
      const x = Math.floor((outW - sw) / 2);
      ctx.drawImage(fullImage, sx, sy, sw, sh, x, y, sw, sh);
      y += sh;
      if (i < selectedRegions.length - 1) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + spacing / 2);
        ctx.lineTo(outW, y + spacing / 2);
        ctx.stroke();
        y += spacing;
      }
    });

    enterEditing(out.toDataURL('image/png'));
  }, [fullImage, selectedRegions, enterEditing]);

  const captureFullPage = useCallback(() => {
    if (!fullImage) return;
    enterEditing(fullImage.src);
  }, [fullImage, enterEditing]);

  /* ── Scroll capture ── */
  const scrollCapture = useCallback(async (direction: 'up' | 'down' | 'left' | 'right') => {
    setPhase('idle');
    setFullImage(null);
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const dpr = captureScale;
    const step = direction === 'up' || direction === 'down' ? Math.round(viewH * 0.8) : Math.round(viewW * 0.8);
    const isVertical = direction === 'up' || direction === 'down';
    const scrollDir = direction === 'down' || direction === 'right' ? 1 : -1;

    const captures: HTMLCanvasElement[] = [];
    const maxSteps = 10;
    let lastPos = isVertical ? window.scrollY : window.scrollX;

    // Capture first frame
    if (btnRef.current) btnRef.current.style.display = 'none';
    try {
      const firstCanvas = await captureElementToCanvas(document.body, dpr);
      captures.push(firstCanvas);

      for (let i = 0; i < maxSteps; i++) {
        if (isVertical) {
          window.scrollBy({ top: step * scrollDir, behavior: 'instant' as ScrollBehavior });
        } else {
          window.scrollBy({ left: step * scrollDir, behavior: 'instant' as ScrollBehavior });
        }
        await new Promise(r => setTimeout(r, 150));
        const newPos = isVertical ? window.scrollY : window.scrollX;
        if (newPos === lastPos) break; // reached the edge
        lastPos = newPos;

        const frameCanvas = await captureElementToCanvas(document.body, dpr);
        captures.push(frameCanvas);
      }
    } finally {
      if (btnRef.current) btnRef.current.style.display = '';
    }

    if (captures.length === 0) return;

    // Stitch captured frames
    let totalW: number, totalH: number;
    if (isVertical) {
      totalW = captures[0].width;
      totalH = captures.reduce((sum, c) => sum + c.height, 0);
    } else {
      totalW = captures.reduce((sum, c) => sum + c.width, 0);
      totalH = captures[0].height;
    }

    const stitched = document.createElement('canvas');
    stitched.width = totalW;
    stitched.height = totalH;
    const sctx = stitched.getContext('2d')!;
    let offset = 0;
    const ordered = (direction === 'up' || direction === 'left') ? captures.reverse() : captures;
    for (const c of ordered) {
      if (isVertical) {
        sctx.drawImage(c, 0, offset);
        offset += c.height;
      } else {
        sctx.drawImage(c, offset, 0);
        offset += c.width;
      }
    }

    const dataUrl = stitched.toDataURL('image/png');
    addToGallery(dataUrl);
    enterEditing(dataUrl);
  }, [addToGallery, enterEditing, captureScale]);

  /* ── Paste from clipboard ── */
  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      if (phase !== 'idle' && phase !== 'editing') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            addToGallery(dataUrl);
            enterEditing(dataUrl);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [phase, addToGallery, enterEditing]);

  /* ── Element capture mode ── */
  useEffect(() => {
    if (!elementCaptureMode) return;
    const highlight = document.createElement('div');
    highlight.id = 'screenshot-element-highlight';
    highlight.style.cssText = 'position:fixed;pointer-events:none;border:3px solid #8b5cf6;background:rgba(139,92,246,0.12);z-index:99999998;transition:all 0.1s;border-radius:4px;';
    document.body.appendChild(highlight);

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || el === highlight) return;
      setHoveredElement(el);
      const r = el.getBoundingClientRect();
      highlight.style.left = r.left + 'px';
      highlight.style.top = r.top + 'px';
      highlight.style.width = r.width + 'px';
      highlight.style.height = r.height + 'px';
    };

    const onClick = async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || el === highlight) return;
      setElementCaptureMode(false);
      highlight.remove();
      try {
        const dataUrl = await captureElement(el, captureScale);
        addToGallery(dataUrl);
        enterEditing(dataUrl);
      } catch (err) {
        console.error('Element capture failed:', err);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setElementCaptureMode(false);
        highlight.remove();
      }
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey);
      highlight.remove();
    };
  }, [elementCaptureMode, addToGallery, enterEditing, captureScale]);

  /* ── Export gallery as ZIP ── */
  const exportGalleryZip = useCallback(async () => {
    if (gallery.length === 0) return;
    // Simple ZIP using data URIs — download individually as fallback
    // Build a simple ZIP file manually (no external library)
    const files: { name: string; data: Uint8Array }[] = [];
    for (let i = 0; i < gallery.length; i++) {
      const item = gallery[i];
      const resp = await fetch(item.dataUrl);
      const buf = await resp.arrayBuffer();
      files.push({ name: `screenshot-${i + 1}.png`, data: new Uint8Array(buf) });
    }
    // Create ZIP
    const zip = buildZip(files);
    const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screenshots-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showSaved('הורד כ-ZIP!');
  }, [gallery]);

  /* ── Drawing helpers ── */
  const drawShapesOnCtx = useCallback(
    (ctx: CanvasRenderingContext2D, cw: number, ch: number, img: HTMLImageElement, allShapes: Shape[], highlightId?: number | null, extraShape?: Shape) => {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      const toDraw = extraShape ? [...allShapes, extraShape] : allShapes;
      for (const s of toDraw) {
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = s.lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (s.tool === 'blur' && s.points.length === 2) {
          const [p1, p2] = s.points;
          const bx = Math.min(p1.x, p2.x);
          const by = Math.min(p1.y, p2.y);
          const bw = Math.abs(p2.x - p1.x);
          const bh = Math.abs(p2.y - p1.y);
          if (bw > 2 && bh > 2) {
            // GPU-accelerated blur via ctx.filter
            const t = ctx.getTransform();
            gpuBlur(ctx, img, { x: bx, y: by, w: bw, h: bh }, 12, {
              scaleX: t.a, scaleY: t.d, offsetX: t.e, offsetY: t.f,
            });
          }
        } else if (s.tool === 'stamp' && s.points.length === 1 && s.stamp) {
          const fontSize = 24 + s.lineWidth * 4;
          ctx.font = `${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(s.stamp, s.points[0].x, s.points[0].y);
        } else if (s.tool === 'measure' && s.points.length === 2) {
          const [p1, p2] = s.points;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.setLineDash([]);
          // Draw endpoints
          for (const p of [p1, p2]) {
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
          }
          // Show distance label
          const dist = Math.round(Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2));
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          ctx.font = 'bold 12px monospace';
          const label = `${dist}px`;
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(30,30,46,0.85)';
          ctx.fillRect(mx - tw / 2 - 4, my - 16, tw + 8, 20);
          ctx.fillStyle = s.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, mx, my - 6);
        } else if (s.tool === 'highlight' && s.points.length === 2) {
          const [p1, p2] = s.points;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        } else if (s.tool === 'rect' && s.points.length === 2) {
          const [p1, p2] = s.points;
          ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        } else if (s.tool === 'circle' && s.points.length === 2) {
          const [p1, p2] = s.points;
          const rx = Math.abs(p2.x - p1.x) / 2;
          const ry = Math.abs(p2.y - p1.y) / 2;
          const cx = (p1.x + p2.x) / 2;
          const cy = (p1.y + p2.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (s.tool === 'arrow' && s.points.length === 2) {
          const [p1, p2] = s.points;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const headLen = 14 + s.lineWidth * 2;
          ctx.beginPath();
          ctx.moveTo(p2.x, p2.y);
          ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(p2.x, p2.y);
          ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        } else if (s.tool === 'freehand' && s.points.length > 1) {
          // Pressure-sensitive freehand using drawPressureStroke
          if (s.pressurePoints && s.pressurePoints.length > 1) {
            drawPressureStroke(ctx, s.pressurePoints, s.color, s.lineWidth);
          } else {
            ctx.beginPath();
            ctx.moveTo(s.points[0].x, s.points[0].y);
            for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
            ctx.stroke();
          }
        } else if (s.tool === 'text' && s.points.length === 1 && s.text) {
          const fontSize = 16 + s.lineWidth * 2;
          ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
          const metrics = ctx.measureText(s.text);
          const tx = s.points[0].x;
          const ty = s.points[0].y;
          const pad = 6;
          const bgW = metrics.width + pad * 2;
          const bgH = fontSize + pad * 2;
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = '#1e1e2e';
          ctx.beginPath();
          ctx.roundRect(tx - pad, ty - fontSize - pad, bgW, bgH, 6);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = s.color;
          ctx.fillText(s.text, tx, ty);
        }
        ctx.restore();

        // Auto-numbering badge
        if (s.number != null) {
          const nb = getShapeBounds(s);
          if (nb) {
            ctx.save();
            const bx = nb.x - 4;
            const by = nb.y - 4;
            ctx.fillStyle = '#6366f1';
            ctx.beginPath();
            ctx.arc(bx, by, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(s.number), bx, by);
            ctx.restore();
          }
        }

        // Selection highlight ring
        if (highlightId === s.id) {
          ctx.save();
          ctx.strokeStyle = '#00d4ff';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          const bb = getShapeBounds(s);
          if (bb) ctx.strokeRect(bb.x - 4, bb.y - 4, bb.w + 8, bb.h + 8);
          ctx.restore();
        }
      }
    },
    [],
  );

  /* ── redraw whenever shapes/selection change ── */
  useEffect(() => {
    if (phase !== 'editing' || !croppedDataUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const maxW = dialogSize.w - 20;
      const maxH = dialogSize.h - 140;
      const scale = Math.min(1, maxW / img.width, maxH / img.height) * zoom;
      const cssW = img.width * scale;
      const cssH = img.height * scale;
      const dpr = getDisplayDPR();
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      setupHQContext(ctx, dpr);
      editImgRef.current = img;
      drawShapesOnCtx(ctx, cssW, cssH, img, shapes, selectedId);
    };
    img.src = croppedDataUrl;
  }, [phase, croppedDataUrl, shapes, selectedId, drawShapesOnCtx, dialogSize, zoom]);

  /* ── Coords ── */
  const coords = (e: React.MouseEvent): { x: number; y: number } => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /* ── Canvas pointer events (pressure-aware) ── */
  const onCanvasDown = (e: React.PointerEvent | React.MouseEvent) => {
    // Select mode: pick a shape, enable dragging
    if (tool === 'select') {
      const pt = coords(e);
      const hit = findShapeAt(shapes, pt);
      setSelectedId(hit ? hit.id : null);
      if (hit) {
        setDraggingShape({
          id: hit.id,
          startMouse: pt,
          startPoints: hit.points.map(p => ({ ...p })),
        });
      }
      return;
    }
    if (tool === 'eyedropper') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pt = coords(e);
      // getImageData ignores transforms — scale CSS coords to backing-store pixels
      const t = ctx.getTransform();
      const pixel = ctx.getImageData(Math.round(pt.x * t.a + t.e), Math.round(pt.y * t.d + t.f), 1, 1).data;
      const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      setColor(hex);
      setTool('select');
      showSaved(`צבע: ${hex}`);
      return;
    }
    if (tool === 'stamp') {
      const pt = coords(e);
      annotationCounter++;
      pushHistory([...shapes, { id: ++shapeIdCounter, tool: 'stamp', points: [pt], color, lineWidth, number: annotationCounter, stamp: currentStamp }]);
      return;
    }
    if (tool === 'text') {
      const pt = coords(e);
      const text = prompt('הכנס טקסט:');
      if (text) {
        annotationCounter++;
        pushHistory([...shapes, { id: ++shapeIdCounter, tool: 'text', points: [pt], color, text, lineWidth, number: annotationCounter }]);
      }
      return;
    }
    setDrawing(true);
    const pt = coords(e);
    setCurPoints([pt]);
    // Capture pressure for freehand
    if (tool === 'freehand' && 'pressure' in e) {
      setPressurePoints([{ x: pt.x, y: pt.y, pressure: (e as React.PointerEvent).pressure || 0.5 }]);
    }
  };

  const onCanvasMove = (e: React.PointerEvent | React.MouseEvent) => {
    const pt = coords(e);

    // Handle shape dragging in select mode
    if (draggingShape) {
      const dx = pt.x - draggingShape.startMouse.x;
      const dy = pt.y - draggingShape.startMouse.y;
      const movedShapes = shapes.map(s => {
        if (s.id !== draggingShape.id) return s;
        return {
          ...s,
          points: draggingShape.startPoints.map(p => ({ x: p.x + dx, y: p.y + dy })),
          pressurePoints: s.pressurePoints?.map(p => ({
            ...p,
            x: p.x + dx - (draggingShape.startPoints[0]?.x ?? 0) + (s.points[0]?.x ?? 0),
            y: p.y + dy - (draggingShape.startPoints[0]?.y ?? 0) + (s.points[0]?.y ?? 0),
          })),
        };
      });
      setShapes(movedShapes);
      // Redraw
      const canvas = canvasRef.current;
      const img = editImgRef.current;
      if (canvas && img) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = getDisplayDPR();
          const cssW = parseFloat(canvas.style.width) || (canvas.width / dpr);
          const cssH = parseFloat(canvas.style.height) || (canvas.height / dpr);
          setupHQContext(ctx, dpr);
          drawShapesOnCtx(ctx, cssW, cssH, img, movedShapes, draggingShape.id);
        }
      }
      return;
    }

    if (!drawing) return;
    if (tool === 'freehand') {
      setCurPoints(prev => [...prev, pt]);
      if ('pressure' in e) {
        setPressurePoints(prev => [...prev, { x: pt.x, y: pt.y, pressure: (e as React.PointerEvent).pressure || 0.5 }]);
      }
    } else {
      setCurPoints(prev => [prev[0], pt]);
    }
    const canvas = canvasRef.current;
    const img = editImgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = getDisplayDPR();
    const cssW = parseFloat(canvas.style.width) || (canvas.width / dpr);
    const cssH = parseFloat(canvas.style.height) || (canvas.height / dpr);
    setupHQContext(ctx, dpr);
    const cur: Shape = {
      id: -1,
      tool: tool as Exclude<ToolType, 'select' | 'eyedropper'>,
      points: tool === 'freehand' ? [...curPoints, pt] : [curPoints[0], pt],
      color,
      lineWidth,
      ...(tool === 'measure' ? { measuredPx: Math.round(Math.sqrt((pt.x - curPoints[0].x) ** 2 + (pt.y - curPoints[0].y) ** 2)) } : {}),
    };
    drawShapesOnCtx(ctx, cssW, cssH, img, shapes, selectedId, cur);
  };

  const onCanvasUp = () => {
    // Finalize shape drag
    if (draggingShape) {
      pushHistory([...shapes]);
      setDraggingShape(null);
      return;
    }
    if (!drawing) return;
    setDrawing(false);
    if (curPoints.length >= 2 || (tool === 'freehand' && curPoints.length > 1)) {
      annotationCounter++;
      const newShape: Shape = {
        id: ++shapeIdCounter,
        tool: tool as Exclude<ToolType, 'select' | 'eyedropper'>,
        points: [...curPoints],
        color,
        lineWidth,
        number: annotationCounter,
      };
      if (tool === 'freehand' && pressurePoints.length > 1) {
        newShape.pressurePoints = [...pressurePoints];
      }
      if (tool === 'measure' && curPoints.length === 2) {
        newShape.measuredPx = Math.round(Math.sqrt((curPoints[1].x - curPoints[0].x) ** 2 + (curPoints[1].y - curPoints[0].y) ** 2));
      }
      pushHistory([...shapes, newShape]);
    }
    setCurPoints([]);
    setPressurePoints([]);
  };

  /* ── Zoom (Ctrl+Wheel on canvas) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'editing') return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(prev => Math.max(0.2, Math.min(5, +(prev + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(1))));
    };
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, [phase]);

  /* ── delete selected ── */
  const deleteSelected = useCallback(() => {
    if (selectedId === null) return;
    pushHistory(shapes.filter(s => s.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, shapes, pushHistory]);

  const deleteShapeById = useCallback((id: number) => {
    pushHistory(shapes.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [shapes, pushHistory, selectedId]);

  const clearAll = useCallback(() => {
    pushHistory([]);
    setSelectedId(null);
  }, [pushHistory]);

  /* ── Full-resolution export canvas ── */
  const getFullResCanvas = useCallback((): HTMLCanvasElement | null => {
    const img = editImgRef.current;
    const displayCanvas = canvasRef.current;
    if (!img || !displayCanvas || displayCanvas.width === 0) return null;
    // displayCanvas.width is already cssW * dpr, so get CSS size from style
    const cssW = parseFloat(displayCanvas.style.width) || (displayCanvas.width / getDisplayDPR());
    const cssH = parseFloat(displayCanvas.style.height) || (displayCanvas.height / getDisplayDPR());
    // Export at full original image resolution
    const full = document.createElement('canvas');
    full.width = img.width;
    full.height = img.height;
    const ctx = full.getContext('2d');
    if (!ctx) return displayCanvas;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const ratio = img.width / cssW;
    ctx.scale(ratio, ratio);
    drawShapesOnCtx(ctx, cssW, cssH, img, shapes, null);
    return full;
  }, [drawShapesOnCtx, shapes]);

  /* ── Re-crop: go back to selecting phase with current canvas ── */
  const reCrop = useCallback(() => {
    const full = getFullResCanvas();
    if (!full) return;
    const dataUrl = full.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      setFullImage(img);
      setPhase('selecting');
      setSelStart(null);
      setSelEnd(null);
      setSelectedRegions([]);
    };
    img.src = dataUrl;
  }, [getFullResCanvas]);

  /* ── Download (File System Access API) / Copy / Favorites ── */
  const downloadScreenshot = async () => {
    const canvas = getFullResCanvas();
    if (!canvas) return;
    const saved = await saveWithFileSystemAccess(canvas, `screenshot-${Date.now()}.png`);
    if (saved) showSaved('נשמר!');
  };

  const copyToClipboard = useCallback(async () => {
    const canvas = getFullResCanvas();
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setSaved('הועתק!');
        setTimeout(() => setSaved(null), 2000);
      }
    } catch {
      window.open(canvas.toDataURL('image/png'), '_blank');
    }
  }, [getFullResCanvas]);

  const addToFavorites = useCallback(() => {
    const canvas = getFullResCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const fav: Favorite = {
      id: Date.now(),
      dataUrl,
      label: `צילום ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
      timestamp: Date.now(),
    };
    setFavorites(prev => [fav, ...prev]);
    showSaved('נשמר למועדפים!');
  }, [getFullResCanvas]);

  const removeFavorite = useCallback((id: number) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  }, []);

  const loadFavorite = useCallback((fav: Favorite) => {
    enterEditing(fav.dataUrl);
    setShowFavorites(false);
  }, [enterEditing]);

  const showSaved = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2000);
  };

  const close = useCallback(() => {
    if (pinned) return; // pinned can't close with Esc
    setPhase('idle');
    setFullImage(null);
    setCroppedDataUrl(null);
    setShapes([]);
    setCurPoints([]);
    setSelStart(null);
    setSelEnd(null);
    setSelectedRegions([]);
    setIsSelecting(false);
    setDrawing(false);
    setSelectedId(null);
    setShowFavorites(false);
    setShowShapeList(false);
    setZoom(1);
    setElementCaptureMode(false);
  }, [pinned]);

  const forceClose = useCallback(() => {
    setPinned(false);
    setPhase('idle');
    setFullImage(null);
    setCroppedDataUrl(null);
    setShapes([]);
    setCurPoints([]);
    setSelStart(null);
    setSelEnd(null);
    setSelectedRegions([]);
    setIsSelecting(false);
    setDrawing(false);
    setSelectedId(null);
    setShowFavorites(false);
    setShowShapeList(false);
    setZoom(1);
    setElementCaptureMode(false);
  }, []);

  /* ── Drag dialog ── */
  const onTitleBarDown = useCallback((e: React.MouseEvent) => {
    setDraggingDialog(true);
    dragOffset.current = { x: e.clientX - dialogPos.x, y: e.clientY - dialogPos.y };
  }, [dialogPos]);

  useEffect(() => {
    if (!draggingDialog) return;
    const onMove = (e: MouseEvent) => {
      setDialogPos({
        x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => setDraggingDialog(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingDialog]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingField = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );

      const now = Date.now();
      const isNumpadMultiply = e.code === 'NumpadMultiply';
      const isNumpadPlus = e.code === 'NumpadAdd';

      if (!isTypingField && isNumpadMultiply && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (now - lastNumpadMultiplyAtRef.current < 430) {
          e.preventDefault();
          lastNumpadMultiplyAtRef.current = 0;
          startDrawModeFromCurrentScreen();
        } else {
          lastNumpadMultiplyAtRef.current = now;
        }
        return;
      }

      if (!isTypingField && isNumpadPlus && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (now - lastNumpadPlusAtRef.current < 430) {
          e.preventDefault();
          lastNumpadPlusAtRef.current = 0;
          if (phase === 'editing') {
            downloadScreenshot();
            setSaved('צולם סנאפשוט סופי');
            setTimeout(() => setSaved(null), 2000);
          }
        } else {
          lastNumpadPlusAtRef.current = now;
        }
        return;
      }

      // Global shortcuts (work in any phase)
      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault(); startCapture(); return;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        e.preventDefault(); setPhase(prev => prev === 'gallery' ? 'idle' : 'gallery'); return;
      }
      // Gallery
      if (phase === 'gallery') {
        if (e.key === 'Escape') { e.preventDefault(); setPhase('idle'); }
        return;
      }
      if (phase === 'idle') return;
      // Selecting / Editing
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showFavorites) { setShowFavorites(false); return; }
        if (showShapeList) { setShowShapeList(false); return; }
        close();
      }
      if (phase === 'editing') {
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
        if (e.ctrlKey && e.key === 'c') { e.preventDefault(); copyToClipboard(); }
        if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(z => Math.min(5, +(z + 0.1).toFixed(1))); }
        if (e.ctrlKey && e.key === '-') { e.preventDefault(); setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(1))); }
        if (e.ctrlKey && e.key === '0') { e.preventDefault(); setZoom(1); }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId !== null) {
          e.preventDefault(); deleteSelected();
        }
        // Tool shortcuts 1-7 plus 8=blur 9=stamp 0=measure
        const toolKeys: Record<string, ToolType> = { '1': 'select', '2': 'rect', '3': 'circle', '4': 'arrow', '5': 'freehand', '6': 'highlight', '7': 'text', '8': 'blur', '9': 'stamp' };
        if (!e.ctrlKey && !e.altKey && toolKeys[e.key]) {
          e.preventDefault(); setTool(toolKeys[e.key]);
          if (toolKeys[e.key] !== 'select') setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, close, undo, redo, selectedId, deleteSelected, showFavorites, showShapeList, startCapture, copyToClipboard, startDrawModeFromCurrentScreen]);

  /* ═════════════════ RENDER ═════════════════ */

  /* ── Countdown overlay ── */
  if (countdown !== null) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          fontSize: 120, fontWeight: 900, color: '#fff',
          textShadow: '0 0 60px rgba(99,102,241,0.8)',
        }}>{countdown}</div>
      </div>
    );
  }

  /* ── Element capture mode overlay ── */
  if (elementCaptureMode) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999999, cursor: 'crosshair',
        background: 'rgba(0,0,0,0.05)', pointerEvents: 'none',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30,30,46,0.95)', color: '#fff', padding: '10px 24px',
          borderRadius: 12, fontSize: 14, fontWeight: 600,
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)', direction: 'rtl', zIndex: 1,
          pointerEvents: 'auto', display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <span>🎯 לחץ על אלמנט לצילום</span>
          <button onClick={() => setElementCaptureMode(false)} style={topBarBtn('#e2e8f0')}>✕ ביטול (Esc)</button>
        </div>
      </div>
    );
  }

  /* ── Compare view ── */
  if (phase === 'compare') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999999, background: '#ffffff', fontFamily: 'system-ui, sans-serif', direction: 'rtl', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', flexShrink: 0 }}>
          <span style={{ color: '#0b1f4a', fontWeight: 700, fontSize: 16 }}>🔄 השוואת צילומים</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setPhase('gallery')} style={topBarBtn('#e2e8f0')}>← חזרה לגלריה</button>
          <button onClick={() => setPhase('idle')} style={topBarBtn('#e2e8f0')}>✕ סגור</button>
        </div>
        {/* Selectors */}
        <div style={{ display: 'flex', gap: 12, padding: '10px 20px', flexShrink: 0, background: '#f8fafc' }}>
          {[0, 1].map(idx => (
            <select
              key={idx}
              value={compareItems[idx]?.id || ''}
              onChange={e => {
                const id = Number(e.target.value);
                const item = gallery.find(g => g.id === id) || null;
                setCompareItems(prev => {
                  const next = [...prev] as [GalleryItem | null, GalleryItem | null];
                  next[idx] = item;
                  return next;
                });
              }}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0b1f4a', fontSize: 13, direction: 'rtl' }}
            >
              <option value="" style={{ background: '#1e1e2e' }}>בחר צילום {idx + 1}</option>
              {gallery.map(g => (
                <option key={g.id} value={g.id} style={{ background: '#ffffff' }}>{g.label}</option>
              ))}
            </select>
          ))}
        </div>
        {/* Side by side view */}
        <div style={{ flex: 1, display: 'flex', gap: 2, overflow: 'hidden', padding: 10 }}>
          {[0, 1].map(idx => (
            <div key={idx} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 8, overflow: 'auto', border: '1px solid #cbd5e1' }}>
              {compareItems[idx] ? (
                <img src={compareItems[idx]!.dataUrl} alt={compareItems[idx]!.label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 }} />
              ) : (
                <span style={{ color: '#555', fontSize: 14 }}>בחר צילום</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Gallery view ── */
  if (phase === 'gallery') {
    const filtered = gallery.filter(g => !gallerySearch || g.label.includes(gallerySearch));
    const sorted = [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return b.timestamp - a.timestamp;
    });

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999999, background: '#ffffff', fontFamily: 'system-ui, sans-serif', direction: 'rtl', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', flexShrink: 0 }}>
          <span style={{ color: '#0b1f4a', fontWeight: 700, fontSize: 16 }}>🖼️ גלריה ({gallery.length})</span>
          <input
            type="text"
            placeholder="🔍 חיפוש..."
            value={gallerySearch}
            onChange={e => setGallerySearch(e.target.value)}
            style={{ flex: 1, maxWidth: 300, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0b1f4a', borderRadius: 8, padding: '6px 12px', fontSize: 13, outline: 'none', direction: 'rtl' }}
          />
          <div style={{ flex: 1 }} />
          {gallery.length > 0 && <button onClick={exportGalleryZip} style={topBarBtn('#e2e8f0')}>📦 ייצוא ZIP</button>}
          {gallery.length >= 2 && <button onClick={() => { setCompareItems([gallery[0], gallery[1]]); setPhase('compare'); }} style={topBarBtn('#e2e8f0')}>🔄 השוואה</button>}
          {gallery.length > 0 && <button onClick={clearGallery} style={topBarBtn('#e2e8f0')}>🗑️ נקה הכל</button>}
          <button onClick={() => { setPhase('idle'); setTimeout(() => startCapture(), 50); }} style={topBarBtn('#e2e8f0')}>📷 צלם חדש</button>
          <button onClick={() => setPhase('idle')} style={topBarBtn('#e2e8f0')}>✕ סגור</button>
        </div>

        {/* Grid */}
        {sorted.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 15, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 40 }}>📷</span>
            {gallery.length === 0 ? 'אין צילומים עדיין — לחץ Ctrl+Shift+S לצלם' : 'אין תוצאות לחיפוש'}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14, alignContent: 'start' }}>
            {sorted.map(item => (
              <div key={item.id} style={{
                background: '#ffffff', borderRadius: 12, overflow: 'hidden',
                border: item.pinned ? '2px solid #94a3b8' : '1px solid #cbd5e1',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}>
                <img
                  src={item.dataUrl} alt={item.label}
                  onClick={() => copyGalleryItem(item.dataUrl)}
                  onMouseEnter={e => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setGalleryPreview({ dataUrl: item.dataUrl, x: r.left + r.width / 2, y: r.top });
                  }}
                  onMouseLeave={() => setGalleryPreview(null)}
                  style={{ width: '100%', height: 170, objectFit: 'cover', cursor: 'pointer', display: 'block', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  title="לחץ להעתקה ללוח | רחף לתצוגה מקדימה"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px' }}>
                  <span style={{ color: '#0b1f4a', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  <button onClick={() => toggleGalleryFavorite(item.id)} style={galBtn} title="מועדף">{item.favorite ? '⭐' : '☆'}</button>
                  <button onClick={() => toggleGalleryPin(item.id)} style={galBtn} title="הצמד">{item.pinned ? '📌' : '📍'}</button>
                  <button onClick={() => enterEditing(item.dataUrl)} style={galBtn} title="ערוך">✏️</button>
                  <button onClick={() => { const a = document.createElement('a'); a.download = `${item.label}.png`; a.href = item.dataUrl; a.click(); }} style={galBtn} title="הורד">💾</button>
                  <button onClick={() => deleteGalleryItem(item.id)} style={{ ...galBtn, color: '#f87171' }} title="מחק">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hover preview overlay */}
        {galleryPreview && (
          <div
            onMouseEnter={() => setGalleryPreview(null)}
            style={{
              position: 'fixed',
              left: Math.min(galleryPreview.x - 250, window.innerWidth - 520),
              top: Math.max(10, galleryPreview.y - 380),
              width: 500,
              maxHeight: 370,
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
              border: '2px solid #cbd5e1',
              zIndex: 100000001,
              overflow: 'hidden',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
            }}
          >
            <img src={galleryPreview.dataUrl} alt="תצוגה מקדימה" style={{ maxWidth: '100%', maxHeight: 358, objectFit: 'contain', borderRadius: 10 }} />
          </div>
        )}

        {/* Status bar */}
        <div style={{ padding: '6px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#555', fontSize: 10, display: 'flex', gap: 16, justifyContent: 'center', background: 'rgba(24,24,36,0.8)', flexShrink: 0 }}>
          <span><kbd style={kbdStyle}>Ctrl+Shift+S</kbd> צלם</span>
          <span><kbd style={kbdStyle}>Ctrl+Shift+G</kbd> סגור גלריה</span>
          <span><kbd style={kbdStyle}>Esc</kbd> סגור</span>
          <span>לחץ על תמונה = העתק ללוח</span>
        </div>
      </div>
    );
  }

  /* ── Region selection overlay ── */
  if (phase === 'selecting') {
    const rect = selStart && selEnd
      ? {
          left: Math.min(selStart.x, selEnd.x),
          top: Math.min(selStart.y, selEnd.y),
          width: Math.abs(selEnd.x - selStart.x),
          height: Math.abs(selEnd.y - selStart.y),
        }
      : null;

    return (
      <div
        onMouseDown={handleSelDown}
        onMouseMove={handleSelMove}
        onMouseUp={handleSelUp}
        style={{ position: 'fixed', inset: 0, zIndex: 99999999, cursor: 'crosshair', fontFamily: 'system-ui, sans-serif' }}
      >
        {fullImage && (
          <img src={fullImage.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        )}
        {selectedRegions.map((r, idx) => (
          <div key={`${r.left}-${r.top}-${idx}`} style={{ position: 'absolute', left: r.left, top: r.top, width: r.width, height: r.height, border: '2px solid #334155', boxShadow: '0 0 0 1px rgba(15,23,42,0.2)', pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', top: -22, right: 0, background: '#e2e8f0', color: '#0f172a', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{idx + 1}</span>
          </div>
        ))}
        {rect && rect.width > 5 && rect.height > 5 && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: rect.top, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: rect.top + rect.height, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: rect.top, left: 0, width: rect.left, height: rect.height, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height, border: '2px dashed #8b5cf6', boxShadow: '0 0 0 1px rgba(139,92,246,0.4)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: rect.left + rect.width / 2, top: rect.top + rect.height + 8, transform: 'translateX(-50%)', background: 'rgba(30,30,46,0.9)', color: '#e0e0e0', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              {Math.round(rect.width)} × {Math.round(rect.height)}
            </div>
          </>
        )}
        {!rect && <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.08)', pointerEvents: 'none' }} />}
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#ffffff', color: '#0b1f4a', padding: '10px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 28px rgba(15,23,42,0.15)', border: '1px solid #cbd5e1', direction: 'rtl', zIndex: 1, pointerEvents: 'auto' }}>
          <span>✂️ גרור לבחירת אזור (ניתן להוסיף כמה חלקים)</span>
          <button onClick={(e) => { e.stopPropagation(); setSelStart(null); setSelEnd(null); }} style={topBarBtn('#e2e8f0')}>➕ חלק נוסף</button>
          <button onClick={(e) => { e.stopPropagation(); finalizeSelectedRegions(); }} disabled={selectedRegions.length === 0} style={topBarBtn(selectedRegions.length === 0 ? '#cbd5e1' : '#94a3b8')}>✅ צור צילום ({selectedRegions.length})</button>
          <button onClick={(e) => { e.stopPropagation(); setSelectedRegions([]); }} style={topBarBtn('#f1f5f9')}>🧹 נקה חלקים</button>
          <button onClick={(e) => { e.stopPropagation(); captureFullPage(); }} style={topBarBtn('#e2e8f0')}>📷 דף מלא</button>
          <button onClick={(e) => { e.stopPropagation(); setPhase('idle'); setElementCaptureMode(true); }} style={topBarBtn('#e2e8f0')}>🎯 אלמנט</button>
          {/* Timer control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#a5b4fc', fontSize: 11 }}>⏱️</span>
            {[0, 3, 5, 10].map(d => (
              <button key={d} onClick={(e) => { e.stopPropagation(); setCaptureDelay(d); }}
                style={{
                  ...tbBtn, padding: '3px 7px', fontSize: 11,
                  background: captureDelay === d ? 'rgba(99,102,241,0.6)' : undefined,
                }}>{d === 0 ? '0' : `${d}s`}</button>
            ))}
          </div>
          <button onClick={(e) => { e.stopPropagation(); forceClose(); }} style={topBarBtn('#e2e8f0')}>✕ ביטול (Esc)</button>
        </div>

        {selectedRegions.length > 0 && (
          <div style={{ position: 'fixed', top: 74, left: '50%', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '80vw' }}>
            {selectedRegions.map((r, idx) => (
              <button key={`chip-${idx}`} onClick={(e) => { e.stopPropagation(); removeSelectedRegion(idx); }} style={{ background: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 999, fontSize: 11, padding: '4px 10px', cursor: 'pointer', boxShadow: '0 3px 10px rgba(15,23,42,0.1)' }}>
                חלק {idx + 1}: {Math.round(r.width)}×{Math.round(r.height)} ✕
              </button>
            ))}
          </div>
        )}

        {/* ── Scroll capture arrows ── */}
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 2, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ background: 'rgba(30,30,46,0.9)', borderRadius: 10, padding: '6px 10px', color: '#a5b4fc', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>📜 צילום עם גלילה</div>
          <button onClick={(e) => { e.stopPropagation(); scrollCapture('up'); }} style={scrollArrowBtn} title="גלול למעלה וצלם">⬆</button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={(e) => { e.stopPropagation(); scrollCapture('right'); }} style={scrollArrowBtn} title="גלול ימינה וצלם">➡</button>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '2px dashed rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📜</div>
            <button onClick={(e) => { e.stopPropagation(); scrollCapture('left'); }} style={scrollArrowBtn} title="גלול שמאלה וצלם">⬅</button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); scrollCapture('down'); }} style={scrollArrowBtn} title="גלול למטה וצלם">⬇</button>
        </div>
      </div>
    );
  }

  /* ── Editing dialog — NON-BLOCKING, DRAGGABLE ── */
  if (phase === 'editing') {
    const toolsList: { id: ToolType; icon: string; label: string }[] = [
      { id: 'select', icon: '👆', label: 'בחר סימון' },
      { id: 'rect', icon: '▭', label: 'מלבן' },
      { id: 'circle', icon: '○', label: 'עיגול' },
      { id: 'arrow', icon: '→', label: 'חץ' },
      { id: 'freehand', icon: '✏️', label: 'חופשי' },
      { id: 'highlight', icon: '🖍️', label: 'הדגשה' },
      { id: 'text', icon: 'T', label: 'טקסט' },
      { id: 'blur', icon: '🔲', label: 'טשטוש' },
      { id: 'stamp', icon: '✓', label: 'חותמת' },
      { id: 'measure', icon: '📏', label: 'מדידה' },
      { id: 'eyedropper', icon: '💧', label: 'טפטפת צבע' },
    ];
    const colorList = ['#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff', '#000000'];
    const shapeNames: Record<string, string> = {
      rect: '▭ מלבן', circle: '○ עיגול', arrow: '→ חץ', freehand: '✏️ חופשי', highlight: '🖍️ הדגשה', text: 'T טקסט', blur: '🔲 טשטוש', stamp: '✓ חותמת', measure: '📏 מדידה',
    };

    return (
      <>
        {/* Backdrop — click-through so it's non-blocking */}
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99999998, background: pinned ? 'none' : 'rgba(0,0,0,0.3)', pointerEvents: pinned ? 'none' : 'auto' }}
          onClick={pinned ? undefined : (e) => { if (e.target === e.currentTarget) close(); }}
        />

        {/* Main floating dialog */}
        <div
          style={{
            position: 'fixed',
            left: dialogPos.x,
            top: dialogPos.y,
            width: dialogSize.w,
            height: dialogSize.h,
            zIndex: 99999999,
            background: '#ffffff',
            borderRadius: 14,
            boxShadow: '0 10px 36px rgba(15,23,42,0.18), 0 0 0 1px #cbd5e1',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, sans-serif',
            direction: 'rtl',
            overflow: 'hidden',
            resize: 'both',
          }}
          ref={(el) => {
            if (!el) return;
            const ro = new ResizeObserver(entries => {
              for (const entry of entries) {
                setDialogSize({ w: entry.contentRect.width, h: entry.contentRect.height });
              }
            });
            ro.observe(el);
            return () => ro.disconnect();
          }}
        >
          {/* ── Title bar (draggable) ── */}
          <div
            onMouseDown={onTitleBarDown}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px',
              background: '#f8fafc',
              cursor: draggingDialog ? 'grabbing' : 'grab',
              userSelect: 'none', flexShrink: 0,
            }}
          >
            <span style={{ color: '#0b1f4a', fontWeight: 700, fontSize: 13 }}>📸 עורך צילום מסך</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {saved && <span style={{ color: '#d4ffee', fontWeight: 700, fontSize: 12 }}>✅ {saved}</span>}
              <button onClick={() => setPinned(p => !p)} style={hdrBtn} title={pinned ? 'בטל הצמדה' : 'הצמד'}>{pinned ? '📌' : '📍'}</button>
              <button onClick={() => setShowFavorites(f => !f)} style={hdrBtn} title="מועדפים">⭐</button>
              <button onClick={() => setShowShapeList(s => !s)} style={hdrBtn} title="רשימת סימונים">📋</button>
              <button onClick={forceClose} style={{ ...hdrBtn, fontSize: 16, lineHeight: '1' }} title="סגור (Esc)">✕</button>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#ffffff', borderBottom: '1px solid #cbd5e1', flexWrap: 'wrap', flexShrink: 0 }}>
            {toolsList.map((t, i) => (
              <button
                key={t.id}
                onClick={() => { setTool(t.id); if (t.id !== 'select') setSelectedId(null); }}
                title={`${t.label} (${i + 1})`}
                style={{
                  background: tool === t.id ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.07)',
                  border: tool === t.id ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 14,
                  transition: 'all 0.15s',
                }}
              >{t.icon}</button>
            ))}

            <Separator />
            {colorList.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: c,
                  border: color === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }} />
            ))}
            <Separator />
            <span style={{ color: '#a5b4fc', fontSize: 11 }}>עובי:</span>
            <input type="range" min={1} max={8} value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} style={{ width: 60, accentColor: '#8b5cf6' }} />
            <span style={{ color: '#a5b4fc', fontSize: 11, minWidth: 22 }}>{lineWidth}</span>
            <Separator />
            <button onClick={undo} disabled={histIdx <= 0} style={tbBtn} title="Ctrl+Z">↩️</button>
            <button onClick={redo} disabled={histIdx >= history.length - 1} style={tbBtn} title="Ctrl+Y">↪️</button>
            {selectedId !== null && (
              <button onClick={deleteSelected} style={{ ...tbBtn, background: 'rgba(239,68,68,0.4)' }} title="מחק סימון (Delete)">🗑️</button>
            )}
            <Separator />
            <span style={{ color: '#a5b4fc', fontSize: 11 }}>🔍 {Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.2, +(z - 0.1).toFixed(1)))} style={tbBtn} title="Ctrl+-">−</button>
            <button onClick={() => setZoom(1)} style={tbBtn} title="Ctrl+0">1:1</button>
            <button onClick={() => setZoom(z => Math.min(5, +(z + 0.1).toFixed(1)))} style={tbBtn} title="Ctrl+=">+</button>
            {/* Stamp picker */}
            {tool === 'stamp' && (
              <>
                <Separator />
                {['✓', '✗', '!', '?', '★', '❤', '①', '②', '③'].map(s => (
                  <button key={s} onClick={() => setCurrentStamp(s)}
                    style={{ ...tbBtn, background: currentStamp === s ? 'rgba(99,102,241,0.45)' : undefined, fontSize: 16, padding: '2px 6px' }}
                  >{s}</button>
                ))}
              </>
            )}
            <Separator />
            <button onClick={reCrop} style={tbBtn} title="חיתוך מחדש">✂️</button>
            <div style={{ flex: 1 }} />
            <button onClick={addToFavorites} style={tbBtnAcc('rgba(234,179,8,0.5)')} title="שמור למועדפים">⭐</button>
            <button onClick={copyToClipboard} style={tbBtnAcc('rgba(59,130,246,0.5)')}>📋</button>
            <button onClick={downloadScreenshot} style={tbBtnAcc('rgba(16,185,129,0.6)')}>💾</button>
          </div>

          {/* ── Main area: canvas + optional panels ── */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            {/* Canvas */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, overflow: 'auto' }}>
              <canvas
                ref={canvasRef}
                onPointerDown={onCanvasDown}
                onPointerMove={onCanvasMove}
                onPointerUp={onCanvasUp}
                onPointerLeave={onCanvasUp}
                style={{
                  cursor: tool === 'select' ? (draggingShape ? 'grabbing' : 'pointer') : tool === 'text' || tool === 'stamp' ? 'text' : tool === 'eyedropper' ? 'crosshair' : tool === 'measure' ? 'crosshair' : 'crosshair',
                  borderRadius: 8,
                  boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
                  maxWidth: '100%', maxHeight: '100%',
                  touchAction: 'none', // required for pointer events
                }}
              />
            </div>

            {/* ── Shape list panel ── */}
            {showShapeList && (
              <div style={{
                width: 200, borderRight: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(20,20,32,0.98)', overflowY: 'auto', flexShrink: 0,
              }}>
                <div style={{ padding: '8px 10px', fontSize: 12, color: '#a5b4fc', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  סימונים ({shapes.length})
                </div>
                {shapes.length === 0 && <div style={{ padding: 12, color: '#555', fontSize: 12, textAlign: 'center' }}>אין סימונים</div>}
                {shapes.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => { setSelectedId(s.id); setTool('select'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', cursor: 'pointer',
                      background: selectedId === s.id ? '#e2e8f0' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ color: '#ddd', fontSize: 12, flex: 1 }}>{i + 1}. {shapeNames[s.tool] || s.tool}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteShapeById(s.id); }}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
                      title="מחק"
                    >✕</button>
                  </div>
                ))}
                {shapes.length > 0 && (
                  <button onClick={clearAll} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}>
                    🗑️ נקה הכל
                  </button>
                )}
              </div>
            )}

            {/* ── Favorites panel ── */}
            {showFavorites && (
              <div style={{
                width: 220, borderRight: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(20,20,32,0.98)', overflowY: 'auto', flexShrink: 0,
              }}>
                <div style={{ padding: '8px 10px', fontSize: 12, color: '#eab308', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  ⭐ מועדפים ({favorites.length})
                </div>
                {favorites.length === 0 && <div style={{ padding: 12, color: '#555', fontSize: 12, textAlign: 'center' }}>אין מועדפים</div>}
                {favorites.map(fav => (
                  <div key={fav.id} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <img
                      src={fav.dataUrl}
                      alt={fav.label}
                      onClick={() => loadFavorite(fav)}
                      style={{ width: '100%', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ color: '#aaa', fontSize: 10 }}>{fav.label}</span>
                      <button
                        onClick={() => removeFavorite(fav.id)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 11 }}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Status bar ── */}
          <div style={{
            padding: '5px 14px', background: 'rgba(30,30,46,0.8)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            color: '#555', fontSize: 10, display: 'flex', gap: 16, justifyContent: 'center', flexShrink: 0,
          }}>
            <span><kbd style={kbdStyle}>Esc</kbd> סגור</span>
            <span><kbd style={kbdStyle}>Ctrl+Z</kbd>/<kbd style={kbdStyle}>Y</kbd> בטל/שחזר</span>
            <span><kbd style={kbdStyle}>Ctrl+C</kbd> העתק</span>
            <span><kbd style={kbdStyle}>Ctrl±</kbd> זום</span>
            <span><kbd style={kbdStyle}>1-9</kbd> כלים</span>
            <span><kbd style={kbdStyle}>Del</kbd> מחק סימון</span>
            <span><kbd style={kbdStyle}>Ctrl+V</kbd> הדבק תמונה</span>
            <span>גרור כותרת להזזה</span>
          </div>
        </div>
      </>
    );
  }

  /* ── Floating buttons + Sidebar (idle) ── */
  const sidebarOpen = sidebarMode && (sidebarPinned || sidebarVisible);
  const recentGallery = gallery.slice(0, 4);

  return (
    <>
      {/* ── Sidebar ── */}
      {sidebarMode && (
        <>
          {/* Edge trigger strip — always visible when sidebar hidden */}
          {!sidebarOpen && (
            <div
              onMouseEnter={() => setSidebarVisible(true)}
              style={{
                position: 'fixed', left: 0, top: 0, width: 6, height: '100%',
                zIndex: 999998, cursor: 'pointer',
                background: 'linear-gradient(90deg, rgba(99,102,241,0.3), transparent)',
              }}
            />
          )}

          {/* Sidebar panel */}
          <div
            onMouseEnter={handleSidebarMouseEnter}
            onMouseLeave={handleSidebarMouseLeave}
            style={{
              position: 'fixed', left: 0, top: 0, height: '100%',
              width: 260,
              zIndex: 999999,
              background: '#ffffff',
              borderRight: '1px solid #cbd5e1',
              boxShadow: sidebarOpen ? '4px 0 30px rgba(15,23,42,0.15)' : 'none',
              transform: sidebarOpen ? 'translateX(0)' : 'translateX(-260px)',
              transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
              display: 'flex', flexDirection: 'column',
              fontFamily: 'system-ui, sans-serif', direction: 'rtl',
              pointerEvents: sidebarOpen ? 'auto' : 'none',
            }}
          >
            {/* Sidebar header */}
            <div style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#f8fafc', flexShrink: 0,
            }}>
              <span style={{ color: '#0b1f4a', fontWeight: 700, fontSize: 14 }}>📸 כלי צילום</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setSidebarPinned(p => !p)} style={hdrBtn} title={sidebarPinned ? 'בטל הצמדה' : 'הצמד סיידבר'}>
                  {sidebarPinned ? '📌' : '📍'}
                </button>
                <button onClick={() => { setSidebarMode(false); setSidebarVisible(false); }} style={hdrBtn} title="עבור למצב כפתור צף">✕</button>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              <button onClick={startCapture} disabled={capturing} style={sidebarActionBtn}>
                {capturing ? '⏳ מצלם...' : '📷 צלם מסך'}
                <kbd style={{ ...kbdStyle, marginRight: 'auto' }}>Ctrl+Shift+S</kbd>
              </button>
              <button onClick={() => setElementCaptureMode(true)} style={sidebarActionBtn}>
                🎯 צלם אלמנט
              </button>
              <button onClick={() => setPhase('gallery')} style={sidebarActionBtn}>
                🖼️ גלריה ({gallery.length})
                <kbd style={{ ...kbdStyle, marginRight: 'auto' }}>Ctrl+Shift+G</kbd>
              </button>
              {/* Timer delay selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#a5b4fc', fontSize: 11 }}>⏱️ השהיה:</span>
                {[0, 3, 5, 10].map(d => (
                  <button key={d} onClick={() => setCaptureDelay(d)}
                    style={{
                      ...tbBtn,
                      background: captureDelay === d ? 'rgba(99,102,241,0.45)' : undefined,
                      padding: '3px 8px', fontSize: 11,
                    }}
                  >{d === 0 ? 'ללא' : `${d}s`}</button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 14px' }} />

            {/* Scroll capture */}
            <div style={{ padding: '12px 14px', flexShrink: 0 }}>
              <div style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>📜 צילום עם גלילה</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => scrollCapture('up')} style={sidebarScrollBtn} title="גלול למעלה">⬆</button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => scrollCapture('right')} style={sidebarScrollBtn} title="גלול ימינה">➡</button>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px dashed rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📜</div>
                    <button onClick={() => scrollCapture('left')} style={sidebarScrollBtn} title="גלול שמאלה">⬅</button>
                  </div>
                  <button onClick={() => scrollCapture('down')} style={sidebarScrollBtn} title="גלול למטה">⬇</button>
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 14px' }} />

            {/* Recent captures */}
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
              <div style={{ color: '#a5b4fc', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>🕑 אחרונים</div>
              {recentGallery.length === 0 && <div style={{ color: '#555', fontSize: 12, textAlign: 'center', padding: 10 }}>אין צילומים</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {recentGallery.map(item => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <img
                      src={item.dataUrl} alt={item.label}
                      onClick={() => copyGalleryItem(item.dataUrl)}
                      style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}
                      title="לחץ להעתקה"
                    />
                    <button
                      onClick={() => enterEditing(item.dataUrl)}
                      style={{ position: 'absolute', top: 3, left: 3, background: 'rgba(30,30,46,0.85)', border: 'none', color: '#fff', borderRadius: 4, fontSize: 10, padding: '2px 5px', cursor: 'pointer' }}
                      title="ערוך"
                    >✏️</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar footer */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#555', fontSize: 10, flexShrink: 0, textAlign: 'center' }}>
              {saved && <span style={{ color: '#d4ffee', fontWeight: 700 }}>✅ {saved}</span>}
              {!saved && 'קיצור חדש: ** לפתיחת ציור, ++ לצילום סופי'}
            </div>
          </div>
        </>
      )}

      {/* ── FAB buttons (when not in sidebar mode) ── */}
      {!sidebarMode && (
        <>
          <button
            ref={btnRef}
            onClick={startCapture}
            disabled={capturing}
            title="📸 צלם מסך (Ctrl+Shift+S)"
            style={{
              position: 'fixed', bottom: 80, left: 20, zIndex: 999999,
              width: 48, height: 48, borderRadius: '50%',
              background: capturing ? '#cbd5e1' : 'linear-gradient(180deg, #f8fafc, #e2e8f0)',
              color: '#64748b', border: '1px solid #cbd5e1',
              cursor: capturing ? 'wait' : 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 4px 16px rgba(148,163,184,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.6)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.4)'; }}
          >
            {capturing ? '⏳' : '📸'}
            {gallery.length > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: '#ef4444', color: '#fff', borderRadius: '50%',
                width: 20, height: 20, fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }}>{gallery.length > 99 ? '99+' : gallery.length}</span>
            )}
          </button>
          {gallery.length > 0 && (
            <button
              onClick={() => setPhase('gallery')}
              title="🖼️ גלריה (Ctrl+Shift+G)"
              style={{
                position: 'fixed', bottom: 136, left: 20, zIndex: 999999,
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)',
                color: '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 4px 12px rgba(148,163,184,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, transition: 'transform 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >🖼️</button>
          )}
        </>
      )}

      {/* Toggle FAB ↔ Sidebar */}
      <button
        onClick={() => { setSidebarMode(m => !m); setSidebarVisible(false); }}
        title={sidebarMode ? 'עבור לכפתור צף' : 'עבור לסיידבר'}
        style={{
          position: 'fixed', bottom: sidebarMode ? 20 : 184, left: 20, zIndex: 999999,
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)', border: '1px solid #cbd5e1',
          color: '#64748b', cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s', opacity: 0.7,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.15)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'scale(1)'; }}
      >{sidebarMode ? '⊙' : '☰'}</button>
    </>
  );
}

/* ── Helpers ── */
function getShapeBounds(s: Shape): { x: number; y: number; w: number; h: number } | null {
  if (s.points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (s.tool === 'text') {
    return { x: minX, y: minY - 20, w: Math.max(60, maxX - minX), h: 28 };
  }
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function findShapeAt(shapes: Shape[], pt: { x: number; y: number }): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const bb = getShapeBounds(shapes[i]);
    if (!bb) continue;
    const margin = 6;
    if (pt.x >= bb.x - margin && pt.x <= bb.x + bb.w + margin &&
        pt.y >= bb.y - margin && pt.y <= bb.y + bb.h + margin) {
      return shapes[i];
    }
  }
  return null;
}

function Separator() {
  return <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />;
}

/* ── Shared styles ── */
const topBarBtn = (bg: string): React.CSSProperties => ({
  background: bg, border: '1px solid #cbd5e1', color: '#0b1f4a', borderRadius: 10,
  padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 3px 10px rgba(148,163,184,0.25)',
});

const hdrBtn: React.CSSProperties = {
  background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)', border: '1px solid #cbd5e1', color: '#475569',
  borderRadius: 8, padding: '3px 8px', cursor: 'pointer', fontSize: 12,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(148,163,184,0.2)',
};

const tbBtn: React.CSSProperties = {
  background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)', border: '1px solid #cbd5e1',
  color: '#0b1f4a', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 13,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(148,163,184,0.2)',
};

const tbBtnAcc = (bg: string): React.CSSProperties => ({
  ...tbBtn, background: bg, fontWeight: 600,
});

const kbdStyle: React.CSSProperties = {
  background: '#f8fafc', border: '1px solid #cbd5e1',
  color: '#0b1f4a', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontFamily: 'monospace',
};

const galBtn: React.CSSProperties = {
  background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)', border: '1px solid #cbd5e1', color: '#64748b',
  cursor: 'pointer', fontSize: 13, padding: '2px 4px',
  transition: 'color 0.15s', borderRadius: 6,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(148,163,184,0.15)',
};

const scrollArrowBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: '50%',
  background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)', border: '2px solid #cbd5e1',
  color: '#64748b', cursor: 'pointer', fontSize: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 4px 12px rgba(148,163,184,0.25)',
  transition: 'background 0.15s, transform 0.15s',
};

const sidebarActionBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '10px 12px', borderRadius: 8,
  background: '#ffffff', border: '1px solid #cbd5e1',
  color: '#0b1f4a', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit', transition: 'background 0.15s',
  textAlign: 'right' as const,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 10px rgba(148,163,184,0.18)',
};

const sidebarScrollBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'linear-gradient(180deg, #f8fafc, #e2e8f0)', border: '1px solid #cbd5e1',
  color: '#64748b', cursor: 'pointer', fontSize: 15,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), 0 3px 10px rgba(148,163,184,0.2)',
};

/* ── Simple ZIP builder (no external deps) ── */
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: { name: Uint8Array; data: Uint8Array; offset: number }[] = [];
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    // Local file header
    const header = new Uint8Array(30 + nameBytes.length);
    const hView = new DataView(header.buffer);
    hView.setUint32(0, 0x04034b50, true);  // signature
    hView.setUint16(4, 20, true);           // version needed
    hView.setUint16(6, 0, true);            // flags
    hView.setUint16(8, 0, true);            // compression (store)
    hView.setUint16(10, 0, true);           // mod time
    hView.setUint16(12, 0, true);           // mod date
    hView.setUint32(14, crc32(f.data), true); // crc32
    hView.setUint32(18, f.data.length, true); // compressed size
    hView.setUint32(22, f.data.length, true); // uncompressed size
    hView.setUint16(26, nameBytes.length, true); // name length
    hView.setUint16(28, 0, true);           // extra length
    header.set(nameBytes, 30);

    entries.push({ name: nameBytes, data: f.data, offset });
    parts.push(header);
    parts.push(f.data);
    offset += header.length + f.data.length;
  }

  // Central directory
  const cdStart = offset;
  for (const e of entries) {
    const cd = new Uint8Array(46 + e.name.length);
    const cdView = new DataView(cd.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true);
    cdView.setUint32(16, crc32(e.data), true);
    cdView.setUint32(20, e.data.length, true);
    cdView.setUint32(24, e.data.length, true);
    cdView.setUint16(28, e.name.length, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, e.offset, true);
    cd.set(e.name, 46);
    parts.push(cd);
    offset += cd.length;
  }

  // End of central directory
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, offset - cdStart, true);
  eocdView.setUint32(16, cdStart, true);
  eocdView.setUint16(20, 0, true);
  parts.push(eocd);

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) { result.set(p, pos); pos += p.length; }
  return result;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
