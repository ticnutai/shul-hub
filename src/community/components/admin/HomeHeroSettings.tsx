/**
 * The strip at the top of the home page, in the admin: its layout, its look,
 * and what it shows - with the strip itself drawn underneath, today's date
 * and times in it, so what is chosen is seen before it is saved.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HomeHero } from "@community/components/HomeHero";
import { useSaveRow } from "@community/lib/admin";
import { useSettings } from "@community/lib/data";
import {
  DEFAULT_HOME_HERO, HERO_IMAGE, HERO_LAYOUTS, HERO_LOOKS, normalizeHomeHero, type HeroLayout, type HeroName, type HomeHero as Hero,
} from "@community/lib/homeHero";
import { zmanimFor } from "@community/lib/minyan-time";
import { formatTime } from "@community/lib/zmanim";
import { formatHebrewDate } from "@community/lib/hebrewDate";
import { IMAGE_ACCEPT, IMAGE_LIMIT_TEXT, UPLOADED_TEXT, uploadImage } from "@community/lib/uploadImage";
import { useUnsavedChangesGuard } from "@community/lib/unsavedChanges";
import { ChoiceCard, ChoiceGroup, PreviewDeviceToggle, SaveButton, type PreviewDevice } from "./adminUi";

/**
 * While a settings form has changes that were not saved, leaving the page -
 * or moving to another section inside the gabbai's area - asks first. Kept
 * here under its old name for the forms that import it from here; the guard
 * itself is in unsavedChanges.ts.
 */
export { useUnsavedChangesGuard };

/**
 * The save row of a settings form, the same in every one: "שמירה" first,
 * "ביטול השינויים" beside it, and a line saying so while something is
 * changed and not saved. Whatever else a form offers comes after.
 */
export function SettingsSaveBar({
  changed,
  pending,
  onSubmit,
  onReset,
  children,
}: {
  changed: boolean;
  pending: boolean;
  /** For a button outside a form; inside one it simply submits. */
  onSubmit?: () => void;
  onReset: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SaveButton pending={pending} disabled={!changed} onClick={onSubmit} />
      <Button type="button" variant="outline" disabled={!changed || pending} onClick={onReset}>
        ביטול השינויים
      </Button>
      {children}
      {changed && <span className="text-xs text-amber-700">יש שינויים שלא נשמרו</span>}
    </div>
  );
}

const same = (a: Hero, b: Hero) => JSON.stringify(a) === JSON.stringify(b);
/** The phone's own layout, when it is "the same as on a computer" (a list cannot hold an empty value). */
const SAME_AS_COMPUTER = "same";

