import type { TvConfig } from "@/tv/config";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * How many minyanim each frame of the medallion shows - a question of where
 * things stand, so it is under "פריסה". (It lived with the painted board's
 * editor, which is gone; the setting is still illustratedStyle.rows.)
 */
export function MedallionRows({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const rows = config.illustratedStyle.rows;
  return (
    <label className="block text-xs">
      <span className="flex justify-between">
        <span>מדליון: מניינים בכל מסגרת</span>
        <span className="tabular-nums text-muted-foreground">{rows}</span>
      </span>
      <input
        type="range"
        aria-label="מדליון: מניינים בכל מסגרת"
        min={4}
        max={10}
        step={1}
        value={rows}
        onChange={(e) =>
          onEdit("illustrated-style", (c) => ({ ...c, illustratedStyle: { ...c.illustratedStyle, rows: Number(e.target.value) } }))
        }
        className="w-full"
      />
      <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">
        כשיש יותר מניינים, המסגרת מציגה את זה שעבר ואת הבאים. שורות רבות עם טקסט גדול עלולות לא להיכנס.
      </span>
    </label>
  );
}
