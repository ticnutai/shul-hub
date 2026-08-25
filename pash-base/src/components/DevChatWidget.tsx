import { useState, useRef, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  attachments?: string[];
}

type AnnotationTool = 'rect' | 'circle' | 'arrow' | 'freehand' | 'text';
interface AnnotationShape {
  tool: AnnotationTool;
  points: { x: number; y: number }[];
  color: string;
  text?: string;
}

/**
 * DevChatWidget – full bidirectional chat with Copilot from inside the browser.
 *
 * - Send messages → Copilot reads from .dev-chat/messages.json
 * - Copilot writes responses → widget polls and displays them
 * - Screenshot: Win+Shift+S then Ctrl+V, or 📸 button
 * - Drag & drop files / paste images
 * - Full conversation history
 */
export function DevChatWidget() {
  const [isOpen, setIsOpenRaw] = useState(() => {
    try { return localStorage.getItem('dev-chat-open') === 'true'; } catch { return false; }
  });
  // Persist open state to localStorage + cloud on every change
  const setIsOpen = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsOpenRaw(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('dev-chat-open', String(next));
        localStorage.setItem('dev-chat-open-ts', String(Date.now()));
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return;
          const ts = Date.now();
          supabase.auth.updateUser({ data: {
            ...user.user_metadata,
            dev_chat_open: next,
            dev_chat_open_ts: ts,
          } }).catch(() => {});
        }).catch(() => {});
      } catch { /* ignore */ }
      return next;
    });
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [unread, setUnread] = useState(0);
  const [picking, setPicking] = useState(false);
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [annotationImg, setAnnotationImg] = useState<string | null>(null);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('rect');
  const [annotationColor, setAnnotationColor] = useState('#f43f5e');
  const [shapes, setShapes] = useState<AnnotationShape[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [screenshotting, setScreenshotting] = useState(false);
  const [gridActive, setGridActive] = useState(false);
  const [gridSize, setGridSize] = useState(80);
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const pickerOverlayRef = useRef<HTMLDivElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Poll for new messages (including Copilot responses)
  useEffect(() => {
    // Only poll when widget is open to avoid causing app-wide re-renders every 2s.
    if (!isOpen) return;

    const poll = async () => {
      try {
        const res = await fetch('/__dev-chat/poll');
        const data = await res.json();
        if (data.count !== lastCountRef.current) {
          const fullRes = await fetch('/__dev-chat');
          const msgs: ChatMessage[] = await fullRes.json();
          setMessages(msgs);
          if (!isOpen && data.count > lastCountRef.current) {
            const newMsgs = msgs.slice(lastCountRef.current);
            const assistantCount = newMsgs.filter(m => m.role === 'assistant').length;
            if (assistantCount > 0) setUnread(prev => prev + assistantCount);
          }
          lastCountRef.current = data.count;
        }
      } catch { /* server might be restarting */ }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Gather page context
  const gatherPageContext = useCallback(() => {
    const ae = document.activeElement;
    const activeInfo = ae && ae !== document.body ? {
      tag: ae.tagName,
      id: ae.id || undefined,
      text: (ae as HTMLElement).innerText?.slice(0, 100),
    } : null;
    return {
      url: window.location.href,
      title: document.title,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scrollY: Math.round(window.scrollY),
      activeElement: activeInfo,
    };
  }, []);

  // Upload file and return filename
  const uploadFile = useCallback(async (file: File | Blob, filename?: string): Promise<string | null> => {
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const safeName = filename || `upload-${Date.now()}.${file.type?.split('/')[1] || 'png'}`;
      const res = await fetch('/__dev-chat/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataUrl, filename: safeName }),
      });
      const result = await res.json();
      return result.filename || null;
    } catch { return null; }
  }, []);

  // Screenshot capture with html2canvas
  const captureScreenshot = useCallback(async () => {
    setScreenshotting(true);
    try {
      // Temporarily hide the chat widget
      const widget = document.querySelector('[data-dev-chat-widget]') as HTMLElement;
      if (widget) widget.style.display = 'none';
      const canvas = await html2canvas(document.body, {
        useCORS: true, scale: 1, logging: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: window.innerHeight,
      });
      if (widget) widget.style.display = '';
      const dataUrl = canvas.toDataURL('image/png');
      setAnnotationImg(dataUrl);
      setAnnotating(true);
      setShapes([]);
      setCurrentPoints([]);
    } catch (err) {
      console.error('Screenshot failed:', err);
      alert('צילום מסך נכשל. נסה Win+Shift+S → Ctrl+V');
    } finally {
      setScreenshotting(false);
    }
  }, []);

  // Annotation – draw on canvas
  const redrawAnnotations = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement, extraShape?: AnnotationShape) => {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const allShapes = extraShape ? [...shapes, extraShape] : shapes;
    for (const s of allShapes) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (s.tool === 'rect' && s.points.length === 2) {
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
        // Arrowhead
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const headLen = 16;
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (s.tool === 'freehand' && s.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      } else if (s.tool === 'text' && s.points.length === 1 && s.text) {
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, s.points[0].x, s.points[0].y);
      }
    }
  }, [shapes]);

  // Load image and redraw when annotating
  useEffect(() => {
    if (!annotating || !annotationImg || !annotationCanvasRef.current) return;
    const canvas = annotationCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const maxW = Math.min(window.innerWidth - 40, 900);
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      redrawAnnotations(ctx, canvas.width, canvas.height, img);
    };
    img.src = annotationImg;
  }, [annotating, annotationImg, shapes, redrawAnnotations]);

  const getCanvasCoords = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = annotationCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleAnnotationMouseDown = (e: React.MouseEvent) => {
    if (annotationTool === 'text') {
      const pt = getCanvasCoords(e);
      const text = prompt('הכנס טקסט:');
      if (text) {
        setShapes(prev => [...prev, { tool: 'text', points: [pt], color: annotationColor, text }]);
      }
      return;
    }
    setDrawing(true);
    const pt = getCanvasCoords(e);
    setCurrentPoints([pt]);
  };

  const handleAnnotationMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const pt = getCanvasCoords(e);
    if (annotationTool === 'freehand') {
      setCurrentPoints(prev => [...prev, pt]);
    } else {
      setCurrentPoints(prev => [prev[0], pt]);
    }
    // Live preview
    const canvas = annotationCanvasRef.current;
    if (!canvas || !annotationImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const currentShape: AnnotationShape = {
        tool: annotationTool,
        points: annotationTool === 'freehand' ? [...currentPoints, pt] : [currentPoints[0], pt],
        color: annotationColor,
      };
      redrawAnnotations(ctx, canvas.width, canvas.height, img, currentShape);
    };
    img.src = annotationImg;
  };

  const handleAnnotationMouseUp = () => {
    if (!drawing) return;
    setDrawing(false);
    if (currentPoints.length >= 2 || (annotationTool === 'freehand' && currentPoints.length > 1)) {
      setShapes(prev => [...prev, { tool: annotationTool, points: [...currentPoints], color: annotationColor }]);
    }
    setCurrentPoints([]);
  };

  const undoAnnotation = () => setShapes(prev => prev.slice(0, -1));

  const saveAnnotation = async () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const fname = await uploadFile(blob, `screenshot-${Date.now()}.png`);
    if (fname) setPendingAttachments(prev => [...prev, fname]);
    setAnnotating(false);
    setAnnotationImg(null);
    setShapes([]);
  };

  const cancelAnnotation = () => {
    setAnnotating(false);
    setAnnotationImg(null);
    setShapes([]);
  };

  // --- Element Picker ---
  const getCssSelector = useCallback((el: HTMLElement): string => {
    if (el.id) return `#${el.id}`;
    const parts: string[] = [];
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.body) {
      let selector = cur.tagName.toLowerCase();
      if (cur.id) { parts.unshift(`#${cur.id}`); break; }
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.trim().split(/\s+/).filter(c => !c.startsWith('hover') && c.length < 40).slice(0, 2);
        if (cls.length) selector += '.' + cls.join('.');
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === cur!.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(cur) + 1;
          selector += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(selector);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }, []);

  const getElementInfo = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/) : [],
      text: el.innerText?.slice(0, 200) || undefined,
      selector: getCssSelector(el),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      styles: {
        color: cs.color,
        background: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        display: cs.display,
        position: cs.position,
      },
      attrs: Object.fromEntries(
        Array.from(el.attributes)
          .filter(a => !['class', 'style', 'id'].includes(a.name))
          .slice(0, 10)
          .map(a => [a.name, a.value.slice(0, 100)])
      ),
    };
  }, [getCssSelector]);

  const startPicker = useCallback(() => {
    setPicking(true);
    setHoveredEl(null);
  }, []);

  const handlePickerMove = useCallback((e: React.MouseEvent) => {
    if (!picking) return;
    // hide overlay temporarily to find real element
    const overlay = pickerOverlayRef.current;
    if (overlay) overlay.style.pointerEvents = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (overlay) overlay.style.pointerEvents = 'auto';

    if (target && target !== hoveredEl) {
      // Remove old highlight
      if (hoveredEl) {
        hoveredEl.style.outline = hoveredEl.dataset.prevOutline || '';
        hoveredEl.style.outlineOffset = hoveredEl.dataset.prevOutlineOffset || '';
        delete hoveredEl.dataset.prevOutline;
        delete hoveredEl.dataset.prevOutlineOffset;
      }
      // Apply new highlight
      target.dataset.prevOutline = target.style.outline;
      target.dataset.prevOutlineOffset = target.style.outlineOffset;
      target.style.outline = '3px solid #f43f5e';
      target.style.outlineOffset = '2px';
      setHoveredEl(target);
    }
  }, [picking, hoveredEl]);

  const handlePickerClick = useCallback(async (e: React.MouseEvent) => {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();

    // Get real element
    const overlay = pickerOverlayRef.current;
    if (overlay) overlay.style.pointerEvents = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (overlay) overlay.style.pointerEvents = 'auto';

    // Clean up highlight
    if (hoveredEl) {
      hoveredEl.style.outline = hoveredEl.dataset.prevOutline || '';
      hoveredEl.style.outlineOffset = hoveredEl.dataset.prevOutlineOffset || '';
      delete hoveredEl.dataset.prevOutline;
      delete hoveredEl.dataset.prevOutlineOffset;
    }
    setPicking(false);
    setHoveredEl(null);

    if (!target) return;

    const info = getElementInfo(target);
    const content = `🎯 סימנתי אלמנט:\n` +
      `Tag: <${info.tag}>${info.id ? ` #${info.id}` : ''}\n` +
      `Selector: ${info.selector}\n` +
      `Text: ${info.text ? '"' + info.text.slice(0, 80) + '"' : '(ריק)'}\n` +
      `Rect: ${info.rect.w}×${info.rect.h} at (${info.rect.x}, ${info.rect.y})\n` +
      `Classes: ${info.classes.length ? info.classes.join(' ') : 'none'}`;

    const context = {
      ...gatherPageContext(),
      pickedElement: info,
    };

    try {
      await fetch('/__dev-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, context }),
      });
    } catch { /* ignore */ }
  }, [picking, hoveredEl, getElementInfo, gatherPageContext]);

  const cancelPicker = useCallback(() => {
    if (hoveredEl) {
      hoveredEl.style.outline = hoveredEl.dataset.prevOutline || '';
      hoveredEl.style.outlineOffset = hoveredEl.dataset.prevOutlineOffset || '';
      delete hoveredEl.dataset.prevOutline;
      delete hoveredEl.dataset.prevOutlineOffset;
    }
    setPicking(false);
    setHoveredEl(null);
  }, [hoveredEl]);

  // --- Grid overlay logic ---
  const toggleGrid = useCallback(() => {
    setGridActive(prev => !prev);
    setMarkedCells(new Set());
    setHoveredCell(null);
  }, []);

  const getCellKey = (col: number, row: number) => `${col},${row}`;

  const handleGridCellDblClick = useCallback(async (col: number, row: number) => {
    const key = getCellKey(col, row);
    const updated = new Set(markedCells);
    if (updated.has(key)) {
      updated.delete(key);
    } else {
      updated.add(key);
    }
    setMarkedCells(updated);
  }, [markedCells]);

  const sendMarkedCells = useCallback(async () => {
    if (markedCells.size === 0) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cols = Math.ceil(vw / gridSize);
    const rows = Math.ceil(vh / gridSize);
    const cells = Array.from(markedCells).map(key => {
      const [c, r] = key.split(',').map(Number);
      return {
        col: c, row: r,
        x: c * gridSize,
        y: r * gridSize + Math.round(window.scrollY),
        w: gridSize,
        h: gridSize,
      };
    });

    const content = `📐 סימנתי ${cells.length} אזור/ים בגריד (${gridSize}×${gridSize}px, ${cols}×${rows} תאים):\n` +
      cells.map((c, i) => `${i + 1}. תא [${c.col},${c.row}] → מיקום (${c.x}, ${c.y}) גודל ${c.w}×${c.h}px`).join('\n');

    const context = {
      ...gatherPageContext(),
      gridInfo: { cellSize: gridSize, cols, rows, viewport: { w: vw, h: vh }, markedCells: cells },
    };

    try {
      await fetch('/__dev-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, context }),
      });
    } catch { /* ignore */ }

    setGridActive(false);
    setMarkedCells(new Set());
  }, [markedCells, gridSize, gatherPageContext]);

  // ESC cancels picker, annotation, or grid
  useEffect(() => {
    if (!picking && !annotating && !gridActive) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (picking) cancelPicker();
        if (annotating) cancelAnnotation();
        if (gridActive) { setGridActive(false); setMarkedCells(new Set()); }
      }
      // Ctrl+Z undo in annotation mode
      if (annotating && e.ctrlKey && e.key === 'z') {
        undoAnnotation();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [picking, annotating, gridActive, cancelPicker]);

  // Console error forwarding
  useEffect(() => {
    const origError = console.error;
    const errors: string[] = [];
    let timeout: ReturnType<typeof setTimeout>;
    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      // Skip React dev warnings and polling errors
      if (msg.includes('Warning:') || msg.includes('__dev-chat')) return;
      errors.push(msg.slice(0, 300));
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        if (errors.length === 0) return;
        const batch = errors.splice(0);
        try {
          await fetch('/__dev-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🔴 Console Errors (${batch.length}):\n${batch.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
              context: { url: window.location.href, title: document.title },
              role: 'system',
            }),
          });
        } catch { /* ignore */ }
      }, 3000);
    };
    return () => { console.error = origError; };
  }, []);

  // Paste images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const fname = await uploadFile(file, `paste-${Date.now()}.png`);
          if (fname) setPendingAttachments(prev => [...prev, fname]);
        }
        return;
      }
    }
  }, [uploadFile]);

  // Drag & drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) {
      const fname = await uploadFile(file, file.name);
      if (fname) setPendingAttachments(prev => [...prev, fname]);
    }
  }, [uploadFile]);

  // File select
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of files) {
      const fname = await uploadFile(file, file.name);
      if (fname) setPendingAttachments(prev => [...prev, fname]);
    }
    e.target.value = '';
  }, [uploadFile]);

  // Send message
  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if ((!content && pendingAttachments.length === 0) || sending) return;
    setSending(true);
    const context = gatherPageContext();
    const attachments = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    setInput('');
    setPendingAttachments([]);
    try {
      await fetch('/__dev-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content || '(צירוף קובץ)', context, attachments }),
      });
    } catch { /* ignore */ }
    finally { setSending(false); }
  }, [input, sending, gatherPageContext, pendingAttachments]);

  const clearChat = useCallback(async () => {
    await fetch('/__dev-chat/clear', { method: 'POST' });
    setMessages([]);
    lastCountRef.current = 0;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const removeAttachment = (idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Rich text rendering for assistant messages
  const renderRichText = (text: string, role: string) => {
    if (role !== 'assistant') return text;
    // Split into code blocks and regular text
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, ''); // strip language hint
        return <pre key={i} style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', margin: '4px 0', direction: 'ltr', textAlign: 'left' }}>{code}</pre>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 3, fontSize: 11, fontFamily: 'monospace', direction: 'ltr' }}>{part.slice(1, -1)}</code>;
      }
      // Bold **text**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/);
      return boldParts.map((bp, j) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>;
        }
        return <span key={`${i}-${j}`}>{bp}</span>;
      });
    });
  };

  // Bubble style
  const bubbleStyle = (role: string): React.CSSProperties => ({
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    maxWidth: '85%',
    padding: '8px 14px',
    borderRadius: role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
    background: role === 'user'
      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
      : role === 'assistant'
        ? 'linear-gradient(135deg, #059669, #10b981)'
        : role === 'system'
          ? 'rgba(239,68,68,0.15)'
          : 'rgba(255,255,255,0.08)',
    color: role === 'system' ? '#fca5a5' : (role === 'user' || role === 'assistant') ? '#fff' : '#aaa',
    fontSize: role === 'system' ? 11 : 13,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    border: role === 'system' ? '1px solid rgba(239,68,68,0.3)' : undefined,
  });

  // --- Grid overlay ---
  const gridOverlay = gridActive ? (() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cols = Math.ceil(vw / gridSize);
    const rows = Math.ceil(vh / gridSize);
    const cells: { col: number; row: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ col: c, row: r });
      }
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999998, pointerEvents: 'none' }}>
        {/* Grid toolbar */}
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30,30,46,0.95)', color: '#fff',
          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999999,
          fontFamily: 'system-ui, sans-serif', direction: 'rtl',
          pointerEvents: 'auto',
        }}>
          <span>📐 גריד {cols}×{rows}</span>
          <span style={{ color: '#888', fontSize: 11 }}>גודל תא:</span>
          <input type="range" min={30} max={200} step={10} value={gridSize}
            onChange={e => { setGridSize(Number(e.target.value)); setMarkedCells(new Set()); }}
            style={{ width: 100, accentColor: '#8b5cf6' }}
          />
          <span style={{ fontSize: 12, color: '#a5b4fc', minWidth: 40 }}>{gridSize}px</span>
          {markedCells.size > 0 && (
            <button onClick={sendMarkedCells}
              style={{ background: 'rgba(16,185,129,0.7)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >✅ שלח {markedCells.size} תאים</button>
          )}
          <button onClick={() => { setGridActive(false); setMarkedCells(new Set()); }}
            style={{ background: 'rgba(244,63,94,0.7)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
          >✕ סגור (Esc)</button>
        </div>
        {/* Grid cells */}
        {cells.map(({ col, row }) => {
          const key = getCellKey(col, row);
          const isMarked = markedCells.has(key);
          const isHovered = hoveredCell === key;
          return (
            <div
              key={key}
              onDoubleClick={(e) => { e.preventDefault(); handleGridCellDblClick(col, row); }}
              onMouseEnter={() => setHoveredCell(key)}
              onMouseLeave={() => setHoveredCell(null)}
              style={{
                position: 'fixed',
                left: col * gridSize,
                top: row * gridSize,
                width: gridSize,
                height: gridSize,
                border: '1px solid rgba(139,92,246,0.35)',
                background: isMarked
                  ? 'rgba(244,63,94,0.25)'
                  : isHovered
                    ? 'rgba(99,102,241,0.12)'
                    : 'transparent',
                pointerEvents: 'auto',
                cursor: 'pointer',
                transition: 'background 0.15s',
                boxSizing: 'border-box',
              }}
            >
              {/* Cell label */}
              <span style={{
                position: 'absolute', top: 2, right: 3,
                fontSize: 9, color: isMarked ? '#f43f5e' : 'rgba(139,92,246,0.5)',
                fontFamily: 'monospace', fontWeight: isMarked ? 700 : 400,
                pointerEvents: 'none', userSelect: 'none',
              }}>{col},{row}</span>
              {isMarked && (
                <span style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, pointerEvents: 'none',
                }}>📌</span>
              )}
            </div>
          );
        })}
      </div>
    );
  })() : null;

  // --- Annotation overlay ---
  const annotationOverlay = annotating ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999999,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px', alignItems: 'center',
        background: 'rgba(30,30,46,0.95)', borderRadius: '0 0 12px 12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginLeft: 10 }}>✏️ סמן על הצילום</span>
        {(['rect', 'circle', 'arrow', 'freehand', 'text'] as AnnotationTool[]).map(t => (
          <button key={t} onClick={() => setAnnotationTool(t)}
            style={{
              background: annotationTool === t ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
              border: annotationTool === t ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.2)',
              color: '#fff', borderRadius: 6, padding: '5px 10px',
              cursor: 'pointer', fontSize: 13,
            }}>
            {{ rect: '▭', circle: '○', arrow: '→', freehand: '✏️', text: 'T' }[t]}
          </button>
        ))}
        <span style={{ color: '#666', margin: '0 4px' }}>|</span>
        {['#f43f5e', '#22c55e', '#3b82f6', '#eab308', '#fff'].map(c => (
          <button key={c} onClick={() => setAnnotationColor(c)}
            style={{
              width: 22, height: 22, borderRadius: '50%', background: c,
              border: annotationColor === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
            }} />
        ))}
        <span style={{ color: '#666', margin: '0 4px' }}>|</span>
        <button onClick={undoAnnotation} style={annotToolBtn} title="Ctrl+Z">↩️</button>
        <button onClick={saveAnnotation} style={{ ...annotToolBtn, background: 'rgba(16,185,129,0.6)' }}>✅ שמור</button>
        <button onClick={cancelAnnotation} style={{ ...annotToolBtn, background: 'rgba(239,68,68,0.5)' }}>✕ ביטול</button>
      </div>
      {/* Canvas */}
      <div ref={annotationContainerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
        <canvas
          ref={annotationCanvasRef}
          onMouseDown={handleAnnotationMouseDown}
          onMouseMove={handleAnnotationMouseMove}
          onMouseUp={handleAnnotationMouseUp}
          onMouseLeave={handleAnnotationMouseUp}
          style={{
            cursor: annotationTool === 'text' ? 'text' : 'crosshair',
            borderRadius: 8, boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
            maxWidth: '100%', maxHeight: '100%',
          }}
        />
      </div>
    </div>
  ) : null;

  // --- Picker overlay (full page, above everything) ---
  const pickerOverlay = picking ? (
    <div
      ref={pickerOverlayRef}
      onMouseMove={handlePickerMove}
      onClick={handlePickerClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999999,
        cursor: 'crosshair',
        background: 'rgba(0,0,0,0.05)',
      }}
    >
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(30,30,46,0.95)', color: '#fff',
        padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'system-ui, sans-serif', direction: 'rtl',
      }}>
        🎯 לחץ על אלמנט כדי לסמן אותו
        <button onClick={(e) => { e.stopPropagation(); cancelPicker(); }}
          style={{ background: 'rgba(244,63,94,0.8)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
        >ביטול (Esc)</button>
      </div>
      {hoveredEl && (() => {
        const r = hoveredEl.getBoundingClientRect();
        return (
          <div style={{
            position: 'fixed', left: r.left - 2, top: r.bottom + 6,
            background: 'rgba(30,30,46,0.92)', color: '#e0e0e0',
            padding: '4px 10px', borderRadius: 6, fontSize: 11,
            fontFamily: 'monospace', whiteSpace: 'nowrap', direction: 'ltr',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            pointerEvents: 'none', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {'<'}{hoveredEl.tagName.toLowerCase()}
            {hoveredEl.id ? ` #${hoveredEl.id}` : ''}
            {hoveredEl.className && typeof hoveredEl.className === 'string' ? ` .${hoveredEl.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}
            {'>'}
          </div>
        );
      })()}
    </div>
  ) : null;

  // --- Floating button ---
  if (!isOpen) {
    return (
      <>{pickerOverlay}{annotationOverlay}{gridOverlay}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 140,
          left: 20,
          zIndex: 999999,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        title="Dev Chat – דבר עם קופיילוט"
      >
        💬
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 22, height: 22, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #1e1e2e',
          }}>{unread}</span>
        )}
      </button>
      </>
    );
  }

  // --- Chat panel ---
  return (
    <>{pickerOverlay}{annotationOverlay}{gridOverlay}
    <div
      data-dev-chat-widget
      style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 999999,
        width: 400, maxHeight: '75vh',
        display: 'flex', flexDirection: 'column',
        background: '#1e1e2e', borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        border: '1px solid rgba(99,102,241,0.3)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        direction: 'rtl', overflow: 'hidden',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(99,102,241,0.3)', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 16, border: '3px dashed #8b5cf6',
        }}>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>📎 שחרר כאן</span>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff',
      }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>💬 Dev Chat · Copilot</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={clearChat} style={headerBtn} title="נקה היסטוריה">🗑️</button>
          <button onClick={() => setIsOpen(false)} style={{ ...headerBtn, fontSize: 16, lineHeight: '1' }}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: 220, maxHeight: '55vh',
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', padding: 16, fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <strong>דבר עם קופיילוט ישירות מהדף</strong>
            <br /><br />
            <span style={{ fontSize: 12, color: '#666' }}>
              כתוב מה רוצה לשנות, צרף צילום מסך,<br />
              וקופיילוט יענה ישירות כאן.<br /><br />
              📸 צילום מסך + סימונים (▭ ○ → ✏️)<br />
              🎯 סמן אלמנט בעמוד<br />
              � גריד + סליידר (לחיצה כפולה לסימון)<br />
              �📎 קבצים: גרור לכאן או לחץ 📎<br />
              🔴 שגיאות קונסול נשלחות אוטומטית
            </span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontSize: 10,
              color: msg.role === 'assistant' ? '#34d399' : msg.role === 'user' ? '#a5b4fc' : '#666',
              marginBottom: 2,
              textAlign: msg.role === 'user' ? 'left' : 'right',
            }}>
              {msg.role === 'assistant' ? '🤖 Copilot' : msg.role === 'user' ? '👤 אתה' : msg.role === 'system' ? '🔴 Console' : ''}
            </div>
            <div style={bubbleStyle(msg.role)}>
              {renderRichText(msg.content, msg.role)}
              {msg.attachments?.map((fname, j) => (
                <div key={j} style={{ marginTop: 8 }}>
                  <img
                    src={`/__dev-chat/attachments/${fname}`}
                    alt={fname}
                    style={{
                      maxWidth: '100%', maxHeight: 200,
                      borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                    }}
                    onClick={() => window.open(`/__dev-chat/attachments/${fname}`, '_blank')}
                  />
                </div>
              ))}
            </div>
            <div style={{
              fontSize: 9, color: '#555',
              textAlign: msg.role === 'user' ? 'left' : 'right',
              marginTop: 2,
            }}>
              {new Date(msg.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div style={{
          padding: '6px 14px', display: 'flex', gap: 6, flexWrap: 'wrap',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {pendingAttachments.map((fname, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={`/__dev-chat/attachments/${fname}`}
                alt=""
                style={{
                  width: 48, height: 48, objectFit: 'cover',
                  borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)',
                }}
              />
              <button
                onClick={() => removeAttachment(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#ef4444', color: '#fff', border: 'none',
                  fontSize: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', gap: 6, alignItems: 'flex-end',
      }}>
        <input ref={fileInputRef} type="file"
          accept="image/*,.pdf,.json,.txt,.tsx,.ts,.css,.html"
          multiple style={{ display: 'none' }} onChange={handleFileSelect} />
        <button onClick={() => fileInputRef.current?.click()} style={actionBtn} title="צרף קובץ">📎</button>
        <button onClick={captureScreenshot} disabled={screenshotting} style={{ ...actionBtn, opacity: screenshotting ? 0.5 : 1 }} title="צלם מסך + סימונים">{screenshotting ? '⏳' : '📸'}</button>
        <button onClick={startPicker} style={{ ...actionBtn, background: picking ? 'rgba(244,63,94,0.3)' : undefined }} title="סמן אלמנט בעמוד">🎯</button>
        <button onClick={toggleGrid} style={{ ...actionBtn, background: gridActive ? 'rgba(139,92,246,0.3)' : undefined }} title="גריד - סמן אזורים (לחיצה כפולה)">📐</button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="כתוב הודעה... (Ctrl+V לתמונה)"
          rows={1}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10, padding: '9px 12px',
            color: '#e0e0e0', fontSize: 13,
            resize: 'none', outline: 'none',
            fontFamily: 'inherit', direction: 'rtl',
            minHeight: 38, maxHeight: 100,
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, 100) + 'px';
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || (!input.trim() && pendingAttachments.length === 0)}
          style={{
            background: (sending || (!input.trim() && pendingAttachments.length === 0))
              ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', borderRadius: 10,
            padding: '9px 14px', color: '#fff',
            cursor: (sending || (!input.trim() && pendingAttachments.length === 0))
              ? 'not-allowed' : 'pointer',
            fontSize: 15, flexShrink: 0,
          }}
          title="שלח (Enter)"
        >{sending ? '⏳' : '📤'}</button>
      </div>
    </div>
    </>
  );
}

const headerBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
  borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12,
};

const actionBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px', cursor: 'pointer',
  fontSize: 14, flexShrink: 0,
};

const annotToolBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff', borderRadius: 6, padding: '5px 10px',
  cursor: 'pointer', fontSize: 12,
};
