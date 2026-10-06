import { useRef, useState, type ReactNode } from 'react';
import { ElementEditingContext, type ElementEditingApi } from '@/tv/elementEditing';
import type { BoardElement } from '@/tv/elements';

/** Only transient selection/gesture state. All committed data stays in TvConfig. */
export function ElementEditingProvider({ children }: { children: ReactNode }) {
  const api = useRef<ElementEditingApi | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [selected, select] = useState<string[]>([]);
  const [snap, setSnap] = useState(true);
  const [draft, setDraft] = useState<BoardElement[] | null>(null);
  return <ElementEditingContext.Provider value={{ api, enabled, setEnabled, selected, select, snap, setSnap, draft, setDraft }}>{children}</ElementEditingContext.Provider>;
}
