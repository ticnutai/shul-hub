/**
 * The layout tab: what is on which screen, the prayers on the board, the layout and clock, long content, logos, the top of the screen and how each kind of content is drawn. On a board of parts - what is on it and on which side.
 * Part of the board editor (TvDesignPanel), which owns the draft and passes in what this tab needs.
 * Every value here is read from `scoped` - the board as the screen or page being worked on has it,
 * where the edits go too - not from the main board: what is shown is what is changed.
 */
import { Hint } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { PRAYER_DAYS, PRAYER_DAYS_LABELS, SLIDE_KIND_LABELS, SLIDE_LAYOUTS, type TvConfig } from "@/tv/config";
import { readOccasions } from "@/tv/occasions";
import { jerusalemDateKey } from "@community/lib/minyan-time";
import { FrameSpacing } from "./BoardLook";
import { LogoLibrary } from "./LogoLibrary";
import { MedallionRows } from "./MedallionRows";
import { PartsContent } from "./PartsContent";
import { ScreenComposer } from "./ScreenComposer";
import { CLOCK_CHOICES, LAYOUT_CHOICES, OVERFLOW_CHOICES, SELECT_CLASS, SPEED_CHOICES, Section, Segments, Stepper, SwitchRow } from "./editorParts";

export function LayoutTab({ scoped, view, edit, openPartsList, composerScreen, setComposerScreen, setPreviewScreen, previewAt }: {
  scoped: TvConfig;
  view: TvConfig;
  edit: (key: string, update: (c: TvConfig) => TvConfig) => void;
  openPartsList: () => void;
  composerScreen: number;
  setComposerScreen: (i: number) => void;
  setPreviewScreen: (id: string | null) => void;
  previewAt: (at: Date | null) => void;
}) {
  return (
    <>
      {view.screenLayout === 'composition' ? <Section
        id="layout-elements"
        title="1. מה יופיע על הלוח, ובאיזה צד"
        hint="בערכה מחלקים, כל תוכן עומד במסגרת משלו: מדליקים מה שרוצים להציג, ובוחרים לו צד."
      >
        <p className="text-[11px] text-muted-foreground" data-testid="composition-layout-notice">
          כאן קובעים מה מופיע בעמוד שנבחר למעלה ב"עמודי הלוח", ובאיזה צד. כל עמוד מסודר בנפרד, והלוח מתחלף בין העמודים לפי השניות של כל אחד. לשינוי גודל ולהזזה מדויקת - רשימת החלקים.
        </p>
        <PartsContent config={view} onEdit={edit} onManual={openPartsList} />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={openPartsList}>
          לרשימת החלקים
        </Button>
      </Section> : <>
      <Section
        id="layout-screens"
        title="1. מסכים ומה עליהם"
        hint="כמה מסכים, ומה מופיע בכל אחד. מסך אחד - הלוח עומד; כמה - הוא מתחלף ביניהם."
      >
        <ScreenComposer
          config={scoped}
          current={composerScreen}
          onSelect={(i, s) => {
            setComposerScreen(i);
            setPreviewScreen(s.id);
          }}
          onLayouts={(layouts) => edit("layouts", (c) => ({ ...c, layouts }))}
          onEdit={edit}
          onOccasion={(o, day) => {
            // Its screen shows only on its day: the preview goes there, and to it.
            if (!o || !day) return previewAt(null);
            previewAt(new Date(Date.parse(`${jerusalemDateKey(day)}T11:00:00+03:00`)));
            setPreviewScreen(`occasion:${o.id}`);
          }}
          onChange={(screens, next) => {
            setComposerScreen(next);
            if (screens[next]) setPreviewScreen(screens[next].id);
            // The Shabbat and day screens are occasions now: the first save
            // here fixes the occasions as they were read from those screens,
            // before the screens themselves are left behind.
            edit("screens", (c) => ({ ...c, occasions: readOccasions(c), screens }));
          }}
        />
      </Section>

      <Section
        id="layout-prayers"
        title="2. זמני התפילות בלוח"
        hint="מה הלוח מראה ואיך זה נכנס במסך. באתר ובאפליקציה זה נקבע בנפרד, בניהול המניינים."
      >
        <p className="mb-2 text-sm font-medium">אילו ימים הלוח מראה?</p>
        <div className="mb-4 grid gap-2 sm:grid-cols-3" role="group" aria-label="אילו ימים הלוח מראה" data-testid="board-prayer-days">
          {PRAYER_DAYS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scoped.prayerDays === value}
              onClick={() => edit("prayerDays", (c) => ({ ...c, prayerDays: value }))}
              className={
                "rounded-lg border p-3 text-right transition-colors " +
                (scoped.prayerDays === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")
              }
            >
              <span className="block text-sm font-medium">{PRAYER_DAYS_LABELS[value].label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{PRAYER_DAYS_LABELS[value].description}</span>
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          כל השבוע: כל יום מוצג בתורו - במסגרת התפילות של המדליון, או כמסך תפילות משלו. "הבא" ו"עבר" מסומנים רק
          בתפילות של היום. איך התפילות של יום מסודרות - בפריסת מסך התפילות, תחת "איך מוצג כל סוג תוכן".
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1 text-xs">
            <span className="block font-medium text-muted-foreground">מניינים במסך</span>
            <Stepper
              label="מניינים במסך"
              value={scoped.prayerRowsPerScreen}
              min={4}
              max={60}
              step={1}
              onChange={(v) => edit("rowsPerScreen", (c) => ({ ...c, prayerRowsPerScreen: v }))}
            />
          </div>
          <p className="flex-1 text-xs text-muted-foreground">
            יום עם הרבה מניינים לא נכנס במסך אחד: הלוח לוקח עוד מסך במקום להקטין את הטקסט. התשובה
            תלויה במסך - טלוויזיה מעל ארון הקודש מחזיקה יותר ממסך קטן על מדף. השבירה תמיד במעבר בין
            תפילות, שחרית לא תיחתך באמצע.
          </p>
        </div>
        {scoped.screenLayout === "medallion" && <MedallionRows config={scoped} onEdit={edit} />}
      </Section>

      <Section id="layout-screen" title="3. פריסת מסך" hint="איך המסך כולו מסודר. לוח שנבנה למעלה במסכים - המסכים שלו קובעים, גם בשבת.">
        <div className="grid grid-cols-2 gap-2">
          {LAYOUT_CHOICES.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={scoped.screenLayout === l.id}
              onClick={() => edit("layout", (c) => ({ ...c, screenLayout: l.id }))}
              className={`rounded-lg border p-2 text-right transition ${
                scoped.screenLayout === l.id
                  ? "ring-2 ring-primary ring-offset-2"
                  : "hover:border-primary/50"
              }`}
            >
              <span
                className="mb-2 grid aspect-video grid-cols-3 grid-rows-[auto_1fr_1fr_1fr] gap-1 rounded-md bg-[#0b1628] p-1.5 text-[#f0c35c]"
                aria-hidden
              >
                {l.sketch}
              </span>
              <span className="block text-sm font-medium">{l.name}</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">
                {l.hint}
              </span>
            </button>
          ))}
        </div>
        <FrameSpacing config={view} onEdit={edit} />

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>שעון</span>
          <Segments label="שעון" value={scoped.clockStyle} onChange={(id) => edit("clock", (cfg) => ({ ...cfg, clockStyle: id }))} options={CLOCK_CHOICES} />
        </div>
      </Section>

      <Section
        id="layout-overflow"
        title="4. כשהתוכן לא נכנס לתיבה"
        hint="יום עם הרבה מניינים, שבוע של שיעורים, הודעה ארוכה: תיבה שאין בה מקום לכול - זזה לאט, כך שהכול עובר מול הקהל. תיבה שהכול נכנס בה לא זזה."
      >
        <Segments
          label="כשהתוכן לא נכנס"
          value={scoped.overflow.mode}
          onChange={(id) => edit("overflow", (c) => ({ ...c, overflow: { ...c.overflow, mode: id } }))}
          options={OVERFLOW_CHOICES}
        />
        {scoped.overflow.mode !== "off" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">מהירות הגלילה</span>
            <Segments
              label="מהירות הגלילה"
              value={scoped.overflow.speed}
              onChange={(id) => edit("overflow-speed", (c) => ({ ...c, overflow: { ...c.overflow, speed: id } }))}
              options={SPEED_CHOICES}
            />
          </div>
        )}
        <Hint>זו ברירת המחדל לכל התיבות. חלק אחד יכול לבחור אחרת - ברשימת החלקים (לשונית עיצוב).</Hint>
      </Section>

      <Section id="layout-logos" title="5. לוגואים" hint="הלוגו של בית הכנסת, של תורמים - מספרייה משותפת לכל בתי הכנסת.">
        <LogoLibrary chosen={scoped.logos} onChange={(logos) => edit("logos", (c) => ({ ...c, logos }))} />
      </Section>

      <Section id="layout-header" title="6. ראש המסך" hint="מה מופיע ליד שם בית הכנסת, בראש כל מסך.">
        <SwitchRow
          label="לוגו קרובים ליד שם בית הכנסת"
          checked={scoped.header.logo}
          onChange={(on) => edit("h-logo", (c) => ({ ...c, header: { ...c.header, logo: on } }))}
        />
        <SwitchRow
          label="פרשת השבוע - תגית קטנה מתחת לשם"
          checked={scoped.header.parasha}
          onChange={(on) => edit("h-parasha", (c) => ({ ...c, header: { ...c.header, parasha: on } }))}
        />
        <SwitchRow
          label="הדף היומי - תגית קטנה מתחת לשם"
          checked={scoped.header.dafYomi}
          onChange={(on) => edit("h-daf", (c) => ({ ...c, header: { ...c.header, dafYomi: on } }))}
        />
      </Section>

      {/*
        How each kind of content is drawn inside its box. What is on which
        screen, and for how long, is the composer's ("מסכים ומה עליהם");
        this list used to switch them on and off too, and the two disagreed.
      */}
      <Section
        id="layout-content"
        title="7. איך מוצג כל סוג תוכן"
        hint='הפריסה של זמני התפילות, הלימוד, ההודעות והשיעורים בתוך התיבה שלהם. מה מופיע ובאיזה מסך - ב"מסכים ומה עליהם".'
      >
        <ul className="space-y-2" data-testid="content-layouts">
          {scoped.slides
            .filter((s) => SLIDE_LAYOUTS[s.kind].length > 1)
            .map((s) => (
              <li key={s.kind} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <span className="min-w-28 font-medium">{SLIDE_KIND_LABELS[s.kind]}</span>
                <select
                  aria-label={`פריסת ${SLIDE_KIND_LABELS[s.kind]}`}
                  value={s.layout}
                  onChange={(e) =>
                    edit(`slide-layout:${s.kind}`, (c) => ({
                      ...c,
                      slides: c.slides.map((x) => (x.kind === s.kind ? { ...x, layout: e.target.value } : x)),
                    }))
                  }
                  className={SELECT_CLASS}
                >
                  {SLIDE_LAYOUTS[s.kind].map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
        </ul>
      </Section>
      </>}
    </>
  );
}
