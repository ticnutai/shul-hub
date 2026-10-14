/**
 * Containers: what a board of parts is built of. A container holds parts - a
 * board behind (a box), a frame (or none), texts, ornaments, live content -
 * and may stand inside another container. The board's main background is
 * the bottom layer, under them all.
 *
 * The board itself is still drawn from its flat list of parts, as every
 * screen (and every TV app already installed) knows how to draw it. A
 * container is the parts sharing a `group`, and a record beside the list
 * (config.containers) giving it a name, a container it stands in, a shape.
 * A board that has no records yet - every kit made until now - is read the
 * way the editor always read it (linkedSection: by containment and by the
 * names of a frame and its fill), and that reading is written down the first
 * time a container is changed, so from then on nothing is guessed.
 */
import { BINDING_LABELS, elementId, normalizeElements, type BoardElement } from './elements';
import { isPartShape, type PartShape } from './partShapes';
import { linkedSection } from './sectionGeometry';

export interface PartContainer {
  id: string;
  name: string;
  /** The container this one stands in; null - on the main background. */
  parent: string | null;
  /** The container's shape: its board and its frame take it together. */
  shape?: PartShape;
}

export const MAX_CONTAINERS = 60;
const ID = /^[\w-]{1,80}$/;

export function normalizeContainers(raw: unknown): PartContainer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out = raw.slice(0, MAX_CONTAINERS).flatMap((v): PartContainer[] => {
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !ID.test(v.id) || seen.has(v.id)) return [];
    seen.add(v.id);
    return [{
      id: v.id,
      name: typeof v.name === 'string' && v.name.trim() ? v.name.trim().slice(0, 60) : 'קונטיינר',
      parent: typeof v.parent === 'string' && ID.test(v.parent) ? v.parent : null,
      ...(isPartShape(v.shape) ? { shape: v.shape } : {}),
    }];
  });
  // A parent that is not there, or a ring of containers inside each other: on the background.
  return out.map(c => (c.parent && (!seen.has(c.parent) || inRing(out, c.id)) ? { ...c, parent: null } : c));
}

function inRing(all: PartContainer[], id: string): boolean {
  const byId = new Map(all.map(c => [c.id, c]));
  let at = byId.get(id)?.parent ?? null;
  for (let i = 0; at && i <= all.length; i++) {
    if (at === id) return true;
    at = byId.get(at)?.parent ?? null;
  }
  return false;
}

/** A container as the editor shows it: its record (or the one read for it), and its own parts. */
export interface ContainerNode extends PartContainer {
  /** False: read off the board, not yet written down. */
  saved: boolean;
  /** Its own parts, bottom first (not those of the containers inside it). */
  parts: string[];
}

export interface ContainerTree {
  containers: ContainerNode[];
  /** Parts standing alone, in no container. */
  loose: string[];
}

/** What the gabbai calls it: its heading, else what it shows, else the name of its picture. */
export function containerName(parts: BoardElement[]): string {
  const heading = parts.find(e => e.kind === 'text' && !e.binding && e.text.trim())?.text.trim();
  if (heading) return heading.slice(0, 60);
  const bound = parts.find(e => e.binding)?.binding;
  if (bound) return BINDING_LABELS[bound];
  const piece = parts.find(e => e.kind === 'frame' || e.kind === 'box' || e.kind === 'image') ?? parts[0];
  return (piece?.name ?? 'קונטיינר').replace(/^(מסגרת|מילוי) /, '').slice(0, 60);
}

/**
 * The board's containers: the recorded ones, the groups that have no record
 * yet, and - for parts in no group - the sections the editor always read.
 */
