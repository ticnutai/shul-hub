import { useState, useEffect, useCallback, useRef } from "react";
import { Link2, Share2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { buildOgShareUrl } from "@/utils/shareUtils";

interface TextSelectionShareProps {
  children: React.ReactNode;
  seferId: number;
  perek: number;
  pasukNum: number;
  mefaresh?: string;
  className?: string;
}

/**
 * Wraps content and shows a floating share tooltip when user selects text.
 * Generates a link with ?sefer=X&perek=Y&pasuk=Z&highlight=ENCODED_TEXT&mefaresh=NAME
 */
export function TextSelectionShare({
  children,
  seferId,
  perek,
  pasukNum,
  mefaresh,
  className,
}: TextSelectionShareProps) {
  const [selectedText, setSelectedText] = useState("");
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    // Small delay to let browser finalize selection
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        return;
      }

      // Check if selection is within our container
      const range = selection.getRangeAt(0);
      if (!containerRef.current?.contains(range.commonAncestorContainer)) {
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 3) return; // Minimum 3 chars

      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      setSelectedText(text);
      setTooltipPos({
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top - 8,
      });
      setCopied(false);
    }, 10);
  }, []);

  const hideTooltip = useCallback(() => {
    setSelectedText("");
    setTooltipPos(null);
  }, []);

  // Close tooltip when clicking outside or selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Delay to allow button clicks
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            hideTooltip();
          }
        }, 200);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [hideTooltip]);

  const buildShareUrl = useCallback(() => {
    return buildOgShareUrl({
      seferId,
      perek,
      pasuk: pasukNum,
      highlight: selectedText,
      mefaresh,
    });
  }, [seferId, perek, pasukNum, selectedText, mefaresh]);

  const handleCopyLink = useCallback(() => {
    const url = buildShareUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("הקישור עם הציטוט הועתק!");
    setTimeout(() => setCopied(false), 2000);
  }, [buildShareUrl]);

  const handleShare = useCallback(() => {
    const url = buildShareUrl();
    const title = mefaresh
      ? `${mefaresh} — "${selectedText.slice(0, 60)}${selectedText.length > 60 ? "..." : ""}"`
      : `"${selectedText.slice(0, 60)}${selectedText.length > 60 ? "..." : ""}"`;

    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      // Fallback to WhatsApp
      const waText = `📖 ${title}\n\n🔗 ${url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, "_blank");
    }
    hideTooltip();
  }, [buildShareUrl, selectedText, mefaresh, hideTooltip]);

  return (
    <div ref={containerRef} className={cn("relative", className)} onMouseUp={handleMouseUp} onTouchEnd={handleMouseUp}>
      {children}

      {/* Floating share tooltip */}
      {tooltipPos && selectedText && (
        <div
          ref={tooltipRef}
          className="absolute z-[100] flex items-center gap-1 bg-popover border border-border shadow-lg rounded-full px-2 py-1 animate-fade-in"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translate(-50%, -100%)",
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
        >
          <button
            onClick={handleCopyLink}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            title="העתק קישור עם ציטוט"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
          </button>
          <button
            onClick={handleShare}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            title="שתף ציטוט"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
