import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Highlighter,
  Bookmark,
  Palette,
  StickyNote,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface PasukLineActionsProps {
  children: React.ReactNode;
  text: string;
  onHighlight?: (color: string) => void;
  onBookmark?: () => void;
  onAddNote?: () => void;
}

const highlightColors = [
  { name: "צהוב", value: "#fef08a", class: "bg-yellow-200" },
  { name: "ירוק", value: "#bbf7d0", class: "bg-green-200" },
  { name: "כחול", value: "#bfdbfe", class: "bg-blue-200" },
  { name: "ורוד", value: "#fbcfe8", class: "bg-pink-200" },
  { name: "סגול", value: "#e9d5ff", class: "bg-purple-200" },
  { name: "כתום", value: "#fed7aa", class: "bg-orange-200" },
];

const textColors = [
  { name: "אדום", value: "#dc2626", class: "text-red-600" },
  { name: "כחול", value: "#2563eb", class: "text-blue-600" },
  { name: "ירוק", value: "#16a34a", class: "text-green-600" },
  { name: "סגול", value: "#9333ea", class: "text-purple-600" },
  { name: "זהב", value: "#d97706", class: "text-amber-600" },
  { name: "שחור", value: "#1a1a1a", class: "text-black" },
];

export const PasukLineActions = ({
  children,
  text,
  onHighlight,
  onBookmark,
  onAddNote,
}: PasukLineActionsProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("הטקסט הועתק ללוח");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHighlight = (color: string) => {
    onHighlight?.(color);
    toast.success("הטקסט סומן");
  };

  const handleBookmark = () => {
    onBookmark?.();
  };

  const handleAddNote = () => {
    onAddNote?.();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="cursor-context-menu transition-all rounded px-1 w-full text-right overflow-hidden min-w-0">
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onClick={handleCopy} className="gap-2">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span>העתק טקסט</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Highlighter className="h-4 w-4" />
            <span>הדגש ברקע</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {highlightColors.map((color) => (
              <ContextMenuItem
                key={color.value}
                onClick={() => handleHighlight(color.value)}
                className="gap-2"
              >
                <div
                  className={`h-5 w-5 rounded border ${color.class}`}
                  style={{ backgroundColor: color.value }}
                />
                <span>{color.name}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Palette className="h-4 w-4" />
            <span>צבע טקסט</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {textColors.map((color) => (
              <ContextMenuItem
                key={color.value}
                onClick={() => handleHighlight(color.value)}
                className="gap-2"
              >
                <div
                  className={`h-5 w-5 rounded border ${color.class}`}
                  style={{ color: color.value }}
                >
                  א
                </div>
                <span>{color.name}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleBookmark} className="gap-2">
          <Bookmark className="h-4 w-4" />
          <span>הוסף סימניה</span>
        </ContextMenuItem>

        <ContextMenuItem onClick={handleAddNote} className="gap-2">
          <StickyNote className="h-4 w-4" />
          <span>הוסף הערה</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
