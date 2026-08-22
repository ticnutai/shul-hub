import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Eye, EyeOff, Pause, Play, Redo2, RotateCcw, Save, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VisualColorPicker } from "@/components/VisualColorPicker";

type Scope = "element" | "component" | "global";
type Override = {
  id: string;
  scope: Scope;
  selector: string;
  label: string;
  css: Record<string, string>;
  createdAt: string;
};
type Layout = { x: number; y: number; width: number; height: number };
type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const OVERRIDES_KEY = "shul-live-design-overrides-v1";
const LAYOUT_KEY = "shul-live-design-layout-v1";
const emptyCss = {
  color: "",
  backgroundColor: "",
  borderColor: "",
  fontFamily: "",
  fontSize: "",
  fontWeight: "",
  lineHeight: "",
  letterSpacing: "",
  wordSpacing: "",
  textAlign: "",
  padding: "",
  margin: "",
  borderWidth: "",
  borderRadius: "",
  maxWidth: "",
  opacity: "",
  boxShadow: "",
};

type CssDraft = typeof emptyCss;

const LiveDesignContext = createContext({
  enabled: false,
  paused: false,
  enable: () => {},
  disable: () => {},
  togglePaused: () => {},
});

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function defaultLayout(): Layout {
  if (typeof window === "undefined") return { x: 16, y: 80, width: 560, height: 720 };
  const width = Math.min(560, Math.max(300, window.innerWidth - 32));
  const mobile = window.innerWidth < 640;
  const height = mobile
    ? Math.min(360, Math.max(300, Math.floor(window.innerHeight * 0.42)))
    : Math.min(820, Math.max(300, window.innerHeight - 105));
  return {
    x: mobile ? Math.max(8, Math.floor((window.innerWidth - width) / 2)) : 16,
    y: mobile ? Math.max(8, window.innerHeight - height - 8) : 80,
    width,
    height,
  };
}

function loadLayout(): Layout {
  const fallback = defaultLayout();
  const saved = readJson<Partial<Layout>>(LAYOUT_KEY, {});
  const mobile = typeof window !== "undefined" && window.innerWidth < 640;
  const maxWidth = typeof window === "undefined" ? 560 : Math.max(300, window.innerWidth - 16);
  const width = Math.min(
    maxWidth,
    Math.max(Math.min(480, maxWidth), Number(saved.width) || fallback.width),
  );
  const maxHeight =
    typeof window === "undefined"
      ? 820
      : mobile
        ? Math.min(360, Math.floor(window.innerHeight * 0.42))
        : window.innerHeight - 16;
  const height = Math.min(maxHeight, Math.max(300, Number(saved.height) || fallback.height));
  return {
    x: Math.max(8, Math.min(Number(saved.x) || fallback.x, maxWidth - width + 8)),
    y: Math.max(
      8,
      Math.min(
        Number(saved.y) || fallback.y,
        (typeof window === "undefined" ? 900 : window.innerHeight) - 80,
      ),
    ),
    width,
    height,
  };
}

function cssText(css: Record<string, string>) {
  const entries = Object.entries(css).filter(([, value]) => value.trim());
  // A solid background must cover the whole element, so any inherited gradient/image is cleared.
  if (entries.some(([key]) => key === "backgroundColor")) entries.push(["backgroundImage", "none"]);
  return entries
    .map(
      ([key, value]) =>
        `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value} !important`,
    )
    .join(";");
}

function persistedRules(overrides: Override[]) {
  return overrides.map((item) => `${item.selector}{${cssText(item.css)}}`).join("\n");
}

