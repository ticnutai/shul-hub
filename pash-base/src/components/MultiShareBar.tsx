import { useState } from "react";
import { Share2, X, Copy, Download, CheckSquare, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSelection } from "@/contexts/SelectionContext";
import {
  shareMultiplePesukim,
  exportMultiPasukAsFile,
  formatMultiPasukShareText,
  ShareLevel,
} from "@/utils/shareUtils";
import { toast } from "sonner";

const LEVEL_LABELS: Record<ShareLevel, string> = {
  "text-only": "טקסט בלבד",
  "text-titles": "טקסט + כותרות",
  full: "תוכן מלא (שאלות + פירושים)",
};

export const MultiShareBar = () => {
  const { selectedPesukim, clearSelection, disableSelectionMode } = useSelection();
  const [level, setLevel] = useState<ShareLevel>("full");

  if (selectedPesukim.length === 0) return null;

  const handleShare = async () => {
    await shareMultiplePesukim(selectedPesukim, level);
  };

  const handleCopy = async () => {
    const text = formatMultiPasukShareText(selectedPesukim, level);
    await navigator.clipboard.writeText(text);
    toast.success(`${selectedPesukim.length} פסוקים הועתקו ללוח`);
  };

  const handleExport = () => {
    exportMultiPasukAsFile(selectedPesukim, level);
  };

  const handleEmail = () => {
    const text = formatMultiPasukShareText(selectedPesukim, level);
    const subject = encodeURIComponent(
      `${selectedPesukim.length} פסוקים מחמישה חומשי תורה`
    );
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <div
      dir="rtl"
      data-layout="share-bar" data-layout-label="📤 סרגל שיתוף"
      className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50
                 flex items-center gap-2 px-4 py-2.5
                 bg-primary text-primary-foreground rounded-full shadow-2xl
                 border border-primary/20 backdrop-blur-sm
                 animate-in slide-in-from-bottom-4 duration-300"
      style={{ bottom: 'max(calc(1rem + var(--safe-area-inset-bottom, var(--sai-bottom, env(safe-area-inset-bottom, 0px)))), 5rem)' }}
    >
      {/* Count */}
      <Badge variant="secondary" className="text-primary font-bold text-sm gap-1 px-2">
        <CheckSquare className="h-3.5 w-3.5" />
        {selectedPesukim.length}
      </Badge>

      {/* Level picker */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            className="text-primary h-7 gap-1 text-xs px-2"
          >
            {LEVEL_LABELS[level].split(" ")[0]}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>רמת פירוט</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.entries(LEVEL_LABELS) as [ShareLevel, string][]).map(
            ([key, label]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setLevel(key)}
                className={level === key ? "bg-accent" : ""}
              >
                {label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Actions */}
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 text-primary"
          title="שיתוף"
          onClick={handleShare}
        >
          <Share2 className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 text-primary"
          title="העתקה"
          onClick={handleCopy}
        >
          <Copy className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 text-primary"
          title="שמור קובץ"
          onClick={handleExport}
        >
          <Download className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-primary-foreground/60 hover:text-primary-foreground"
          title="ביטול בחירה"
          onClick={disableSelectionMode}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