export function HomeHeroSettings() {
  const { data: settings } = useSettings();
  const save = useSaveRow("settings", "settings");
  const stored = normalizeHomeHero((settings as { home_hero?: unknown } | null | undefined)?.home_hero);
  const [hero, setHero] = useState<Hero>(stored);
  const storedKey = JSON.stringify(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setHero(stored), [storedKey]);
  /** The preview as a phone or as a computer, whatever this screen is. */
  const [device, setDevice] = useState<PreviewDevice>("computer");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const changed = Boolean(settings) && !same(hero, stored);
  useUnsavedChangesGuard(changed);

  if (!settings) return <p className="text-muted-foreground">טוען…</p>;

  const today = new Date();
  const zmanim = zmanimFor(today, settings);
  const headerShowsName = settings.home_header_variant !== "karovim_logo";
  const set = (patch: Partial<Hero>) => setHero((h) => ({ ...h, ...patch }));
  /** Into the synagogue's own picture storage; the strip keeps only its address. */
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadImage(file, `hero/${settings.community_id}`);
      if (!uploaded) return;
      if (!HERO_IMAGE.test(uploaded.url)) {
        toast.error("כתובת התמונה לא תקינה");
        return;
      }
      set({ image: uploaded.url });
      toast.success(UPLOADED_TEXT);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <form
      className="card-elev space-y-5 p-5"
      data-testid="home-hero-settings"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ id: settings.id, home_hero: hero });
      }}
    >
      <div>
        <h3 className="text-base font-semibold">הרצועה בראש דף הבית</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          איך נראית הרצועה שמתחת לכותרת העליונה, באתר ובאפליקציה: הפריסה, הצבעים, ומה מופיע בה. התצוגה למטה מראה בדיוק מה יופיע.
        </p>
      </div>

      <section className="space-y-2" aria-label="פריסה">
        <div className="text-sm font-semibold">פריסה</div>
        <ChoiceGroup className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" label="פריסת הרצועה">
          {HERO_LAYOUTS.map((l) => (
            <ChoiceCard key={l.id} selected={hero.layout === l.id} onSelect={() => set({ layout: l.id })} title={l.name} description={l.hint} />
          ))}
        </ChoiceGroup>
      </section>

      {hero.layout !== "none" && (
        <>
          <section className="space-y-2" aria-label="ערכת צבעים">
            <div className="text-sm font-semibold">ערכת צבעים</div>
            <ChoiceGroup className="flex flex-wrap gap-2" label="ערכת הצבעים של הרצועה">
              {HERO_LOOKS.map((l) => (
                <ChoiceCard key={l.id} selected={hero.look === l.id} onSelect={() => set({ look: l.id })} className="flex items-center gap-2 py-2">
                  <span aria-hidden className="size-6 shrink-0 rounded-full border border-black/10" style={{ background: l.swatch }} />
                  <span className="text-sm">{l.name}</span>
                </ChoiceCard>
              ))}
            </ChoiceGroup>
          </section>

          <section className="space-y-2" aria-label="תמונת רקע">
            <div className="text-sm font-semibold">תמונה של בית הכנסת ברקע</div>
            <p className="text-xs text-muted-foreground">
              במקום צבע: תמונה, ומעליה גוון כהה או בהיר כדי שהכתב יהיה קריא. בפריסת "כרטיסים" התמונה לא מופיעה. {IMAGE_LIMIT_TEXT}.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {hero.image && <img src={hero.image} alt="תמונת הרקע" className="h-14 w-24 rounded-md border object-cover" />}
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden /> {uploading ? "מעלה…" : hero.image ? "החלפת התמונה" : "העלאת תמונה"}
              </Button>
              <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="sr-only" aria-label="בחירת תמונה לרקע הרצועה" onChange={(e) => void upload(e.target.files?.[0])} />
              {hero.image && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <span>גוון מעל התמונה</span>
                    <Select name="hero-shade" value={hero.shade} onValueChange={(v) => set({ shade: v as Hero["shade"] })}>
                      <SelectTrigger aria-label="גוון מעל התמונה" className="h-9 w-auto min-w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">כהה, כתב בהיר</SelectItem>
                        <SelectItem value="light">בהיר, כתב כהה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set({ image: null })}>
                    <Trash2 className="size-4" aria-hidden /> בלי תמונה
                  </Button>
                </>
              )}
            </div>
          </section>

          <section className="space-y-2" aria-label="מה מופיע ברצועה">
            <div className="text-sm font-semibold">מה מופיע ברצועה</div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>שם בית הכנסת</span>
              <Select name="hero-name" value={hero.name} onValueChange={(v) => set({ name: v as HeroName })}>
                <SelectTrigger aria-label="שם בית הכנסת ברצועה" className="h-9 w-auto min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">רק כשהכותרת העליונה לא מראה אותו (בלי כפילות)</SelectItem>
                  <SelectItem value="show">תמיד</SelectItem>
                  <SelectItem value="hide">אף פעם</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hero.name === "auto" && (
              <p className="text-xs text-muted-foreground">
                {headerShowsName ? "הכותרת העליונה מראה את השם והכתובת, ולכן הרצועה לא חוזרת עליו." : "הכותרת העליונה מראה לוגו, ולכן השם מופיע ברצועה."}
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {([["subtitle", "שורת הברכה (\"קהילה, תורה ותפילה\")"], ["date", "התאריך העברי והלועזי"], ["zmanim", "נץ ושקיעה"], ["next", "התפילה הבאה (\"מנחה 13:30 · בעוד 25 דקות\")"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <Switch checked={hero[k]} onCheckedChange={(on) => set({ [k]: on })} aria-label={label} />
                  {label}
                </label>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="space-y-2" aria-label="בטלפון ובאפליקציה">
        <div className="text-sm font-semibold">בטלפון ובאפליקציה</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>פריסה במסך צר</span>
          <Select
            name="hero-phone-layout"
            value={hero.phoneLayout ?? SAME_AS_COMPUTER}
            onValueChange={(v) => set({ phoneLayout: v === SAME_AS_COMPUTER ? null : (v as HeroLayout) })}
          >
            <SelectTrigger aria-label="פריסה בטלפון" className="h-9 w-auto min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SAME_AS_COMPUTER}>כמו במחשב</SelectItem>
              {HERO_LAYOUTS.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">למשל רצועה דקה בטלפון, כדי שזמני התפילות יופיעו מיד בפתיחת האפליקציה.</p>
      </section>

      <section className="space-y-2" aria-label="תצוגה מקדימה">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">כך זה ייראה</div>
          <PreviewDeviceToggle value={device} onChange={setDevice} />
        </div>
        <div className={`overflow-hidden rounded-xl border bg-background ${device === "phone" ? "mx-auto max-w-[380px]" : ""}`} data-testid="home-hero-preview" data-device={device} dir="rtl">
          <HomeHero
            hero={hero}
            headerShowsName={headerShowsName}
            settings={settings}
            hebrewDate={formatHebrewDate(today)}
            dateLabel={new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem" }).format(today)}
            sunrise={formatTime(zmanim.sunrise)}
            sunset={formatTime(zmanim.sunset)}
            next={{ label: "מנחה", time: "13:30", minutes: 810, inMinutes: 25 }}
            preview
            device={device}
          />
          {(device === "phone" && hero.phoneLayout ? hero.phoneLayout : hero.layout) === "none" && <p className="p-4 text-center text-sm text-muted-foreground">אין רצועה - הדף מתחיל מיד בזמני התפילות.</p>}
          <div className="h-6" aria-hidden />
        </div>
      </section>

      <SettingsSaveBar changed={changed} pending={save.isPending} onReset={() => setHero(stored)}>
        <Button type="button" variant="ghost" disabled={same(hero, DEFAULT_HOME_HERO)} onClick={() => setHero(DEFAULT_HOME_HERO)}>חזרה לברירת המחדל</Button>
      </SettingsSaveBar>
    </form>
  );
}
