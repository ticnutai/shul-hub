import { useState, memo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bookmark, MessageSquare, X } from "lucide-react";
import { useHighlights } from "@/contexts/HighlightsContext";
import { useNotes } from "@/contexts/NotesContext";
import { toast } from "@/hooks/use-toast";
import { useTextDisplayStyles } from "@/hooks/useTextDisplayStyles";

interface ClickableTextProps {
  text: string;
  pasukId: string;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  fontWeight?: string;
  className?: string;
  style?: React.CSSProperties;
}

const HIGHLIGHT_COLORS = [
  { name: "צהוב", value: "bg-yellow-200/70 dark:bg-yellow-900/40" },
  { name: "ירוק", value: "bg-green-200/70 dark:bg-green-900/40" },
  { name: "כחול", value: "bg-blue-200/70 dark:bg-blue-900/40" },
  { name: "ורוד", value: "bg-pink-200/70 dark:bg-pink-900/40" },
  { name: "סגול", value: "bg-purple-200/70 dark:bg-purple-900/40" },
];

export const ClickableText = ({
  text,
  pasukId,
  fontFamily,
  fontSize,
  color,
  fontWeight,
  className = "",
  style = {},
}: ClickableTextProps) => {
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { addHighlight, removeHighlight, getHighlightsForPasuk } = useHighlights();
  const { addNote } = useNotes();
  const displayStyles = useTextDisplayStyles();

  const words = text.split(' ');
  const highlights = getHighlightsForPasuk(pasukId);

  const handleWordClick = (wordIndex: number, event: React.MouseEvent) => {
    // Only open if Ctrl key is pressed
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    setSelectedWordIndex(wordIndex);
    setPopoverOpen(true);
  };

  const handleHighlight = (colorClass: string) => {
    if (selectedWordIndex === null) return;

    const word = words[selectedWordIndex];
    const startIndex = words.slice(0, selectedWordIndex).join(' ').length + (selectedWordIndex > 0 ? 1 : 0);
    const endIndex = startIndex + word.length;

    // Check if already highlighted
    const existingHighlight = highlights.find(
      h => h.startIndex === startIndex && h.endIndex === endIndex
    );

    if (existingHighlight) {
      removeHighlight(existingHighlight.id);
      toast({ description: "הצבע הוסר" });
    } else {
      addHighlight({
        pasukId,
        text: word,
        color: colorClass,
        startIndex,
        endIndex,
      });
      toast({ description: "המילה צבועה" });
    }

    setPopoverOpen(false);
    setSelectedWordIndex(null);
  };

  const handleAddNote = () => {
    if (selectedWordIndex === null) return;
    const word = words[selectedWordIndex];
    addNote(pasukId, `הערה על: ${word}`);
    toast({ description: "הוספת הערה - ערוך בתפריט ההערות" });
    setPopoverOpen(false);
    setSelectedWordIndex(null);
  };

  const getWordHighlight = (wordIndex: number) => {
    const word = words[wordIndex];
    const startIndex = words.slice(0, wordIndex).join(' ').length + (wordIndex > 0 ? 1 : 0);
    const endIndex = startIndex + word.length;

    return highlights.find(
      h => h.startIndex === startIndex && h.endIndex === endIndex
    );
  };

  const removeWordHighlight = () => {
    if (selectedWordIndex === null) return;
    const highlight = getWordHighlight(selectedWordIndex);
    if (highlight) {
      removeHighlight(highlight.id);
      toast({ description: "הצבע הוסר" });
    }
    setPopoverOpen(false);
    setSelectedWordIndex(null);
  };

  return (
      <div
        className={className}
        style={{
          fontFamily,
          fontSize: fontSize ? `calc(${fontSize} * ${displayStyles.fontScale})` : undefined,
          color,
          fontWeight,
          lineHeight: displayStyles.lineHeight,
          letterSpacing: displayStyles.letterSpacing,
          wordSpacing: displayStyles.wordSpacing,
          wordWrap: "break-word",
          overflowWrap: "break-word",
          whiteSpace: "normal",
          maxWidth: "100%",
          width: "100%",
          display: "block",
          direction: "rtl",
          textAlign: displayStyles.textAlign,
          textAlignLast: displayStyles.textAlign === 'justify' ? 'right' : displayStyles.textAlign,
          ...style,
        }}
      >
      {words.map((word, index) => {
        const highlight = getWordHighlight(index);
        const isHighlighted = !!highlight;

        return (
          <span key={`${pasukId}-word-${index}`}>
            <Popover
              open={popoverOpen && selectedWordIndex === index}
              onOpenChange={(open) => {
                if (!open) {
                  setPopoverOpen(false);
                  setSelectedWordIndex(null);
                }
              }}
            >
              <PopoverTrigger asChild>
                <span
                  onClick={(e) => handleWordClick(index, e)}
                  className={`cursor-pointer hover:opacity-80 transition-opacity ${
                    isHighlighted ? highlight.color : ""
                  } ${isHighlighted ? "px-0.5 rounded" : ""}`}
                  title="Ctrl+Click לצביעה והערות"
                >
                  {word}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 z-[100] bg-popover" align="center">
                <div className="space-y-3">
                  {isHighlighted ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={removeWordHighlight}
                      className="w-full gap-2"
                    >
                      <X className="h-4 w-4" />
                      הסר צבע
                    </Button>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-center mb-2">בחר צבע</div>
                      <div className="grid grid-cols-5 gap-2">
                        {HIGHLIGHT_COLORS.map((colorOption) => (
                          <button
                            key={colorOption.name}
                            onClick={() => handleHighlight(colorOption.value)}
                            className={`h-8 w-8 rounded-full border-2 border-border hover:scale-110 transition-transform ${colorOption.value}`}
                            title={colorOption.name}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  
                  <div className="border-t pt-2 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddNote}
                      className="w-full gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      הוסף הערה
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {index < words.length - 1 && " "}
          </span>
        );
      })}
    </div>
  );
};

export default memo(ClickableText);
