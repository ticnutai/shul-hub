import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { FlatPasuk } from "@/types/torah";

interface SelectionContextType {
  selectedPesukim: FlatPasuk[];
  isSelected: (id: number) => boolean;
  toggleSelect: (pasuk: FlatPasuk) => void;
  clearSelection: () => void;
  selectionMode: boolean;
  enableSelectionMode: () => void;
  disableSelectionMode: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export const SelectionProvider = ({ children }: { children: ReactNode }) => {
  const [selectedPesukim, setSelectedPesukim] = useState<FlatPasuk[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const isSelected = useCallback(
    (id: number) => selectedPesukim.some((p) => p.id === id),
    [selectedPesukim]
  );

  const toggleSelect = useCallback((pasuk: FlatPasuk) => {
    setSelectedPesukim((prev) => {
      const exists = prev.some((p) => p.id === pasuk.id);
      if (exists) return prev.filter((p) => p.id !== pasuk.id);
      return [...prev, pasuk];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPesukim([]);
    setSelectionMode(false);
  }, []);

  const enableSelectionMode = useCallback(() => setSelectionMode(true), []);
  const disableSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedPesukim([]);
  }, []);

  return (
    <SelectionContext.Provider
      value={{
        selectedPesukim,
        isSelected,
        toggleSelect,
        clearSelection,
        selectionMode,
        enableSelectionMode,
        disableSelectionMode,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSelection = () => {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
};
