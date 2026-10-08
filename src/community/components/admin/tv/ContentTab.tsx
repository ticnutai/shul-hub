/**
 * The content tab: a slideshow of pictures, the running ticker, and the reminders and countdowns.
 * Part of the board editor (TvDesignPanel), which owns the draft and passes in what this tab needs.
 */
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { TvConfig } from "@/tv/config";
import { AlertsSettings, type AlertExample } from "./AlertsSettings";
import { Section, Stepper } from "./editorParts";

export function ContentTab({ draft, scoped, edit, uploading, upload, showAlertExample }: {
  draft: TvConfig;
  scoped: TvConfig;
  edit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  uploading: boolean;
  upload: (files: FileList | null) => Promise<void>;
  showAlertExample: (what?: AlertExample) => void;
}) {
  return (
    <>
      <Section
        title="מצגת תמונות"
        hint="תמונות מאירועים, מודעות מעוצבות, תרומות. יוצגו כשקופית נפרדת. כל תמונה מותאמת אוטומטית לחדות מרבית בטלוויזיה; מודעות עם טקסט עדיף להעלות כ-PNG."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
            <label className="cursor-pointer">
              <ImagePlus className="size-4" /> {uploading ? "מעלה…" : "הוספת תמונות"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => void upload(e.target.files)}
              />
            </label>
          </Button>
          <span className="flex items-center gap-2 text-sm">
            זמן לתמונה:
            <Stepper
              label="זמן לתמונה"
              value={draft.slideshow.secondsPerImage}
              min={3}
              max={60}
              step={1}
              format={(v) => `${v} שנ׳`}
              onChange={(v) =>
                edit("sh-sec", (c) => ({
                  ...c,
                  slideshow: { ...c.slideshow, secondsPerImage: v },
                }))
              }
            />
          </span>
        </div>
        {draft.slideshow.images.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {draft.slideshow.images.map((img, i) => (
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
                  onClick={() =>
                    edit("sh-del", (c) => ({
                      ...c,
                      slideshow: {
                        ...c.slideshow,
                        images: c.slideshow.images.filter((_, j) => j !== i),
                      },
                    }))
                  }
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
        hint="טקסט שנע בתחתית המסך. שימו לב: אנימציה רציפה - בטלוויזיה החלשה נמדדה צריכת מעבד גבוהה (~45%) כל עוד הסרגל פעיל."
      >
        <label className="flex items-center gap-3">
          <Switch
            checked={scoped.ticker.enabled}
            onCheckedChange={(on) =>
              edit("tk-on", (c) => ({ ...c, ticker: { ...c.ticker, enabled: on } }))
            }
          />
          הצגת סרגל
        </label>
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
        <AlertsSettings config={draft} countdown={scoped.countdown.enabled} edit={edit} onExample={showAlertExample} />
      </Section>
    </>
  );
}
