import { useCallback, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { ElementEditingContext, type ElementEditingApi } from '@/tv/elementEditing';
import type { BoardElement } from '@/tv/elements';

/** Only transient selection/gesture state. All committed data stays in TvConfig. */
export function ElementEditingProvider({ children }: { children: ReactNode }) {
  const api = useRef<ElementEditingApi | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [chosenAlone, setChosenAlone] = useState<string | null>(null);
  // An ordinary choice ends a part's being alone; choosing it alone marks it so.
  const select = useCallback<Dispatch<SetStateAction<string[]>>>((v) => { setChosenAlone(null); setSelected(v); }, []);
  const selectAlone = useCallback((id: string) => { setSelected([id]); setChosenAlone(id); }, []);
  const alone = chosenAlone && selected.length === 1 && selected[0] === chosenAlone ? chosenAlone : null;
  const [snap, setSnap] = useState(true);
  const [gridStep,setGridStep]=useState(5);
  const [showGrid,setShowGrid]=useState(false);
  const [linkSection,setLinkSection]=useState(true);
  const [draft, setDraft] = useState<BoardElement[] | null>(null);
  return <ElementEditingContext.Provider value={{ api, enabled, setEnabled, selected, select, alone, selectAlone, snap, setSnap,gridStep,setGridStep,showGrid,setShowGrid,linkSection,setLinkSection, draft, setDraft }}>{children}</ElementEditingContext.Provider>;
}
