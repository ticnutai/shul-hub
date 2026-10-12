import type { TvConfig } from "@/tv/config";
import { Stepper } from "./editorParts";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * How many minyanim each frame of the medallion shows - a question of where
 * things stand, so it is under "פריסה". (It lived with the painted board's
 * editor, which is gone; the setting is still illustratedStyle.rows.)
 * A count, so the same −/+ as "מניינים במסך" beside it.
 */
export function MedallionRows({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const rows = config.illustratedStyle.rows;
  return (
    <div className="mt-3 space-y-1 text-xs">
      <span className="block font-medium text-muted-foreground">מדליון: מניינים בכל מסגרת</span>
      <Stepper
        label="מדליון: מניינים בכל מסגרת"
        value={rows}
        min={4}
        max={10}
        step={1}
        onChange={(v) => onEdit("illustrated-style", (c) => ({ ...c, illustratedStyle: { ...c.illustratedStyle, rows: v } }))}
      />
      <span className="block text-[11px] leading-tight text-muted-foreground">
        כשיש יותר מניינים, המסגרת מציגה את זה שעבר ואת הבאים. שורות רבות עם טקסט גדול עלולות לא להיכנס.
      </span>
    </div>
  );
}