function escapeCss(value: string) {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function exactSelector(element: HTMLElement) {
  if (element.id) return `#${escapeCss(element.id)}`;
  const testId = element.dataset["testid"];
  if (testId) return `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body && parts.length < 5) {
    let part = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter(
          (node) => node.tagName === current!.tagName,
        )
      : [];
    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    parts.unshift(part);
    current = current.parentElement;
  }
  return `body > ${parts.join(" > ")}`;
}

const utilityClass =
  /^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|items-|justify-|gap-|space-|p[trblxy]?-|m[trblxy]?-|w-|h-|min-|max-|text-|font-|leading-|tracking-|bg-|border|rounded|shadow|overflow|z-|top-|bottom-|left-|right-|sm:|md:|lg:|xl:|hover:|focus:|data-)/;

function componentSelector(element: HTMLElement) {
  const identity = Array.from(element.classList).filter(
    (name) => !utilityClass.test(name) && !name.includes("[") && !name.includes(":"),
  );
  return identity.length
    ? `${element.tagName.toLowerCase()}.${identity.slice(0, 2).map(escapeCss).join(".")}`
    : exactSelector(element);
}

function globalSelector(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();
  return /^(h1|h2|h3|p|a|button|input|textarea|label|header|footer|nav|main|section|article)$/.test(
    tag,
  )
    ? tag
    : componentSelector(element);
}

function labelFor(element: HTMLElement) {
  const text = element.innerText?.trim().replace(/\s+/g, " ").slice(0, 42);
  return text || element.getAttribute("aria-label") || element.tagName.toLowerCase();
}

function draftFrom(element: HTMLElement): CssDraft {
  const style = getComputedStyle(element);
  return {
    color: style.color,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
    textAlign: ["right", "center", "left", "justify"].includes(style.textAlign)
      ? style.textAlign
      : "right",
    padding: style.padding,
    margin: style.margin,
    borderWidth: style.borderWidth,
    borderRadius: style.borderRadius,
    maxWidth: style.maxWidth,
    opacity: style.opacity,
    boxShadow: style.boxShadow,
  };
}

export function LiveDesignProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<CssDraft>(emptyCss);
  const [scope, setScope] = useState<Scope>("element");
  const [overrides, setOverrides] = useState<Override[]>(() => readJson(OVERRIDES_KEY, []));
  const [history, setHistory] = useState<Override[][]>([]);
  const [future, setFuture] = useState<Override[][]>([]);
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const bypass = useRef(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const resize = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    layout: Layout;
  } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const disable = useCallback(() => {
    setEnabled(false);
    setPaused(false);
    setSelected(null);
    setHovered(null);
  }, []);

  const updateUrl = useCallback((active: boolean) => {
    const url = new URL(window.location.href);
    if (active) url.searchParams.set("designMode", "1");
    else url.searchParams.delete("designMode");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const enable = useCallback(() => {
    setEnabled(true);
    setPaused(false);
    updateUrl(true);
  }, [updateUrl]);

  useEffect(() => {
    if (new URL(window.location.href).searchParams.get("designMode") === "1") setEnabled(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    const style =
      document.getElementById("design-mode-overrides") ?? document.createElement("style");
    style.id = "design-mode-overrides";
    style.textContent = persistedRules(overrides);
    if (!style.parentNode) document.head.appendChild(style);
  }, [overrides]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    if (!enabled || !editorRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const box = editorRef.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      setLayout((current) =>
        current.width === width && current.height === height
          ? current
          : { ...current, width, height },
      );
    });
    observer.observe(editorRef.current);
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    document
      .querySelectorAll("[data-live-design-selected]")
      .forEach((node) => node.removeAttribute("data-live-design-selected"));
    const style =
      document.getElementById("design-mode-live-preview") ?? document.createElement("style");
    style.id = "design-mode-live-preview";
    if (selected) {
      selected.setAttribute("data-live-design-selected", "true");
      style.textContent = `[data-live-design-selected="true"]{${cssText(draft)}}`;
    } else style.textContent = "";
    if (!style.parentNode) document.head.appendChild(style);
    return () => selected?.removeAttribute("data-live-design-selected");
  }, [draft, selected]);

  useEffect(() => {
    if (!enabled) return;
    const isUi = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest("[data-design-mode-ui]");
    const move = (event: MouseEvent) => {
      if (!paused && !isUi(event.target)) setHovered(event.target as HTMLElement);
    };
    const down = (event: PointerEvent) => {
      if (paused || isUi(event.target)) return;
      if (event.altKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const element = event.target as HTMLElement;
      setSelected(element);
      setDraft(draftFrom(element));
      setHovered(element);
    };
    const click = (event: MouseEvent) => {
      if (paused || isUi(event.target)) return;
      if (bypass.current) {
        bypass.current = false;
        return;
      }
      if (event.altKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = event.target as HTMLElement;
        bypass.current = true;
        queueMicrotask(() =>
          target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
        );
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    document.addEventListener("mousemove", move, true);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("click", click, true);
    };
  }, [enabled, paused]);

  const undo = useCallback(() => {
    setHistory((items) => {
      const previous = items.at(-1);
      if (!previous) return items;
      setFuture((next) => [overrides, ...next]);
      setOverrides(previous);
      return items.slice(0, -1);
    });
  }, [overrides]);
  const redo = useCallback(() => {
    setFuture((items) => {
      const next = items[0];
      if (!next) return items;
      setHistory((previous) => [...previous, overrides]);
      setOverrides(next);
      return items.slice(1);
    });
  }, [overrides]);

  useEffect(() => {
    if (!enabled) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selected) setSelected(null);
        else {
          disable();
          updateUrl(false);
        }
      }
      if (!paused && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [disable, enabled, paused, redo, selected, undo, updateUrl]);

  const save = () => {
    if (!selected) return;
    const selector =
      scope === "element"
        ? exactSelector(selected)
        : scope === "component"
          ? componentSelector(selected)
          : globalSelector(selected);
    const next: Override = {
      id: crypto.randomUUID(),
      scope,
      selector,
      label: labelFor(selected),
      css: { ...draft },
      createdAt: new Date().toISOString(),
    };
    setHistory((items) => [...items, overrides]);
    setFuture([]);
    setOverrides((items) => [...items, next]);
    setSelected(null);
  };

  const clear = () => {
    if (!overrides.length || !window.confirm("למחוק את כל שינויי העיצוב השמורים?")) return;
    setHistory((items) => [...items, overrides]);
    setFuture([]);
    setOverrides([]);
    setSelected(null);
  };

  const startDrag = (event: ReactPointerEvent) => {
    if ((event.target as Element).closest("button")) return;
    drag.current = { dx: event.clientX - layout.x, dy: event.clientY - layout.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragMove = (event: ReactPointerEvent) => {
    const origin = drag.current;
    if (!origin) return;
    const nextX = Math.max(8, Math.min(event.clientX - origin.dx, window.innerWidth - 80));
    const nextY = Math.max(8, Math.min(event.clientY - origin.dy, window.innerHeight - 56));
    setLayout((current) => ({ ...current, x: nextX, y: nextY }));
  };

  const startResize = (edge: ResizeEdge, event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resize.current = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      layout: { ...layout },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizeMove = (event: ReactPointerEvent) => {
    const operation = resize.current;
    if (!operation) return;
    const dx = event.clientX - operation.startX;
    const dy = event.clientY - operation.startY;
    const minWidth = Math.min(480, window.innerWidth - 16);
    const minHeight = Math.min(300, window.innerHeight - 16);
    const maxWidth = window.innerWidth - 16;
    const maxHeight = window.innerHeight - 16;
    let { x, y, width, height } = operation.layout;

    if (operation.edge.includes("e")) width = operation.layout.width + dx;
    if (operation.edge.includes("s")) height = operation.layout.height + dy;
    if (operation.edge.includes("w")) {
      width = operation.layout.width - dx;
      x = operation.layout.x + dx;
    }
    if (operation.edge.includes("n")) {
      height = operation.layout.height - dy;
      y = operation.layout.y + dy;
    }

    width = Math.max(minWidth, Math.min(maxWidth, width));
    height = Math.max(minHeight, Math.min(maxHeight, height));
    if (operation.edge.includes("w")) x = operation.layout.x + operation.layout.width - width;
    if (operation.edge.includes("n")) y = operation.layout.y + operation.layout.height - height;
    x = Math.max(8, Math.min(x, window.innerWidth - width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - height - 8));
    setLayout({ x, y, width, height });
  };

  const endResize = () => {
    resize.current = null;
  };

  const highlight = paused ? null : (selected ?? hovered);
  const rect = highlight?.getBoundingClientRect();
  const value = useMemo(
    () => ({
      enabled,
      paused,
      enable,
      disable: () => {
        disable();
        updateUrl(false);
      },
      togglePaused: () => setPaused((item) => !item),
    }),
    [disable, enable, enabled, paused, updateUrl],
  );

  return (
    <LiveDesignContext.Provider value={value}>
      {children}
      {enabled && (
        <>
          {rect && (
            <div
              data-design-mode-ui
              className="pointer-events-none fixed z-[90] border-2 border-dashed border-blue-500 bg-blue-400/10"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
            >
              <span className="absolute -top-6 right-0 rounded bg-blue-600 px-2 py-0.5 text-xs text-white">
                {labelFor(highlight!)}
              </span>
            </div>
          )}
          <div
            data-design-mode-ui
            className="fixed bottom-4 right-4 z-[110] flex gap-1 rounded-xl border bg-card p-2 text-card-foreground shadow-xl"
          >
            <Button size="sm" variant="outline" onClick={() => setPaused((item) => !item)}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {paused ? "המשך בחירה" : "השהיה"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="יציאה ממצב עיצוב"
              onClick={value.disable}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div
            ref={editorRef}
            data-design-mode-ui
            data-testid="live-design-editor"
            role="dialog"
            aria-label="עורך עיצוב חי"
            dir="rtl"
            className="fixed z-[100] flex min-h-[min(300px,calc(100dvh-16px))] min-w-[min(480px,calc(100vw-16px))] overflow-visible rounded-2xl border bg-card text-card-foreground shadow-2xl"
            style={
              {
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
              } as CSSProperties
            }
            onPointerUp={() => {
              drag.current = null;
              const box = editorRef.current?.getBoundingClientRect();
              if (box)
                setLayout({
                  x: box.x,
                  y: box.y,
                  width: Math.round(box.width),
                  height: Math.round(box.height),
                });
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
              <div
                className="flex cursor-move items-center gap-1 border-b bg-muted px-2 py-2 sm:gap-2 sm:px-3"
                onPointerDown={startDrag}
                onPointerMove={dragMove}
                onPointerUp={() => {
                  drag.current = null;
                }}
              >
                <strong className="flex-1">עורך עיצוב חי</strong>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={paused ? "המשך" : "השהיה"}
                  onClick={() => setPaused((item) => !item)}
                >
                  {paused ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="ביטול פעולה"
                  disabled={!history.length}
                  onClick={undo}
                >
                  <Undo2 className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="ביצוע חוזר"
                  disabled={!future.length}
                  onClick={redo}
                >
                  <Redo2 className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="סגירת עורך העיצוב"
                  onClick={value.disable}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
                <div
                  role="tablist"
                  aria-label="היקף שמירה"
                  className="flex flex-1 gap-1 rounded-lg bg-muted p-1"
                >
                  {(
                    [
                      ["element", "רכיב מדויק"],
                      ["component", "רכיבים תואמים"],
                      ["global", "סוג גלובלי"],
                    ] as [Scope, string][]
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={scope === id}
                      onClick={() => setScope(id)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        scope === id
                          ? "bg-card text-card-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="היקף שמירה"
                  className="sr-only"
                  value={scope}
                  onChange={(event) => setScope(event.target.value as Scope)}
                >
                  <option value="element">רכיב מדויק</option>
                  <option value="component">רכיבים תואמים</option>
                  <option value="global">סוג גלובלי</option>
                </select>
                <Button size="sm" disabled={!selected} onClick={save}>
                  <Save className="size-4" /> שמירה
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  לחץ על רכיב בעמוד כדי לערוך. השהיה משחררת ניווט רגיל; Alt+לחיצה מפעילה רכיב פעם
                  אחת.
                </p>

                {!selected ? (
                  <div className="grid min-h-40 place-items-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                    {paused ? "העורך מושהה — לחץ המשך בחירה" : "בחר רכיב כלשהו בעמוד"}
                  </div>
                ) : (
                  <>
                    <div className="mb-4 rounded-lg bg-muted p-3 text-sm">
                      <strong>{labelFor(selected)}</strong>
                      <code className="mt-1 block truncate text-xs" dir="ltr">
                        {exactSelector(selected)}
                      </code>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ColorField
                        label="צבע טקסט"
                        value={draft.color}
                        onChange={(value) => setDraft({ ...draft, color: value })}
                        onConfirm={save}
                      />
                      <ColorField
                        label="רקע"
                        value={draft.backgroundColor}
                        onChange={(value) => setDraft({ ...draft, backgroundColor: value })}
                        onConfirm={save}
                      />
                      <ColorField
                        label="צבע מסגרת"
                        value={draft.borderColor}
                        onChange={(value) => setDraft({ ...draft, borderColor: value })}
                        onConfirm={save}
                      />
                      <Field
                        label="משפחת גופן"
                        value={draft.fontFamily}
                        onChange={(value) => setDraft({ ...draft, fontFamily: value })}
                      />
                      <Field
                        label="גודל גופן"
                        value={draft.fontSize}
                        onChange={(value) => setDraft({ ...draft, fontSize: value })}
                      />
                      <Field
                        label="משקל גופן"
                        value={draft.fontWeight}
                        onChange={(value) => setDraft({ ...draft, fontWeight: value })}
                      />
                      <Field
                        label="גובה שורה"
                        value={draft.lineHeight}
                        onChange={(value) => setDraft({ ...draft, lineHeight: value })}
                      />
                      <Field
                        label="ריווח אותיות"
                        value={draft.letterSpacing}
                        onChange={(value) => setDraft({ ...draft, letterSpacing: value })}
                      />
                      <Field
                        label="ריווח מילים"
                        value={draft.wordSpacing}
                        onChange={(value) => setDraft({ ...draft, wordSpacing: value })}
                      />
                      <Field
                        label="Padding"
                        value={draft.padding}
                        onChange={(value) => setDraft({ ...draft, padding: value })}
                      />
                      <Field
                        label="Margin"
                        value={draft.margin}
                        onChange={(value) => setDraft({ ...draft, margin: value })}
                      />
                      <Field
                        label="עובי מסגרת"
                        value={draft.borderWidth}
                        onChange={(value) => setDraft({ ...draft, borderWidth: value })}
                      />
                      <Field
                        label="עיגול פינות"
                        value={draft.borderRadius}
                        onChange={(value) => setDraft({ ...draft, borderRadius: value })}
                      />
                      <Field
                        label="רוחב מרבי"
                        value={draft.maxWidth}
                        onChange={(value) => setDraft({ ...draft, maxWidth: value })}
                      />
                      <Field
                        label="שקיפות"
                        value={draft.opacity}
                        onChange={(value) => setDraft({ ...draft, opacity: value })}
                      />
                      <Field
                        label="צל"
                        value={draft.boxShadow}
                        onChange={(value) => setDraft({ ...draft, boxShadow: value })}
                      />
                      <div className="space-y-1">
                        <Label>יישור</Label>
                        <select
                          aria-label="יישור"
                          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          value={draft.textAlign}
                          onChange={(event) =>
                            setDraft({ ...draft, textAlign: event.target.value })
                          }
                        >
                          <option value="right">ימין</option>
                          <option value="center">מרכז</option>
                          <option value="left">שמאל</option>
                          <option value="justify">מיושר</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <span className="text-xs text-muted-foreground">
                    {overrides.length} שינויים שמורים
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!overrides.length}
                    onClick={clear}
                  >
                    <RotateCcw className="size-4" /> איפוס הכול
                  </Button>
                </div>
              </div>
            </div>
            {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeEdge[]).map((edge) => (
              <button
                key={edge}
                type="button"
                data-testid={`live-design-resize-${edge}`}
                aria-label={`שינוי גודל העורך ${edge}`}
                onPointerDown={(event) => startResize(edge, event)}
                onPointerMove={resizeMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                className={
                  "absolute z-20 touch-none bg-transparent " +
                  (edge === "n" ? "-top-1 left-4 right-4 h-3 cursor-n-resize" : "") +
                  (edge === "s" ? "-bottom-1 left-4 right-4 h-3 cursor-s-resize" : "") +
                  (edge === "e" ? "-right-1 bottom-4 top-4 w-3 cursor-e-resize" : "") +
                  (edge === "w" ? "-left-1 bottom-4 top-4 w-3 cursor-w-resize" : "") +
                  (edge === "ne" ? "-right-1 -top-1 size-5 cursor-ne-resize" : "") +
                  (edge === "nw" ? "-left-1 -top-1 size-5 cursor-nw-resize" : "") +
                  (edge === "se" ? "-bottom-1 -right-1 size-5 cursor-se-resize" : "") +
                  (edge === "sw" ? "-bottom-1 -left-1 size-5 cursor-sw-resize" : "")
                }
              />
            ))}
          </div>
        </>
      )}
    </LiveDesignContext.Provider>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        aria-label={label}
        dir="ltr"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  onConfirm,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onConfirm?: (() => void) | undefined;
}) {
  return (
    <VisualColorPicker label={label} value={value} onChange={onChange} onConfirm={onConfirm} />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLiveDesign = () => useContext(LiveDesignContext);