export function containerTree(elements: BoardElement[], records: PartContainer[]): ContainerTree {
  const byGroup = new Map<string, string[]>();
  for (const e of elements) if (e.group) byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e.id]);
  const read = new Map<string, string[]>();
  const taken = new Set(elements.filter(e => e.group).map(e => e.id));
  for (const e of elements) {
    if (taken.has(e.id)) continue;
    const section = linkedSection(elements, e.id).filter(id => !taken.has(id));
    if (section.length < 2 || byGroup.has(`c_${e.id}`.slice(0, 80))) continue;
    read.set(`c_${e.id}`.slice(0, 80), section);
    section.forEach(id => taken.add(id));
  }
  const containers: ContainerNode[] = [];
  const named = new Map(records.map(r => [r.id, r]));
  const parts = (ids: string[]) => elements.filter(e => ids.includes(e.id));
  for (const [id, ids] of [...byGroup, ...read]) {
    // A part taken out of its container keeps a group of its own (takeOut): it stands alone.
    if (id.startsWith('p_') && !named.has(id)) continue;
    const r = named.get(id);
    containers.push({ id, name: r?.name ?? containerName(parts(ids)), parent: r?.parent ?? null, ...(r?.shape ? { shape: r.shape } : {}), saved: !!r, parts: ids });
  }
  // A recorded container whose parts all went (into others) stays while a container stands in it.
  for (const r of records) if (!containers.some(c => c.id === r.id) && records.some(x => x.parent === r.id)) containers.push({ ...r, saved: true, parts: [] });
  const known = new Set(containers.map(c => c.id));
  for (const c of containers) if (c.parent && !known.has(c.parent)) c.parent = null;
  const inOne = new Set(containers.flatMap(c => c.parts));
  return { containers, loose: elements.filter(e => !inOne.has(e.id)).map(e => e.id) };
}

/** The containers standing in this one, and in them, and so on. */
export function descendants(tree: ContainerTree, id: string): string[] {
  const out: string[] = [];
  const walk = (p: string) => tree.containers.filter(c => c.parent === p).forEach(c => { out.push(c.id); walk(c.id); });
  walk(id);
  return out;
}

/** Every part of a container, with those of the containers inside it. */
export function partsOf(tree: ContainerTree, id: string): string[] {
  const ids = [id, ...descendants(tree, id)];
  return tree.containers.filter(c => ids.includes(c.id)).flatMap(c => c.parts);
}

type Board = { elements: BoardElement[]; containers: PartContainer[] };

/**
 * The containers read off the board, written down: each part takes its
 * container's group, and each container a record. After this nothing about
 * them is guessed. Records with nothing in them (and none inside them) go.
 */
export function writeContainers(board: Board): Board {
  const tree = containerTree(board.elements, board.containers);
  const groupOf = new Map<string, string>();
  for (const c of tree.containers) for (const id of c.parts) groupOf.set(id, c.id);
  return {
    elements: board.elements.map(e => (groupOf.get(e.id) && e.group !== groupOf.get(e.id) ? { ...e, group: groupOf.get(e.id)! } : e)),
    containers: tree.containers.map(({ id, name, parent, shape }) => ({ id, name, parent, ...(shape ? { shape } : {}) })),
  };
}

/** One step of the layers: a container (with those inside it) or a part alone, among its neighbours. */
interface Unit { ids: string[]; top: number }

function siblings(board: Board, parent: string | null): Unit[] {
  const tree = containerTree(board.elements, board.containers);
  const index = new Map(board.elements.map((e, i) => [e.id, i]));
  const units: Unit[] = tree.containers.filter(c => c.parent === parent).map(c => ({ ids: partsOf(tree, c.id), top: -1 }));
  // Parts alone stand on the background: among the top level's steps.
  if (parent === null) for (const id of tree.loose) units.push({ ids: [id], top: -1 });
  for (const u of units) u.top = Math.max(-1, ...u.ids.map(id => index.get(id) ?? -1));
  return units.filter(u => u.ids.length).sort((a, b) => a.top - b.top);
}

/**
 * A container (or a part alone) one layer up or down among its neighbours:
 * all of it is laid just over (or under) the neighbour, together.
 */
