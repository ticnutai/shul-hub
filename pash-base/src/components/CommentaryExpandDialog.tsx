import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, Copy, Check, Share2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import React from "react";
import { loadSefariaCommentary, getSefariaSeferName, getMefareshSefariaUrl, getAvailableCommentaries } from "@/utils/sefariaCommentaries";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { torahDB } from "@/utils/torahDB";
import { TextHighlighter } from "./TextHighlighter";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { formatTorahText } from "@/utils/textUtils";
import { MEFARESH_MAPPING } from "@/types/sefaria";
import { toast } from "sonner";

interface CommentaryExpandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sefer: number;
  perek: number;
  pasuk: number;
  mefaresh: string;
}

export const CommentaryExpandDialog = ({
  open,
  onOpenChange,
  sefer,
  perek,
  pasuk,
  mefaresh
}: CommentaryExpandDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [commentaryText, setCommentaryText] = useState<string>("");
  const { settings } = useFontAndColorSettings();

  // Memoize cache key
  const cacheKey = useMemo(() => 
    `expand_${sefer}_${perek}_${pasuk}_${mefaresh}`,
    [sefer, perek, pasuk, mefaresh]
  );

  useEffect(() => {
    if (!open) return;

    const loadCommentary = async () => {
      setLoading(true);
      
      // Try IndexedDB cache first
      try {
        const cached = await torahDB.getCommentary(cacheKey);
        if (cached && typeof cached === 'string') {
          setCommentaryText(cached);
          setLoading(false);
          return;
        }
      } catch {
        // Cache miss, continue loading
      }

      try {
        const seferName = getSefariaSeferName(sefer);
        const mefareshEn = MEFARESH_MAPPING[mefaresh];

        if (!mefareshEn) {
          setCommentaryText("מפרש לא נתמך");
          setLoading(false);
          return;
        }

        // Try full local file first
        const data = await loadSefariaCommentary(seferName, mefareshEn);
        
        if (data?.text?.[perek - 1]?.[pasuk - 1]) {
          const text = data.text[perek - 1][pasuk - 1];
          const textContent = Array.isArray(text) ? text.join(" ") : text;
          setCommentaryText(textContent);
          torahDB.saveCommentary(cacheKey, textContent).catch(() => {});
        } else {
          // Fallback: fetch this specific commentary via API
          const results = await getAvailableCommentaries(sefer, perek, pasuk);
          const found = results.find(c => c.mefaresh === mefaresh || c.mefareshEn === mefareshEn);
          if (found?.text) {
            setCommentaryText(found.text);
            torahDB.saveCommentary(cacheKey, found.text).catch(() => {});
          } else {
            setCommentaryText("לא נמצא פירוש");
          }
        }
      } catch (error) {
        console.error("Error loading commentary:", error);
        setCommentaryText("שגיאה בטעינת הפירוש");
      } finally {
        setLoading(false);
      }
    };

    loadCommentary();
  }, [open, sefer, perek, pasuk, mefaresh, cacheKey]);

  const sefariaUrl = getMefareshSefariaUrl(sefer, perek, pasuk, mefaresh);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-layout="dialog-commentary" data-layout-label="📦 דיאלוג: פירוש" className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">
            {mefaresh} - {["בראשית", "שמות", "ויקרא", "במדבר", "דברים"][sefer - 1]} פרק {toHebrewNumber(perek)} פסוק {toHebrewNumber(pasuk)}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="break-words w-full"
              style={{
                fontFamily: settings.commentaryFont,
                fontSize: `${settings.commentarySize}px`,
                color: settings.commentaryColor,
                fontWeight: settings.commentaryBold ? 'bold' : 'normal',
                lineHeight: settings.commentaryLineHeight === 'custom' ? String(settings.commentaryLineHeightCustom ?? 1.9) : settings.commentaryLineHeight === 'relaxed' ? '1.9' : settings.commentaryLineHeight === 'loose' ? '2.2' : '1.6',
                maxWidth: settings.commentaryMaxWidth === 'narrow' ? '600px' : settings.commentaryMaxWidth === 'medium' ? '800px' : settings.commentaryMaxWidth === 'wide' ? '1000px' : '100%',
                margin: '0 auto',
                textAlign: settings.commentaryTextAlignment as React.CSSProperties['textAlign'],
                letterSpacing: settings.commentaryLetterSpacing === 'custom' ? `${settings.commentaryLetterSpacingCustom ?? 0}em` : settings.commentaryLetterSpacing === 'tight' ? '-0.02em' : settings.commentaryLetterSpacing === 'wide' ? '0.05em' : settings.commentaryLetterSpacing === 'wider' ? '0.1em' : '0em',
                wordSpacing: `${settings.commentaryWordSpacing ?? 0}em`,
                direction: 'rtl',
                whiteSpace: 'normal'
              }}
            >
              {formatTorahText(commentaryText)}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(commentaryText);
                    toast.success("הפירוש הועתק ללוח");
                  }}
                  title="העתק פירוש"
                  aria-label="העתק פירוש"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const seferNames = ["בראשית", "שמות", "ויקרא", "במדבר", "דברים"];
                    const shareText = `*${mefaresh}*\n📖 ${seferNames[sefer - 1]} פרק ${toHebrewNumber(perek)} פסוק ${toHebrewNumber(pasuk)}\n\n${commentaryText}\n\n---\nמתוך אפליקציית חמישה חומשי תורה עם פירושים`;
                    if (navigator.share) {
                      navigator.share({ title: `${mefaresh} - פירוש`, text: shareText }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareText);
                      toast.success("הפירוש הועתק לשיתוף");
                    }
                  }}
                  title="שתף פירוש"
                  aria-label="שתף פירוש"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(sefariaUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 ml-2" />
                פתח בספריא
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
