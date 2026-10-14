/**
 * The layers of a board of parts, as containers: each container a row that
 * opens to what is in it - its parts, and the containers standing in it - top
 * layer first, and the main background at the bottom, under them all.
 *
 * A container row chooses all of it, moves it a layer up or down, renames,
 * duplicates or deletes it, hides or locks all of it, puts it inside another
 * container, and gives it a frame or something new inside. The parts' own
 * rows are the list's own (`row`), so a part is the same wherever it shows.
 */
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, Copy, FolderPlus, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import type { BoardElement } from "@/tv/elements";
import { MAX_ELEMENTS, boundsOf, elementId, newElement } from "@/tv/elements";
import {
  changeContainer, containerTree, deleteContainer, descendants, duplicateContainer, gatherIntoContainer,
  moveLayer, partsOf, takeOut, writeContainers, type ContainerNode, type PartContainer,
} from "@/tv/containers";
import { showDesignTopic } from "./designTopics";
import { HideToggle, LockToggle, SELECT_CLASS, SIDE_BUTTON } from "./editorParts";

export type Board = { elements: BoardElement[]; containers: PartContainer[] };

export function ContainerLayers({ elements, containers, selected, select, edit, row }: {
  elements: BoardElement[];
  containers: PartContainer[];
  selected: string[];
  select: (ids: string[]) => void;
  /** A change to the board's parts and containers, as one step of the history. */
  edit: (key: string, change: (b: Board) => Board) => void;
  /** A part's own row of the list. */
  row: (e: BoardElement, inContainer: boolean) => ReactNode;
}) {
  const tree = containerTree(elements, containers);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [naming, setNaming] = useState<{ id: string; value: string } | null>(null);
  const index = new Map(elements.map((e, i) => [e.id, i]));
  const byId = new Map(elements.map((e) => [e.id, e]));
  const top = (ids: string[]) => Math.max(-1, ...ids.map((id) => index.get(id) ?? -1));
  const board = { elements, containers };

  /** What stands directly in a container (or on the background), top first. */
  const childrenOf = (parent: string | null) => {
    const kids: Array<{ key: string; top: number; node?: ContainerNode; part?: BoardElement }> = [
      ...tree.containers.filter((c) => c.parent === parent).map((c) => ({ key: c.id, top: top(partsOf(tree, c.id)), node: c })),
      ...(parent === null
        ? tree.loose.map((id) => ({ key: id, top: index.get(id) ?? -1, part: byId.get(id) }))
        : (tree.containers.find((c) => c.id === parent)?.parts ?? []).map((id) => ({ key: id, top: index.get(id) ?? -1, part: byId.get(id) }))),
    ];
    return kids.sort((a, b) => b.top - a.top);
  };

  /** A new container in the middle of the board: a board behind, a frame on it, a heading - chosen, to drag into place. */
  const newContainer = () => {
    if (elements.length + 3 > MAX_ELEMENTS) return void toast.error(`בלוח יש כבר ${elements.length} חלקים - עד ${MAX_ELEMENTS}.`);
    const id = `c_${elementId().slice(3, 40)}`;
    const at = { x: 35, y: 28, width: 30, height: 44 };
    const back = { ...newElement("box"), ...at, group: id, name: "לוח הקונטיינר", shape: "rounded" as const, fill: "#fff5dc" };
    const frame = { ...newElement("frame"), ...at, group: id, name: "מסגרת הקונטיינר", shape: "rounded" as const, color: "#c9a227" };
    const heading = { ...newElement("text"), x: at.x + 3, y: at.y + 4, width: at.width - 6, height: 9, group: id, name: "כותרת", text: "כותרת", color: "#5b3a12" };
    edit(`container-new:${id}`, (b) => {
      const w = writeContainers(b);
      return { elements: [...w.elements, back, frame, heading], containers: [...w.containers, { id, name: "קונטיינר חדש", parent: null }] };
    });
    select([back.id, frame.id, heading.id]);
    toast("נוסף קונטיינר באמצע הלוח, והוא בחור: גררו אותו למקום, ושנו לו צורה, מסגרת וטקסט.");
  };

  const gather = () => {
    let made = "";
    edit(`container-gather:${selected.join(",")}`, (b) => {
      const g = gatherIntoContainer(b, selected);
      made = g.id;
      return g;
    });
    if (made) toast("נוצר קונטיינר מהחלקים שבחרתם.");
  };

  const containerRow = (c: ContainerNode, depth: number): ReactNode => {
    const ids = partsOf(tree, c.id);
    const parts = ids.map((id) => byId.get(id)!).filter(Boolean);
    const all = ids.length > 0 && ids.every((id) => selected.includes(id));
    const open = !closed.has(c.id);
    const own = c.parts.map((id) => byId.get(id)!).filter(Boolean);
    // A drawn frame, or the frame of the kit's picture: either way it has one.
    const hasFrame = own.some((e) => e.kind === "frame" || (e.kind === "image" && /^(מסגרת|קשת)/.test(e.name)));
    const backing = own.find((e) => e.kind === "box") ?? own.find((e) => e.kind === "image");
    const setAll = (patch: Partial<BoardElement>, what: string) =>
      edit(`container-${what}:${c.id}`, (b) => ({ ...b, elements: b.elements.map((e) => (ids.includes(e.id) ? { ...e, ...patch } : e)) }));
    // Not inside itself, nor inside one of those inside it.
    const notInside = new Set([c.id, ...descendants(tree, c.id)]);
    const area = ids.length ? boundsOf(elements, ids) : { x: 35, y: 30, width: 30, height: 40 };
    /** Something new in the container: inside its area, over what is in it. */
    const addInside = (kind: BoardElement["kind"], more: Partial<BoardElement> = {}) => {
      const e = { ...newElement(kind), ...more, group: c.id };
      const box = kind === "frame" ? area : { x: area.x + area.width * 0.1, y: area.y + area.height * 0.1, width: area.width * 0.8, height: Math.min(area.height * 0.3, kind === "text" ? 10 : 20) };
      const part = { ...e, ...box };
      edit(`container-add:${c.id}:${kind}`, (b) => {
        // Written down first: the new part joins the container as it now is, never a second one of the same name.
        const w = writeContainers(b);
        const at = Math.max(-1, ...w.elements.map((x, i) => (ids.includes(x.id) ? i : -1)));
        return {
          ...w,
          // A frame goes over its board and under what is written on it; anything else over all of the container.
          elements: kind === "frame" && backing
            ? w.elements.flatMap((x) => (x.id === backing.id ? [x, part] : [x]))
            : [...w.elements.slice(0, at + 1), part, ...w.elements.slice(at + 1)],
        };
      });
      select([part.id]);
    };
    return (
      <div key={c.id} data-testid="container-row" data-container={c.id} className="space-y-1" style={{ marginInlineStart: depth * 14 }}>
        <div className={`flex flex-wrap items-center gap-1.5 rounded-md border-2 px-2 py-1 ${all ? "border-primary bg-primary/10" : "border-primary/25 bg-muted/40"}`}>
          <button type="button" className={SIDE_BUTTON} aria-label={`${open ? "סגירת" : "פתיחת"} הקונטיינר ${c.name}`} aria-expanded={open}
            onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}>
            {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
          </button>
          <input type="checkbox" className="size-4 shrink-0" aria-label={`בחירת הקונטיינר ${c.name}`} checked={all}
            onChange={(ev) => select(ev.target.checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)))} />
          {naming?.id === c.id ? (
            <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(ev) => {
              ev.preventDefault();
              const name = naming.value.trim().slice(0, 60);
              if (name) edit(`container-name:${c.id}`, (b) => changeContainer(b, c.id, { name }));
              setNaming(null);
            }}>
              <input autoFocus aria-label="שם הקונטיינר" value={naming.value} maxLength={60} onChange={(ev) => setNaming({ id: c.id, value: ev.target.value })}
                onKeyDown={(ev) => ev.key === "Escape" && setNaming(null)} className="h-7 min-w-0 flex-1 rounded border bg-background px-2 text-sm" />
              <button type="submit" className="h-7 rounded border bg-background px-2 text-xs">שמירה</button>
            </form>
          ) : (
            <button type="button" data-testid="container-name" className="min-w-0 flex-1 truncate text-right text-sm font-semibold" title="בוחר את כל הקונטיינר" onClick={() => select(ids)}>
              {c.name} <span className="text-xs font-normal text-muted-foreground">({parts.length})</span>
            </button>
          )}
          <span className="flex shrink-0 flex-wrap items-center gap-0.5">
            <button type="button" className={SIDE_BUTTON} aria-label={`שינוי השם של ${c.name}`} title="שינוי השם" onClick={() => setNaming({ id: c.id, value: c.name })}><Pencil className="size-4" aria-hidden /></button>
            <button type="button" className={SIDE_BUTTON} aria-label={`${c.name} שכבה למעלה`} title="שכבה למעלה - מעל הקונטיינר שמעליו"
              onClick={() => edit(`container-up:${c.id}`, (b) => { const w = writeContainers(b); return { ...w, elements: moveLayer(w, ids, c.parent, "up") }; })}><ArrowUp className="size-4" aria-hidden /></button>
            <button type="button" className={SIDE_BUTTON} aria-label={`${c.name} שכבה למטה`} title="שכבה למטה - מתחת לקונטיינר שמתחתיו"
              onClick={() => edit(`container-down:${c.id}`, (b) => { const w = writeContainers(b); return { ...w, elements: moveLayer(w, ids, c.parent, "down") }; })}><ArrowDown className="size-4" aria-hidden /></button>
            <button type="button" className={SIDE_BUTTON} aria-label={`שכפול ${c.name}`} title="שכפול - עותק קצת הצידה, מעל המקורי"
              onClick={() => {
                if (elements.length + ids.length > MAX_ELEMENTS) return void toast.error(`אין מקום לעוד ${ids.length} חלקים: בלוח עד ${MAX_ELEMENTS}.`);
                let copy: string[] = [];
                edit(`container-copy:${c.id}`, (b) => { const d = duplicateContainer(b, c.id); copy = d.ids; return d; });
                if (copy.length) select(copy);
              }}><Copy className="size-4" aria-hidden /></button>
            <button type="button" className={SIDE_BUTTON} aria-label={`מחיקת ${c.name}`} title="מחיקה - עם כל מה שבתוכו"
              onClick={async () => {
                const ok = await confirmAction({ title: `למחוק את „${c.name}”?`, description: `יימחקו ${parts.length} החלקים שבתוכו. אפשר לבטל ב"צעד אחורה".`, confirmLabel: "מחיקה" });
                if (ok) { edit(`container-delete:${c.id}`, (b) => deleteContainer(b, c.id)); select([]); }
              }}><Trash2 className="size-4" aria-hidden /></button>
            <HideToggle hidden={parts.every((e) => e.hidden)} name={`הקונטיינר ${c.name}`} onToggle={() => setAll({ hidden: !parts.every((e) => e.hidden) }, "hide")} />
            <LockToggle locked={parts.every((e) => e.locked)} name={`הקונטיינר ${c.name}`} onToggle={() => setAll({ locked: !parts.every((e) => e.locked) }, "lock")} />
          </span>
        </div>
        {open && (
          <div className="space-y-1 border-s-2 border-primary/20 ps-2" data-testid="container-inside">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <label className="flex items-center gap-1">
                בתוך:
                <select aria-label={`הקונטיינר ש־${c.name} בתוכו`} className={`${SELECT_CLASS} h-7`} value={c.parent ?? ""}
                  onChange={(ev) => edit(`container-parent:${c.id}`, (b) => changeContainer(b, c.id, { parent: ev.target.value || null }))}>
                  <option value="">הרקע הראשי</option>
                  {tree.containers.filter((x) => !notInside.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
              <span className="ms-auto flex flex-wrap gap-1">
                {!hasFrame && (
                  <button type="button" className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2" onClick={() => addInside("frame", { shape: backing?.shape, name: `מסגרת ${c.name}`.slice(0, 80), color: "#c9a227" })}>
                    <Plus className="size-3.5" aria-hidden /> מסגרת
                  </button>
                )}
                <button type="button" className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2" onClick={() => addInside("text", { name: `טקסט ${c.name}`.slice(0, 80) })}>
                  <Plus className="size-3.5" aria-hidden /> טקסט
                </button>
                <button type="button" className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2" onClick={() => addInside("ornament")}>
                  <Plus className="size-3.5" aria-hidden /> עיטור
                </button>
                <button type="button" className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2"
                  onClick={() => { select(ids); showDesignTopic("design-boxes"); }} title="צורה, מילוי ומסגרת - לכל הקונטיינר">
                  עיצוב הקונטיינר
                </button>
              </span>
            </div>
            {childrenOf(c.id).map((k) => (k.node ? containerRow(k.node, 0) : k.part ? partInContainer(k.part) : null))}
          </div>
        )}
      </div>
    );
  };

  const partInContainer = (e: BoardElement) => (
    <div key={e.id} className="flex items-center gap-1">
      <div className="min-w-0 flex-1">{row(e, true)}</div>
      <button type="button" className={SIDE_BUTTON} aria-label={`הוצאת ${e.name} מהקונטיינר`} title="הוצאה מהקונטיינר - החלק יעמוד לבד"
        onClick={() => edit(`container-out:${e.id}`, (b) => takeOut(b, e.id))}><LogOut className="size-4" aria-hidden /></button>
    </div>
  );

  return (
    <div className="space-y-1.5" data-testid="container-layers">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">השכבה העליונה ראשונה. קונטיינר: לוח, מסגרת, טקסטים ועיטורים - יחד.</span>
        <button type="button" onClick={newContainer} data-testid="container-new"
          className="ms-auto inline-flex h-7 items-center gap-1 rounded border bg-background px-2" title="לוח, מסגרת וכותרת - קונטיינר שלם, באמצע הלוח">
          <Plus className="size-3.5" aria-hidden /> קונטיינר חדש
        </button>
        <button type="button" disabled={!selected.length} onClick={gather}
          className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2 disabled:opacity-40" title="החלקים שבחרתם הופכים לקונטיינר אחד">
          <FolderPlus className="size-3.5" aria-hidden /> קונטיינר מהבחירה
        </button>
      </div>
      {childrenOf(null).map((k) => (k.node ? containerRow(k.node, 0) : k.part ? <div key={k.key}>{row(k.part, false)}</div> : null))}
      <div className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-sm" data-testid="main-background-layer">
        <span className="flex-1 font-semibold">הרקע הראשי <span className="text-xs font-normal text-muted-foreground">- השכבה התחתונה, מתחת לכולם</span></span>
        <button type="button" className="h-7 rounded border bg-background px-2 text-xs" onClick={() => showDesignTopic("design-background")}>עריכת הרקע</button>
      </div>
    </div>
  );
}
