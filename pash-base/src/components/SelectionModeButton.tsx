import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelection } from "@/contexts/SelectionContext";

/**
 * Toggle button for entering/exiting multi-select sharing mode.
 * Must be rendered inside <SelectionProvider>.
 */
export const SelectionModeButton = () => {
  const { selectionMode, enableSelectionMode, disableSelectionMode, selectedPesukim } = useSelection();

  if (selectionMode) {
    return (
      <Button
        size="icon"
        variant="secondary"
        className="h-8 w-8 bg-accent/20 text-accent border border-accent/30"
        title="יציאה ממצב בחירה"
        onClick={disableSelectionMode}
      >
        <X className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10"
      title="בחר פסוקים לשיתוף"
      onClick={enableSelectionMode}
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
};
