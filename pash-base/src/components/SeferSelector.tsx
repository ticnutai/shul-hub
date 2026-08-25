import { useEffect, useRef, useState, useCallback } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sefer } from "@/types/torah";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { logInteraction } from "@/utils/interactionDebug";

interface SeferSelectorProps {
  sefer: Sefer | null;
  selectedSefer: number;
  seferOptions?: Array<{ id: number; name: string }>;
  onSeferSelect: (seferId: number) => void;
  selectedParsha: number | null;
  onParshaSelect: (parshaId: number | null) => void;
  selectedPerek: number | null;
  onPerekSelect: (perekNum: number | null) => void;
  selectedPasuk: number | null;
  onPasukSelect: (pasukNum: number | null) => void;
}

const SEFARIM = [
  { id: 1, name: "בראשית", color: "from-blue-600 to-blue-800" },
  { id: 2, name: "שמות", color: "from-indigo-600 to-indigo-800" },
  { id: 3, name: "ויקרא", color: "from-purple-600 to-purple-800" },
  { id: 4, name: "במדבר", color: "from-amber-600 to-amber-800" },
  { id: 5, name: "דברים", color: "from-emerald-600 to-emerald-800" },
] as const;

type SelectionLevel = "sefer" | "parsha" | "perek" | "pasuk";

