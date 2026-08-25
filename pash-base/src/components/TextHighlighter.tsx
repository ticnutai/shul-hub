import { useState, useRef, useMemo } from "react";
import { Highlighter, Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHighlights } from "@/contexts/HighlightsContext";
import { toast } from "sonner";
import { fixText } from "@/utils/fixData";

interface TextHighlighterProps {
  text: string;
  pasukId: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: string;
}

const HIGHLIGHT_COLORS = [
  { name: "צהוב", value: "bg-yellow-200/70" },
  { name: "ירוק", value: "bg-green-200/70" },
  { name: "כחול", value: "bg-blue-200/70" },
  { name: "ורוד", value: "bg-pink-200/70" },
  { name: "סגול", value: "bg-purple-200/70" },
  { name: "כתום", value: "bg-orange-200/70" },
];

export const TextHighlighter = ({ text, pasukId, fontFamily, fontSize, color, fontWeight }: TextHighlighterProps) => {
  const [showPopover, setShowPopover] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const { addHighlight, getHighlightsForPasuk, removeHighlight } = useHighlights();
  
  // Fix text once on render
  const fixedText = useMemo(() => fixText(text), [text]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === "") {
      setShowPopover(false);
      return;
    }

    const selected = selection.toString();
    const range = selection.getRangeAt(0);
    
    if (textRef.current?.contains(range.commonAncestorContainer)) {
      const startIndex = fixedText.indexOf(selected);
      if (startIndex !== -1) {
        setSelectedText(selected);
        setSelectionRange({ start: startIndex, end: startIndex + selected.length });
        setShowPopover(true);
      }
    }
  };

  const handleHighlight = (color: string) => {
    if (selectedText && selectionRange) {
      addHighlight({
        pasukId,
        text: selectedText,
        color,
        startIndex: selectionRange.start,
        endIndex: selectionRange.end,
      });
      toast.success("הטקסט הודגש בהצלחה");
      setShowPopover(false);
      window.getSelection()?.removeAllRanges();
    }
  };

  const renderHighlightedText = () => {
    const highlights = getHighlightsForPasuk(pasukId);
    if (highlights.length === 0) return fixedText;

    // Sort highlights by start index
    const sortedHighlights = [...highlights].sort((a, b) => a.startIndex - b.startIndex);
    
    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, i) => {
      // Add text before highlight
      if (highlight.startIndex > lastIndex) {
        parts.push(
          <span key={`text-${i}`}>
            {fixedText.substring(lastIndex, highlight.startIndex)}
          </span>
        );
      }

      // Add highlighted text
      parts.push(
        <span
          key={`highlight-${highlight.id}`}
          className={`${highlight.color} px-1 rounded cursor-pointer relative group`}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {highlight.text}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeHighlight(highlight.id);
              toast.success("ההדגשה הוסרה");
            }}
            className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3 w-3 text-destructive bg-background rounded-full p-0.5" />
          </button>
        </span>
      );

      lastIndex = highlight.endIndex;
    });

    // Add remaining text
    if (lastIndex < fixedText.length) {
      parts.push(<span key="text-end">{fixedText.substring(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <Popover open={showPopover} onOpenChange={setShowPopover}>
      <PopoverTrigger asChild>
        <div
          ref={textRef}
          className="hebrew-text leading-relaxed cursor-text select-text"
          onMouseUp={handleTextSelection}
          style={{
            fontFamily: fontFamily || 'inherit',
            fontSize: fontSize ? `${fontSize}px` : 'inherit',
            color: color || 'inherit',
            fontWeight: fontWeight || 'normal'
          }}
        >
          {renderHighlightedText()}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="top">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold border-b pb-2">
            <Palette className="h-4 w-4" />
            <span>בחר צבע להדגשה</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {HIGHLIGHT_COLORS.map((color) => (
              <Button
                key={color.value}
                variant="outline"
                size="sm"
                className={`${color.value} hover:opacity-80`}
                onClick={() => handleHighlight(color.value)}
              >
                <Highlighter className="h-3 w-3 ml-1" />
                {color.name}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
