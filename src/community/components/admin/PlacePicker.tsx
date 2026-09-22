/**
 * Where the synagogue is, chosen by name.
 *
 * Everything on the board that depends on the sun - sunrise, סוף זמן קריאת
 * שמע, פלג המנחה, שקיעה, צאת הכוכבים, הדלקת נרות and every minyan timed
 * relative to one of them - comes from two coordinates and the local
 * candle-lighting custom. Those were four numbers to type, and "קו רוחב
 * 32.0853" is not something anybody knows about their own shul. A digit
 * wrong in the fourth place does not break anything visibly: the board goes
 * on showing times, and they are somebody else's.
 *
 * So: a name. The numbers follow, and stay editable underneath for the
 * places not on the list and for a shul whose luach says otherwise.
 */
import { useMemo, useState } from "react";
import { Check, MapPin, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLACES, placeAt, searchPlaces, type Place } from "@/community/lib/places";

export function PlacePicker({
  latitude,
  longitude,
  candle,
  onPick,
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  candle: number | null | undefined;
  onPick: (p: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchPlaces(query, query ? 8 : 6), [query]);

  const here =
    typeof latitude === "number" && typeof longitude === "number"
      ? placeAt(latitude, longitude)
      : null;
  // Recognised the town, but the minutes have been changed from its custom.
  const candleDiffers = here && typeof candle === "number" && candle !== here.candle;

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4" data-testid="place-picker">
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-muted-foreground" />
        <Label className="font-semibold">מיקום בית הכנסת</Label>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        כל זמני היום מחושבים מהמיקום: הנץ, סוף זמן ק״ש, פלג המנחה, השקיעה, צאת הכוכבים והדלקת
        הנרות - וגם כל מניין שמוגדר ביחס לאחד מהם. בחירת עיר ממלאת את הכל.
      </p>

      {here ? (
        <p className="flex items-center gap-1.5 text-sm">
          <Check className="size-4 text-emerald-600" />
          <span>
            המיקום מוגדר כ<strong>{here.name}</strong> · הדלקת נרות {candle ?? here.candle} דק׳ לפני
            השקיעה
            {candleDiffers ? ` (המנהג הרווח בעיר: ${here.candle})` : ""}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          המיקום מוגדר בקואורדינטות שאינן אחת הערים שברשימה. אפשר לבחור עיר, או להשאיר כפי שהוא.
        </p>
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש עיר - למשל בני ברק"
            aria-label="חיפוש עיר"
            className="pe-9"
          />
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          {results.map((p) => {
            const active = here?.name === p.name;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onPick(p)}
                aria-pressed={active}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-sm transition hover:border-primary ${
                  active ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">נרות {p.candle} דק׳</span>
              </button>
            );
          })}
          {results.length === 0 && (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              לא נמצאה עיר בשם הזה. אפשר להזין קו רוחב וקו אורך ידנית למטה.
            </p>
          )}
        </div>
        {!query && (
          <p className="text-[11px] text-muted-foreground">
            {PLACES.length} ערים ברשימה. הקלידו כדי לחפש.
          </p>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        דקות הדלקת הנרות הן <strong>מנהג המקום</strong> ולא חישוב - ירושלים 40, חיפה וצפת 30, רוב
        הארץ 20. המספרים כאן הם המנהג הרווח והם נקודת פתיחה: אם הלוח של בית הכנסת אומר אחרת, הוא
        הקובע, ואפשר לשנות בשדה למטה.
      </p>
    </div>
  );
}
