import { Switch } from "@/components/ui/switch";
import { ADMIN_BUTTONS, useAdminButtons } from "@community/lib/adminButtons";

/**
 * The admin's own buttons, each with its own switches: shown or not, and -
 * when shown - floating in the corner of the screen or a small icon in the
 * top bar. Kept for this admin, apart on the phone and on the computer.
 */
export function AdminButtonsSettings() {
  const { prefs, set } = useAdminButtons();
  return (
    <section className="card-elev space-y-4 p-5" data-testid="admin-buttons-settings" aria-label="כפתורי מנהל">
      <div>
        <h3 className="text-base font-semibold">כפתורי מנהל</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          הכפתורים שרק אתם, כמנהלים, רואים. לכל כפתור: האם להציג אותו, והאם הוא צף מעל הדף (ואפשר לגרור אותו למקום שלא מפריע) או אייקון קטן בסרגל העליון ליד שם החשבון. ההגדרה שלכם בלבד, ונשמרת בנפרד בטלפון ובמחשב.
        </p>
      </div>
      <ul className="space-y-3">
        {ADMIN_BUTTONS.map((b) => {
          const p = prefs[b.id];
          return (
            <li key={b.id} className="rounded-lg border p-3" data-testid={`admin-button-${b.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{b.label}</div>
                  <div className="text-xs text-muted-foreground">{b.hint}</div>
                </div>
                <Switch checked={p.on} onCheckedChange={(on) => set(b.id, { on })} aria-label={`הצגת ${b.label}`} />
              </div>
              {p.on && (
                <label className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm">
                  <span>
                    כפתור צף
                    <span className="block text-xs text-muted-foreground">
                      {p.floating ? "צף מעל הדף. אפשר לגרור אותו באצבע או בעכבר לכל מקום במסך, והוא נשאר שם" : "אייקון קטן בסרגל העליון, ליד שם החשבון"}
                    </span>
                  </span>
                  <Switch checked={p.floating} onCheckedChange={(floating) => set(b.id, { floating })} aria-label={`${b.label} - כפתור צף`} />
                </label>
              )}
              {p.on && p.floating && p.pos && (
                <button type="button" className="mt-2 text-xs underline" onClick={() => set(b.id, { pos: undefined })}>
                  החזרת הכפתור לפינה
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
