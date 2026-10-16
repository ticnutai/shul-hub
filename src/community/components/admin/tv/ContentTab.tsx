/**
 * The content tab: a slideshow of pictures, the running ticker, and the reminders and countdowns.
 * Part of the board editor (TvDesignPanel), which owns the draft and passes in what this tab needs.
 * Everything here reads `scoped` - the board as the screen, page or occasion being worked on has
 * it - which is where the edits go too: what is shown is what is changed.
 */
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { confirmAction } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TvConfig } from "@/tv/config";
import { AlertsSettings, type AlertExample, type ExampleScreen } from "./AlertsSettings";
import { Section, Stepper, SwitchRow } from "./editorParts";
import { FileButton, useUpload } from "./Upload";

export function ContentTab({ scoped, edit, showAlertExample, exampleScreens, exampleScreen, setExampleScreen }: {
  scoped: TvConfig;
  edit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  showAlertExample: (what?: AlertExample) => void;
  /** The connected screens the reminder's example can be shown on too. */
  exampleScreens: ExampleScreen[];
  exampleScreen: string;
  setExampleScreen: (id: string) => void;
}) {
  const { uploading, upload } = useUpload();
  const addPictures = (files: File[]) =>
    upload(files, (urls) => {
      edit("show", (c) => ({
        ...c,
        slideshow: { ...c.slideshow, images: [...c.slideshow.images, ...urls.map((url) => ({ url }))] },
        slides: c.slides.map((s) => (s.kind === "slideshow" ? { ...s, enabled: true } : s)),
      }));
      toast.success(urls.length > 1 ? `${urls.length} תמונות הועלו` : "התמונה הועלתה");
    });
  return (
    <>
      <Section
        title="מצגת תמונות"
        hint="תמונות מאירועים, מודעות מעוצבות, תרומות. יוצגו כמסך נפרד. כל תמונה מותאמת אוטומטית לחדות מרבית בטלוויזיה; מודעות עם טקסט עדיף לשמור כתמונה בלי דחיסה (כשמורידים אותה, לבחור &quot;איכות מלאה&quot; ולא &quot;דחוסה&quot;), כדי שהאותיות יישארו חדות."
      >
        <div className="flex flex-wrap items-center gap-3">
          <FileButton label="הוספת תמונות" multiple busy={uploading} onFiles={(files) => void addPictures(files)} />
          <span className="flex items-center gap-2 text-sm">
            זמן לתמונה:
            <Stepper
              label="זמן לתמונה"
              value={scoped.slideshow.secondsPerImage}
              min={3}
              max={60}
              step={1}
              format={(v) => `${v} שניות`}
              onChange={(v) =>
                edit("sh-sec", (c) => ({
                  ...c,
                  slideshow: { ...c.slideshow, secondsPerImage: v },
                }))
              }
            />
          </span>
        </div>
        {scoped.slideshow.images.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {scoped.slideshow.images.map((img, i) => (
              <li key={img.url + i} className="flex items-center gap-2 rounded-lg border p-2">
                <img src={img.url} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                <Input
                  value={img.caption ?? ""}
                  placeholder="כיתוב (לא חובה)"
                  className="h-8 text-sm"
                  onChange={(e) =>
                    edit(`sh-cap:${i}`, (c) => ({
                      ...c,
                      slideshow: {
                        ...c.slideshow,
                        images: c.slideshow.images.map((x, j) =>
                          j === i ? { ...x, caption: e.target.value || undefined } : x,
                        ),
                      },
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="הסרת תמונה"
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: "להסיר את התמונה מהמצגת?",
                      description: 'אפשר להחזיר עם "צעד אחורה" (Ctrl+Z) עד השמירה.',
                      confirmLabel: "הסרה",
                    });
                    if (!ok) return;
                    edit("sh-del", (c) => ({
                      ...c,
                      slideshow: {
                        ...c.slideshow,
                        images: c.slideshow.images.filter((_, j) => j !== i),
                      },
                    }));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="סרגל הודעה רץ"
        hint="טקסט שנע בתחתית המסך. שימו לב: אנימציה רציפה - בטלוויזיה החלשה נמדדה צריכת מעבד גבוהה (כ-45%) כל עוד הסרגל פעיל."
      >
        <SwitchRow
          label="סרגל ההודעה מוצג בלוח"
          ariaLabel="סרגל ההודעה מוצג בלוח"
          checked={scoped.ticker.enabled}
          onChange={(on) => edit("tk-on", (c) => ({ ...c, ticker: { ...c.ticker, enabled: on } }))}
        />
        <Textarea
          value={scoped.ticker.text}
          maxLength={400}
          placeholder="למשל: ברוכים הבאים · שיעור העמוד היומי בכל יום ב-16:15"
          onChange={(e) =>
            edit("tk-text", (c) => ({ ...c, ticker: { ...c.ticker, text: e.target.value } }))
          }
        />
      </Section>

      <Section
        title="תזכורות וספירה לאחור"
        hint="תזכורות לפני סוף זמן קריאת שמע, סוף זמן תפילה, שקיעה ועוד: מתי הן מופיעות, באילו שלבים, ואיך הן נראות - צבעים, צורה, גודל ומיקום. ובסוף - ספירה לתפילה הבאה."
      >
        <AlertsSettings
          config={scoped}
          countdown={scoped.countdown.enabled}
          edit={edit}
          onExample={showAlertExample}
          screens={exampleScreens}
          screen={exampleScreen}
          onScreen={setExampleScreen}
        />
      </Section>
    </>
  );
}
