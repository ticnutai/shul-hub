import { memo, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toHebrewNumber } from "@/utils/hebrewNumbers";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import {
  HAFTARAH_MINHAG_KEY,
  loadHaftarahTexts,
  readStored,
  writeStored,
  type HaftarahMinhag,
  type HaftarahRange,
  type HaftarahVerse,
} from "@/utils/aliyot";

const MINHAGIM: Array<{ id: HaftarahMinhag; label: string }> = [
  { id: "ashkenazi", label: "אשכנז" },
  { id: "sephardi", label: "ספרד ועדות המזרח" },
  { id: "chabad", label: "חב״ד" },
];

const refLabel = (r: HaftarahRange) =>
  `${r.bookHe} ${toHebrewNumber(r.begin.perek)} ${toHebrewNumber(r.begin.pasuk)} – ` +
  (r.end.perek === r.begin.perek ? toHebrewNumber(r.end.pasuk) : `${toHebrewNumber(r.end.perek)} ${toHebrewNumber(r.end.pasuk)}`);

interface HaftarahViewProps {
  /** The parsha's own haftarah, by minhag */
  regular: (m: HaftarahMinhag) => HaftarahRange[];
  /** This Shabbat's replacement (Rosh Chodesh, Shabbat Shuva…), when there is one */
  special?: { label: string; ranges: Record<HaftarahMinhag, HaftarahRange[]> };
}

export const HaftarahView = memo(({ regular, special }: HaftarahViewProps) => {
  const { settings } = useFontAndColorSettings();
  const [minhag, setMinhag] = useState<HaftarahMinhag>(() =>
    readStored(HAFTARAH_MINHAG_KEY, ["ashkenazi", "sephardi", "chabad"] as const, "ashkenazi"),
  );
  const [useSpecial, setUseSpecial] = useState(true);
  const [texts, setTexts] = useState<Record<string, HaftarahVerse[]> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadHaftarahTexts()
      .then((t) => alive && setTexts(t))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const showingSpecial = !!special && useSpecial;
  const ranges = showingSpecial ? special!.ranges[minhag] : regular(minhag);

  const pickMinhag = (m: HaftarahMinhag) => {
    setMinhag(m);
    writeStored(HAFTARAH_MINHAG_KEY, m);
  };

  return (
    <div dir="rtl" data-testid="haftarah-view" className="w-full max-w-4xl mx-auto animate-fade-in">
      <div className="rounded-xl border border-border/50 bg-card/70 shadow-lg p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-primary">הפטרה</h2>
            <p className="text-sm text-muted-foreground">{ranges.map(refLabel).join(" · ")}</p>
          </div>
          <div role="radiogroup" aria-label="מנהג" className="inline-flex flex-wrap rounded-lg border border-border bg-background/60 p-0.5">
            {MINHAGIM.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={minhag === m.id}
                data-testid={`haftarah-minhag-${m.id}`}
                onClick={() => pickMinhag(m.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                  minhag === m.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {special && (
          <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm flex flex-wrap items-center gap-2">
            <span>
              השבת הקרובה היא <strong>{special.label}</strong>, ובה מפטירים הפטרה אחרת.
            </span>
            <button
              type="button"
              className="underline text-primary"
              onClick={() => setUseSpecial((v) => !v)}
              data-testid="haftarah-toggle-special"
            >
              {useSpecial ? "להפטרה הרגילה של הפרשה" : `להפטרת ${special.label}`}
            </button>
          </div>
        )}

        {!texts && !failed && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {failed && <p className="text-center text-muted-foreground py-8">לא ניתן לטעון את טקסט ההפטרה כעת.</p>}

        {texts &&
          ranges.map((r) => {
            const verses = texts[r.textKey];
            return (
              <div key={r.textKey} className="mb-6 last:mb-0">
                {ranges.length > 1 && (
                  <div className="text-sm font-semibold text-primary/80 mb-2">{refLabel(r)}</div>
                )}
                {verses ? (
                  <p
                    className="text-right"
                    style={{
                      fontFamily: settings?.pasukFont || "'David Libre', 'Noto Serif Hebrew', serif",
                      fontSize: settings?.pasukSize ? `${settings.pasukSize}px` : "1.25rem",
                      lineHeight: 2.1,
                      color: settings?.pasukColor || "hsl(var(--foreground))",
                    }}
                  >
                    {verses.map(([perek, pasuk, text], i) => (
                      <span key={`${perek}:${pasuk}`}>
                        {i > 0 && perek !== verses[i - 1][0] && <span className="block h-2" aria-hidden />}
                        <span
                          className="font-bold select-none text-primary"
                          style={{ fontSize: "0.7em", verticalAlign: "super", lineHeight: 0, marginInlineEnd: "0.2em" }}
                        >
                          {pasuk === 1 || i === 0 ? `${toHebrewNumber(perek)}:` : ""}
                          {toHebrewNumber(pasuk)}
                        </span>
                        {text}{" "}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-muted-foreground">הטקסט של {refLabel(r)} אינו זמין במאגר.</p>
                )}
              </div>
            );
          })}

        <p className="mt-6 text-[0.7rem] text-muted-foreground/80">
          נוסח המקרא: מקרא על פי המסורה, דרך ספריא (CC-BY-SA). החלוקה לפי מנהג: hebcal.
        </p>
      </div>
    </div>
  );
});
HaftarahView.displayName = "HaftarahView";
