/**
 * The strip at the top of the home page, in the admin: its layout, its look,
 * and what it shows - with the strip itself drawn underneath, today's date
 * and times in it, so what is chosen is seen before it is saved.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Monitor, Smartphone, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { HomeHero } from "@community/components/HomeHero";
import { useSaveRow } from "@community/lib/admin";
import { useSettings } from "@community/lib/data";
import {
  DEFAULT_HOME_HERO, HERO_IMAGE, HERO_LAYOUTS, HERO_LOOKS, normalizeHomeHero, type HeroLayout, type HeroName, type HomeHero as Hero,
} from "@community/lib/homeHero";
import { zmanimFor } from "@community/lib/minyan-time";
import { formatTime } from "@community/lib/zmanim";
import { formatHebrewDate } from "@community/lib/hebrewDate";

const same = (a: Hero, b: Hero) => JSON.stringify(a) === JSON.stringify(b);
/** A picture for the strip: big enough for a wide screen, small enough for a phone on the way. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function HomeHeroSettings() {
  const { data: settings } = useSettings();
  const save = useSaveRow("settings", "settings");
  const stored = normalizeHomeHero((settings as { home_hero?: unknown } | null | undefined)?.home_hero);
  const [hero, setHero] = useState<Hero>(stored);
  const storedKey = JSON.stringify(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setHero(stored), [storedKey]);
  /** The preview as a phone or as a computer, whatever this screen is. */
  const [device, setDevice] = useState<"computer" | "phone">("computer");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!settings) return <p className="text-muted-foreground">טוען…</p>;

  const today = new Date();
  const zmanim = zmanimFor(today, settings);
  const headerShowsName = settings.home_header_variant !== "karovim_logo";
  const set = (patch: Partial<Hero>) => setHero((h) => ({ ...h, ...patch }));
  const changed = !same(hero, stored);
  /** Into the synagogue's own picture storage; the strip keeps only its address. */
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast.error("בחרו תמונה (JPEG, PNG או WebP)");
    if (file.size > MAX_IMAGE_BYTES) return toast.error("התמונה גדולה מדי (עד 4MB)");
    setUploading(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `hero/${settings.community_id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("community-media").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const url = supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl;
      if (!HERO_IMAGE.test(url)) throw new Error("כתובת התמונה לא תקינה");
      set({ image: url });
      toast.success('התמונה הועלתה. לשמירה לחצו "שמירה".');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const choice = (on: boolean) => `rounded-xl border p-3 text-right transition ${on ? "border-amber-500 ring-2 ring-amber-200" : "border-border hover:border-amber-300"}`;

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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="פריסת הרצועה">
          {HERO_LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={hero.layout === l.id} className={choice(hero.layout === l.id)} onClick={() => set({ layout: l.id })}>
              <span className="block font-semibold">{l.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{l.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {hero.layout !== "none" && (
        <>
          <section className="space-y-2" aria-label="ערכת צבעים">
            <div className="text-sm font-semibold">ערכת צבעים</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ערכת הצבעים של הרצועה">
              {HERO_LOOKS.map((l) => (
                <button key={l.id} type="button" role="radio" aria-checked={hero.look === l.id} className={`${choice(hero.look === l.id)} flex items-center gap-2 py-2`} onClick={() => set({ look: l.id })}>
                  <span aria-hidden className="size-6 shrink-0 rounded-full border border-black/10" style={{ background: l.swatch }} />
                  <span className="text-sm">{l.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2" aria-label="תמונת רקע">
            <div className="text-sm font-semibold">תמונה של בית הכנסת ברקע</div>
            <p className="text-xs text-muted-foreground">במקום צבע: תמונה, ומעליה גוון כהה או בהיר כדי שהכתב יהיה קריא. בפריסת "כרטיסים" התמונה לא מופיעה.</p>
            <div className="flex flex-wrap items-center gap-2">
              {hero.image && <img src={hero.image} alt="תמונת הרקע" className="h-14 w-24 rounded-md border object-cover" />}
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden /> {uploading ? "מעלה…" : hero.image ? "החלפת התמונה" : "העלאת תמונה"}
              </Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="בחירת תמונה לרקע הרצועה" onChange={(e) => void upload(e.target.files?.[0])} />
              {hero.image && (
                <>
                  <label className="flex items-center gap-1 text-sm">
                    גוון מעל התמונה
                    <select aria-label="גוון מעל התמונה" value={hero.shade} onChange={(e) => set({ shade: e.target.value as Hero["shade"] })} className="h-9 rounded-md border bg-background px-2 text-sm">
                      <option value="dark">כהה, כתב בהיר</option>
                      <option value="light">בהיר, כתב כהה</option>
                    </select>
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set({ image: null })}>
                    <Trash2 className="size-4" aria-hidden /> בלי תמונה
                  </Button>
                </>
              )}
            </div>
          </section>

          <section className="space-y-2" aria-label="מה מופיע ברצועה">
            <div className="text-sm font-semibold">מה מופיע ברצועה</div>
            <label className="flex flex-wrap items-center gap-2 text-sm">
              שם בית הכנסת
              <select aria-label="שם בית הכנסת ברצועה" value={hero.name} onChange={(e) => set({ name: e.target.value as HeroName })} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="auto">רק כשהכותרת העליונה לא מראה אותו (בלי כפילות)</option>
                <option value="show">תמיד</option>
                <option value="hide">אף פעם</option>
              </select>
            </label>
            {hero.name === "auto" && (
              <p className="text-xs text-muted-foreground">
                {headerShowsName ? "הכותרת העליונה מראה את השם והכתובת, ולכן הרצועה לא חוזרת עליו." : "הכותרת העליונה מראה לוגו, ולכן השם מופיע ברצועה."}
              </p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {([["subtitle", "שורת הברכה (\"קהילה, תורה ותפילה\")"], ["date", "התאריך העברי והלועזי"], ["zmanim", "נץ ושקיעה"], ["next", "התפילה הבאה (\"מנחה 13:30 · בעוד 25 דקות\")"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={hero[k]} onChange={(e) => set({ [k]: e.target.checked })} className="size-4" />
                  {label}
                </label>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="space-y-2" aria-label="בטלפון ובאפליקציה">
        <div className="text-sm font-semibold">בטלפון ובאפליקציה</div>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          פריסה במסך צר
          <select aria-label="פריסה בטלפון" value={hero.phoneLayout ?? ""} onChange={(e) => set({ phoneLayout: (e.target.value || null) as HeroLayout | null })} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">כמו במחשב</option>
            {HERO_LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">למשל רצועה דקה בטלפון, כדי שזמני התפילות יופיעו מיד בפתיחת האפליקציה.</p>
      </section>

      <section className="space-y-2" aria-label="תצוגה מקדימה">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">כך זה ייראה</div>
          <div className="flex gap-1" role="radiogroup" aria-label="תצוגה מקדימה במחשב או בטלפון">
            {([["computer", "מחשב", Monitor], ["phone", "טלפון", Smartphone]] as const).map(([id, label, Icon]) => (
              <Button key={id} type="button" size="sm" variant={device === id ? "default" : "outline"} role="radio" aria-checked={device === id} onClick={() => setDevice(id)}>
                <Icon className="size-4" aria-hidden /> {label}
              </Button>
            ))}
          </div>
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

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!changed || save.isPending}>{save.isPending ? "שומר…" : "שמירה"}</Button>
        <Button type="button" variant="outline" disabled={!changed} onClick={() => setHero(stored)}>ביטול השינויים</Button>
        <Button type="button" variant="ghost" disabled={same(hero, DEFAULT_HOME_HERO)} onClick={() => setHero(DEFAULT_HOME_HERO)}>חזרה לברירת המחדל</Button>
        {changed && <span className="text-xs text-amber-700">יש שינויים שלא נשמרו</span>}
      </div>
    </form>
  );
}
