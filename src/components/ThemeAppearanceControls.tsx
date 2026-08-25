export type ThemeShadow = "none" | "soft" | "medium" | "strong";

export interface ThemeAppearanceSettings {
  cornerRadius: number;
  buttonRadius: number;
  borderWidth: number;
  shadow: ThemeShadow;
  headerShadow: boolean;
}

export const DEFAULT_THEME_APPEARANCE: ThemeAppearanceSettings = {
  cornerRadius: 12,
  buttonRadius: 10,
  borderWidth: 1,
  shadow: "soft",
  headerShadow: true,
};

export const THEME_SHADOWS: Record<ThemeShadow, string> = {
  none: "none",
  soft: "0 3px 12px rgba(15, 23, 42, 0.10)",
  medium: "0 8px 24px rgba(15, 23, 42, 0.18)",
  strong: "0 14px 36px rgba(15, 23, 42, 0.28)",
};

const SHADOW_LABELS: Record<ThemeShadow, string> = {
  none: "ללא",
  soft: "עדין",
  medium: "בינוני",
  strong: "מודגש",
};

type Props = {
  value: ThemeAppearanceSettings;
  onChange: (next: ThemeAppearanceSettings) => void;
};

export const ThemeAppearanceControls = ({ value, onChange }: Props) => {
  const update = <K extends keyof ThemeAppearanceSettings>(key: K, next: ThemeAppearanceSettings[K]) =>
    onChange({ ...value, [key]: next });

  const slider = (
    key: "cornerRadius" | "buttonRadius" | "borderWidth",
    label: string,
    min: number,
    max: number,
    suffix = "px",
  ) => (
    <label className="block rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
      <span className="mb-2 flex items-center justify-between text-[11px] text-slate-100">
        <span>{label}</span>
        <span className="font-mono text-amber-300">{value[key]}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value[key]}
        onChange={event => update(key, Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-amber-400"
      />
    </label>
  );

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-amber-300">צורה ועומק</span>
        <div className="h-px flex-1 bg-slate-700" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {slider("cornerRadius", "עיגול כרטיסים", 0, 32)}
        {slider("buttonRadius", "עיגול כפתורים", 0, 28)}
        {slider("borderWidth", "עובי מסגרת", 0, 4)}
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5">
          <span className="mb-2 block text-[11px] text-slate-100">עוצמת צל</span>
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(SHADOW_LABELS) as ThemeShadow[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => update("shadow", option)}
                className="rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors"
                style={{
                  background: value.shadow === option ? "#d5aa45" : "rgba(255,255,255,0.07)",
                  color: value.shadow === option ? "#101827" : "#e2e8f0",
                }}
              >
                {SHADOW_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => update("headerShadow", !value.headerShadow)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
      >
        <span>צל לכותרת העליונה</span>
        <span
          className="relative h-5 w-9 rounded-full transition-colors"
          style={{ background: value.headerShadow ? "#d5aa45" : "#475569" }}
        >
          <span
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
            style={{ right: value.headerShadow ? "2px" : "18px" }}
          />
        </span>
      </button>
    </div>
  );
};
