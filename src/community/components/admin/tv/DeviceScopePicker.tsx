/**
 * Which screen the editor is working on.
 *
 * The answer you give once when you sit down - "I am fixing the phone now" -
 * rather than a scope attached to every control. Everything below it then
 * means what it says, and the preview is that screen's board.
 *
 * "כל התצוגות" is first and is where it starts, because it is almost always
 * right: a board is one board, and the wall, the laptop and the phone
 * should normally say the same thing. Only what genuinely has to differ -
 * a title too long for a phone, a panel that belongs on the wall alone -
 * is worth keeping in three places, and the dot on a tab is there to say
 * which screens have been given something of their own, so that a board
 * that quietly disagrees with itself cannot hide.
 */
import { Monitor, Smartphone, Tv, Layers, type LucideIcon } from "lucide-react";

import { deviceHasOverrides, type TvConfig } from "@/tv/config";
import { DEVICE_CLASSES, DEVICE_CLASS_LABELS, type DeviceClass } from "@/tv/devices";

export type DeviceScope = DeviceClass | "all";

const ICONS: Record<DeviceClass, LucideIcon> = {
  tv: Tv,
  desktop: Monitor,
  mobile: Smartphone,
};

export function DeviceScopePicker({
  scope,
  onScope,
  config,
}: {
  scope: DeviceScope;
  onScope: (s: DeviceScope) => void;
  config: TvConfig;
}) {
  const custom = DEVICE_CLASSES.filter((d) => deviceHasOverrides(config, d));

  return (
    <div className="space-y-1.5">
      <div
        className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        role="radiogroup"
        aria-label="התצוגה שנערכת"
        data-testid="device-scope"
      >
        <ScopeButton
          active={scope === "all"}
          onClick={() => onScope("all")}
          icon={Layers}
          label="כל התצוגות"
        />
        {DEVICE_CLASSES.map((d) => (
          <ScopeButton
            key={d}
            active={scope === d}
            onClick={() => onScope(d)}
            icon={ICONS[d]}
            label={DEVICE_CLASS_LABELS[d]}
            marked={custom.includes(d)}
          />
        ))}
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground">
        {scope === "all" ? (
          <>
            כל שינוי כאן חל על הטלוויזיה, על המחשב ועל הנייד יחד. זו ברירת המחדל, וברוב המקרים היא
            הנכונה.
            {custom.length > 0 && (
              <>
                {" "}
                <strong>
                  {custom.map((d) => DEVICE_CLASS_LABELS[d]).join(" ו")} כבר מוגדר בנפרד
                </strong>{" "}
                בחלק מהדברים, ושם השינוי הזה לא ייראה.
              </>
            )}
          </>
        ) : (
          <>
            השינויים כאן יחולו על <strong>{DEVICE_CLASS_LABELS[scope as DeviceClass]}</strong> בלבד.
            כל דבר שלא תשנו כאן ממשיך לעקוב אחרי ״כל התצוגות״.
          </>
        )}
      </p>
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  icon: Icon,
  label,
  marked = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  marked?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
      {marked && (
        <span
          className="size-1.5 rounded-full bg-primary"
          title="למסך הזה יש הגדרות משלו"
          aria-label="למסך הזה יש הגדרות משלו"
        />
      )}
    </button>
  );
}
