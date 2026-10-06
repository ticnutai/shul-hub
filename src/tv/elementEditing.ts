import { createContext, useContext, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { BoardElement } from './elements';

export interface ElementEditingApi {
  elements: BoardElement[];
  commit: (next: BoardElement[], key?: string) => void;
}
export interface ElementEditingState {
  api: MutableRefObject<ElementEditingApi | null>;
  enabled: boolean;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  selected: string[];
  select: Dispatch<SetStateAction<string[]>>;
  snap: boolean;
  setSnap: Dispatch<SetStateAction<boolean>>;
  draft: BoardElement[] | null;
  setDraft: Dispatch<SetStateAction<BoardElement[] | null>>;
}
export const ElementEditingContext = createContext<ElementEditingState | null>(null);
export const useElementEditing = () => useContext(ElementEditingContext);