export function moveLayer(board: Board, ids: string[], parent: string | null, direction: 'up' | 'down'): BoardElement[] {
  const units = siblings(board, parent);
  const at = units.findIndex(u => u.ids.some(id => ids.includes(id)));
  const other = units[direction === 'up' ? at + 1 : at - 1];
  if (at < 0 || !other) return board.elements;
  const mine = board.elements.filter(e => units[at].ids.includes(e.id));
  const rest = board.elements.filter(e => !units[at].ids.includes(e.id));
  const otherIndex = rest.map((e, i) => (other.ids.includes(e.id) ? i : -1)).filter(i => i >= 0);
  const cut = direction === 'up' ? Math.max(...otherIndex) + 1 : Math.min(...otherIndex);
  return [...rest.slice(0, cut), ...mine, ...rest.slice(cut)];
}

/** A copy of a container, those inside it with it, a little to the side - laid just over the original. */
export function duplicateContainer(board: Board, id: string): Board & { copy: string; ids: string[] } {
  const written = writeContainers(board);
  const tree = containerTree(written.elements, written.containers);
  const family = [id, ...descendants(tree, id)];
  const newId = new Map(family.map(c => [c, `c_${elementId().slice(3, 40)}`]));
  const ids = partsOf(tree, id);
  const copies = written.elements.filter(e => ids.includes(e.id)).map(e => ({
    ...e, id: elementId(), group: newId.get(e.group ?? '') ?? e.group,
    x: Math.min(100 - e.width, e.x + 2), y: Math.min(100 - e.height, e.y + 2),
  }));
  const last = Math.max(...written.elements.map((e, i) => (ids.includes(e.id) ? i : -1)));
  const records = written.containers.filter(c => family.includes(c.id)).map(c => ({
    ...c, id: newId.get(c.id)!, parent: c.id === id ? c.parent : newId.get(c.parent ?? '') ?? c.parent,
    name: c.id === id ? `${c.name} (עותק)`.slice(0, 60) : c.name,
  }));
  return {
    elements: normalizeElements([...written.elements.slice(0, last + 1), ...copies, ...written.elements.slice(last + 1)]),
    containers: [...written.containers, ...records],
    copy: newId.get(id)!,
    ids: copies.map(e => e.id),
  };
}

/** A container gone, with all that is in it. */
export function deleteContainer(board: Board, id: string): Board {
  const written = writeContainers(board);
  const tree = containerTree(written.elements, written.containers);
  const gone = new Set([id, ...descendants(tree, id)]);
  const ids = new Set(partsOf(tree, id));
  return { elements: written.elements.filter(e => !ids.has(e.id)), containers: written.containers.filter(c => !gone.has(c.id)) };
}

/** Parts chosen, gathered into a new container - inside the one they all stood in, if they did. */
export function gatherIntoContainer(board: Board, partIds: string[], name?: string): Board & { id: string } {
  const written = writeContainers(board);
  const tree = containerTree(written.elements, written.containers);
  const from = new Set(partIds.map(p => tree.containers.find(c => c.parts.includes(p))?.id ?? null));
  const parent = from.size === 1 ? [...from][0] : null;
  const id = `c_${elementId().slice(3, 40)}`;
  const parts = written.elements.filter(e => partIds.includes(e.id));
  return {
    elements: written.elements.map(e => (partIds.includes(e.id) ? { ...e, group: id } : e)),
    containers: [...written.containers, { id, name: (name ?? containerName(parts)).slice(0, 60), parent }],
    id,
  };
}

/** A part taken out of its container, to stand alone on the background. */
export function takeOut(board: Board, partId: string): Board {
  const written = writeContainers(board);
  // Its own one-part group: a group of its own is a section of its own, never read back into another.
  return { elements: written.elements.map(e => (e.id === partId ? { ...e, group: `p_${e.id}`.slice(0, 80) } : e)), containers: written.containers };
}

/** A container's record changed: its name, the container it stands in, its shape. */
export function changeContainer(board: Board, id: string, patch: Partial<Omit<PartContainer, 'id'>>): Board {
  const written = writeContainers(board);
  const next = written.containers.map(c => (c.id === id ? { ...c, ...patch } : c));
  // Never inside itself, nor inside one of those inside it.
  if (patch.parent && (patch.parent === id || inRing(next, id))) return written;
  return { elements: written.elements, containers: next };
}