export const SeferSelector = ({
  sefer,
  selectedSefer,
  seferOptions,
  onSeferSelect,
  selectedParsha,
  onParshaSelect,
  selectedPerek,
  onPerekSelect,
  selectedPasuk,
  onPasukSelect,
}: SeferSelectorProps) => {
    const currentSefarim = seferOptions ?? SEFARIM;

  const [level, setLevel] = useState<SelectionLevel>("sefer");
  const keepParshaLevelOnNextSyncRef = useRef(false);
  const hasMountedRef = useRef(false);
  // Skip the first post-mount effect run — that's the parent's initial state
  // restore (weekly parsha / localStorage). We always want to open at "sefer" level.
  const isFirstParentUpdateRef = useRef(true);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isFirstParentUpdateRef.current) {
      isFirstParentUpdateRef.current = false;
      return;
    }

    logInteraction("SeferSelector", "sync-level", {
      selectedSefer,
      selectedParsha,
      selectedPerek,
      selectedPasuk,
      level,
    });

    if (selectedParsha === null) {
      if (keepParshaLevelOnNextSyncRef.current) {
        keepParshaLevelOnNextSyncRef.current = false;
        setLevel("parsha");
        return;
      }
      setLevel("sefer");
      return;
    }

    if (selectedPerek === null) {
      setLevel("perek");
      return;
    }

    if (selectedPasuk === null) {
      setLevel("pasuk");
      return;
    }

    setLevel("pasuk");
  }, [selectedSefer, selectedParsha, selectedPerek, selectedPasuk]);

  const handleSeferClick = useCallback((seferId: number) => {
    logInteraction("SeferSelector", "sefer-click", { seferId, fromSefer: selectedSefer });
    keepParshaLevelOnNextSyncRef.current = true;
    onSeferSelect(seferId);
    onParshaSelect(null);
    onPerekSelect(null);
    onPasukSelect(null);
    setLevel("parsha");
  }, [onSeferSelect, onParshaSelect, onPerekSelect, onPasukSelect, selectedSefer]);

  const handleParshaClick = useCallback((parshaId: number) => {
    logInteraction("SeferSelector", "parsha-click", { parshaId });
    onParshaSelect(parshaId);
    onPerekSelect(null);
    onPasukSelect(null);
    setLevel("perek");
  }, [onParshaSelect, onPerekSelect, onPasukSelect]);

  const handlePerekClick = useCallback((perekNum: number) => {
    logInteraction("SeferSelector", "perek-click", { perekNum });
    onPerekSelect(perekNum);
    onPasukSelect(null);
    setLevel("pasuk");
  }, [onPerekSelect, onPasukSelect]);

  const handlePasukClick = useCallback((pasukNum: number) => {
    logInteraction("SeferSelector", "pasuk-click", { pasukNum });
    onPasukSelect(pasukNum);
    setLevel("pasuk");
  }, [onPasukSelect]);

  // Build breadcrumb data
  const selectedSeferName = currentSefarim.find((s) => s.id === selectedSefer)?.name;
  const selectedParshaName = sefer?.parshiot.find((p) => p.parsha_id === selectedParsha)?.parsha_name;
  const selectedPerekLabel = selectedPerek ? toHebrewNumber(selectedPerek) : null;
  const selectedPasukLabel = selectedPasuk ? toHebrewNumber(selectedPasuk) : null;

  const handleBreadcrumbClick = useCallback((targetLevel: SelectionLevel) => {
    logInteraction("SeferSelector", "breadcrumb-click", { targetLevel, level });
    if (targetLevel === "sefer") {
      setLevel("sefer");
      onParshaSelect(null);
      onPerekSelect(null);
      onPasukSelect(null);
    } else if (targetLevel === "parsha") {
      setLevel("parsha");
      onPerekSelect(null);
      onPasukSelect(null);
    } else if (targetLevel === "perek") {
      setLevel("perek");
      onPerekSelect(null);
      onPasukSelect(null);
    } else if (targetLevel === "pasuk") {
      setLevel("pasuk");
    }
  }, [onParshaSelect, onPerekSelect, onPasukSelect, level]);

  return (
    <div className="space-y-2 sm:space-y-4 bg-card rounded-lg shadow-md p-2 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2" dir="rtl">
        <div className="flex items-center gap-2 flex-wrap text-sm sm:text-base font-bold min-w-0">
          {/* Breadcrumb: שמות / יתרו / פרק כ"א / ד' */}
          {selectedSeferName && (
            <button
              onClick={() => handleBreadcrumbClick("sefer")}
              className={cn(
                "hover:text-primary transition-colors min-h-[44px] px-1",
                level === "sefer" ? "text-primary" : "text-muted-foreground hover:underline cursor-pointer"
              )}
            >
              {selectedSeferName}
            </button>
          )}
          {selectedParshaName && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <button
                onClick={() => handleBreadcrumbClick("parsha")}
                className={cn(
                  "hover:text-primary transition-colors min-h-[44px] px-1",
                  level === "parsha" ? "text-primary" : "text-muted-foreground hover:underline cursor-pointer"
                )}
              >
                {selectedParshaName}
              </button>
            </>
          )}
          {selectedPerekLabel && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <button
                onClick={() => handleBreadcrumbClick("perek")}
                className={cn(
                  "hover:text-primary transition-colors min-h-[44px] px-1",
                  level === "perek" ? "text-primary" : "text-muted-foreground hover:underline cursor-pointer"
                )}
              >
                פרק {selectedPerekLabel}
              </button>
            </>
          )}
          {selectedPasukLabel && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-primary">{selectedPasukLabel}</span>
            </>
          )}
        </div>
      </div>

      {level === "sefer" && (
        <div className={cn(
          "animate-fade-in",
          currentSefarim.length > 5
            ? "flex flex-row-reverse gap-2 overflow-x-auto pb-1 snap-x"
            : currentSefarim.length <= 2
              ? "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4"
              : "grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4"
        )}>
          {currentSefarim.map((s) => (
            <Button
              key={s.id}
              variant={selectedSefer === s.id ? "default" : "outline"}
              onClick={() => handleSeferClick(s.id)}
              className={cn(
                "h-auto py-2 sm:py-6 flex flex-col gap-1 sm:gap-2 transition-all duration-200 touch-manipulation",
                "text-base sm:text-lg min-h-[52px] sm:min-h-[100px]",
                currentSefarim.length > 5 && "min-w-[80px] flex-shrink-0 snap-start",
                selectedSefer === s.id && "shadow-lg ring-2 ring-primary"
              )}
            >
              <BookOpen className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-sm sm:text-lg font-bold leading-tight whitespace-nowrap">{s.name}</span>
            </Button>
          ))}
        </div>
      )}

      {level === "parsha" && sefer && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 animate-fade-in" dir="rtl">
          {sefer.parshiot.map((parsha) => (
            <Button
              key={parsha.parsha_id}
              variant={selectedParsha === parsha.parsha_id ? "default" : "outline"}
              onClick={() => handleParshaClick(parsha.parsha_id)}
              className="h-auto py-3 sm:py-4 text-sm sm:text-base break-words whitespace-normal transition-all duration-200"
            >
              {parsha.parsha_name}
            </Button>
          ))}
        </div>
      )}

      {level === "perek" && sefer && selectedParsha !== null && (
        <div key={`${selectedSefer}-${selectedParsha}`} className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 sm:gap-2 animate-fade-in" dir="rtl">
          {sefer.parshiot
            .find((p) => p.parsha_id === selectedParsha)?.perakim.map((perek) => (
              <Button
                key={perek.perek_num}
                variant={selectedPerek === perek.perek_num ? "default" : "outline"}
                onClick={() => handlePerekClick(perek.perek_num)}
                className="aspect-square font-bold text-sm sm:text-base transition-all duration-200"
              >
                {toHebrewNumber(perek.perek_num)}
              </Button>
            ))}
        </div>
      )}

      {level === "pasuk" && sefer && selectedParsha !== null && selectedPerek !== null && (
        <div key={`${selectedSefer}-${selectedParsha}-${selectedPerek}`} className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 sm:gap-2 animate-fade-in" dir="rtl">
          {sefer.parshiot
            .find((p) => p.parsha_id === selectedParsha)?.perakim
            .find((p) => p.perek_num === selectedPerek)?.pesukim.map((pasuk) => (
              <Button
                key={pasuk.pasuk_num}
                variant={selectedPasuk === pasuk.pasuk_num ? "default" : "outline"}
                onClick={() => handlePasukClick(pasuk.pasuk_num)}
                className="aspect-square text-xs sm:text-sm font-bold transition-all duration-200"
              >
                {toHebrewNumber(pasuk.pasuk_num)}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
};
