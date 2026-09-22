/**
 * What the controls below are about to change.
 *
 * There is no switcher here on purpose. Editors that put the device picker
 * in one place and the "which device am I editing" setting in another
 * produce the single most common complaint about this kind of tool: you
 * change something, nothing happens, and it took effect on a screen you
 * were not looking at. So there is one switcher - the device strip over the
 * preview - and this says, in words, what it currently means.
 *
 * It also names the screens that already carry settings of their own, and
 * lets them be put back. A board that quietly disagrees with itself is the
 * thing that makes people stop trusting the editor, and the way out has to
 * be one click and not a hunt.
 */
import { RotateCcw, Monitor, Smartphone, Tv, Layers, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deviceHasOverrides, type TvConfig } from "@/tv/config";
import { DEVICE_CLASSES, DEVICE_CLASS_LABELS, type DeviceClass } from "@/tv/devices";

export type DeviceScope = DeviceClass | "all";

const ICONS: Record<DeviceScope, LucideIcon> = {
  all: Layers,
  tv: Tv,
  desktop: Monitor,
  mobile: Smartphone,
};

export function DeviceScopeBanner({
  scope,
  config,
  onClear,
}: {
  scope: DeviceScope;
  config: TvConfig;
  /** Put one screen back to following the board. */
  onClear: (device: DeviceClass) => void;
}) {
  const custom = DEVICE_CLASSES.filter((d) => deviceHasOverrides(config, d));
  const Icon = ICONS[scope];
  const editingOne = scope !== "all";

  return (
    <div
      data-testid="device-scope"
      data-scope={scope}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 text-xs ${
        editingOne ? "border-primary/40 bg-primary/5" : "bg-muted/40"
      }`}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        <Icon className="size-4" />
        {editingOne ? (
          <>עורך עכשיו: {DEVICE_CLASS_LABELS[scope as DeviceClass]}</>
        ) : (
          <>עורך עכשיו: כל התצוגות</>
        )}
      </span>

      <span className="text-muted-foreground">
        {editingOne ? (
          <>
            השינויים יחולו על {DEVICE_CLASS_LABELS[scope as DeviceClass]} בלבד. כל דבר שלא תשנו כאן
            ממשיך לעקוב אחרי שאר התצוגות.
          </>
        ) : (
          <>כל שינוי חל על הטלוויזיה, על המחשב ועל הנייד יחד. להתאמה לתצוגה אחת - בחרו אותה למעלה.</>
        )}
      </span>

      {custom.length > 0 && (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">מוגדר בנפרד:</span>
          {custom.map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant="outline"
              className="h-6 gap-1 px-2 text-[11px]"
              title={`ביטול ההתאמות של ${DEVICE_CLASS_LABELS[d]} - התצוגה תחזור לעקוב אחרי כל התצוגות`}
              onClick={() => onClear(d)}
            >
              {DEVICE_CLASS_LABELS[d]}
              <RotateCcw className="size-3" />
            </Button>
          ))}
        </span>
      )}
    </div>
  );
}
