/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Expand } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SearchableItem } from "@/hooks/useSearchIndex";

import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { normalizeMefareshName } from "@/utils/names";
import { fixText } from "@/utils/fixData";

interface SearchResultsProps {
  results: Array<{
    item: SearchableItem;
    matches?: readonly any[];
    score?: number;
  }>;
  onExpandCommentary?: (sefer: number, perek: number, pasuk: number, mefaresh: string) => void;
  onNavigate?: (sefer: number, perek: number, pasuk: number) => void;
}

export const SearchResults = ({ results, onExpandCommentary, onNavigate }: SearchResultsProps) => {
  const navigate = useNavigate();

  const handleOpenPasuk = (sefer: number, perek: number, pasuk: number) => {
    if (onNavigate) {
      onNavigate(sefer, perek, pasuk);
    } else {
      navigate(`/?sefer=${sefer}&perek=${perek}&pasuk=${pasuk}`);
    }
  };

  const highlightMatch = (text: string, matches?: readonly any[]) => {
    const fixedText = fixText(text);
    if (!matches || matches.length === 0) return fixedText;

    const match = matches[0];
    if (!match.indices || match.indices.length === 0) return fixedText;

    const [start, end] = match.indices[0];
    const before = fixedText.slice(0, start);
    const highlighted = fixedText.slice(start, end + 1);
    const after = fixedText.slice(end + 1);

    return (
      <>
        {before}
        <mark className="bg-primary/20 text-primary font-semibold">{highlighted}</mark>
        {after}
      </>
    );
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {results.map((result, idx) => {
        const item = result.item;
        const seferName = ["בראשית", "שמות", "ויקרא", "במדבר", "דברים"][item.sefer - 1];
        const perekHeb = toHebrewNumber(item.perek);
        const pasukHeb = toHebrewNumber(item.pasuk_num);

        return (
          <Card key={`${item.id}-${idx}`}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {seferName} {perekHeb}:{pasukHeb}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant={
                    item.type === 'pasuk' ? 'default' :
                    item.type === 'question' ? 'secondary' : 'outline'
                  }>
                    {item.type === 'pasuk' ? 'פסוק' :
                     item.type === 'question' ? 'שאלה' : 'פירוש'}
                  </Badge>
                  {item.mefaresh && (
                    <Badge variant="outline">{normalizeMefareshName(item.mefaresh)}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm leading-relaxed">
                {item.questionText && item.type === 'perush' && (
                  <div className="text-muted-foreground mb-2 pb-2 border-b">
                    <strong>שאלה:</strong> {fixText(item.questionText)}
                  </div>
                )}
                <div className="text-right">
                  {highlightMatch(item.text, result.matches)}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenPasuk(item.sefer, item.perek, item.pasuk_num)}
                >
                  <ExternalLink className="h-4 w-4 ml-2" />
                  פתח פסוק
                </Button>
                {item.type === 'perush' && item.mefaresh && onExpandCommentary && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onExpandCommentary(item.sefer, item.perek, item.pasuk_num, normalizeMefareshName(item.mefaresh!))}
                  >
                    <Expand className="h-4 w-4 ml-2" />
                    הרחבה
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
