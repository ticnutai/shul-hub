import { useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, BookOpen, Building2, LogIn, Megaphone, MessageSquareText, Monitor, Palette, ScrollText, Smartphone, Users, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as AppSettings } from "@/components/Settings";
import { useLiveDesign } from "@/lib/live-design";
import { useSaveRow } from "@community/lib/admin";
import { useSettings, type Settings } from "@community/lib/data";

type PreviewMode = "mobile" | "desktop";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function KarovimHeaderPreview({
  form,
  setForm,
}: {
  form: Partial<Settings>;
  setForm: Dispatch<SetStateAction<Partial<Settings>>>;
}) {
  const [mode, setMode] = useState<PreviewMode>("mobile");
  const drag = useRef<null | { clientX: number; clientY: number; x: number; y: number; scaleX: number; scaleY: number }>(null);
  const isMobile = mode === "mobile";
  const logicalWidth = isMobile ? 390 : 900;
  const logicalHeight = isMobile ? 270 : 250;
  const widthKey = isMobile ? "karovim_logo_mobile_width" : "karovim_logo_desktop_width";
  const heightKey = isMobile ? "karovim_logo_mobile_height" : "karovim_logo_desktop_height";
  const xKey = isMobile ? "karovim_logo_mobile_offset_x" : "karovim_logo_desktop_offset_x";
  const yKey = isMobile ? "karovim_logo_mobile_offset_y" : "karovim_logo_desktop_offset_y";
  const logoWidth = Number(form[widthKey] ?? (isMobile ? 230 : 480));
  const logoHeight = Number(form[heightKey] ?? (isMobile ? 130 : 270));
  const offsetX = Number(form[xKey] ?? 0);
  const offsetY = Number(form[yKey] ?? 0);
  const maxX = isMobile ? 120 : 240;
  const maxY = isMobile ? 80 : 120;

  const updatePosition = (x: number, y: number) => {
    setForm((current) => ({
      ...current,
      [xKey]: Math.round(clamp(x, -maxX, maxX)),
      [yKey]: Math.round(clamp(y, -maxY, maxY)),
    }));
  };

  const startDrag = (event: ReactPointerEvent<HTMLImageElement>) => {
    const canvas = event.currentTarget.parentElement;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    drag.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: offsetX,
      y: offsetY,
      scaleX: logicalWidth / bounds.width,
      scaleY: logicalHeight / bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!drag.current) return;
    updatePosition(
      drag.current.x + (event.clientX - drag.current.clientX) * drag.current.scaleX,
      drag.current.y + (event.clientY - drag.current.clientY) * drag.current.scaleY,
    );
  };

  return (
    <div className="space-y-3" data-testid="karovim-header-preview-shell">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">תצוגה מקדימה חיה של כל אזור הכותרת</p>
        <div className="flex rounded-lg border border-border bg-background p-1" role="group" aria-label="סוג תצוגה מקדימה">
          <button
            type="button"
            aria-pressed={isMobile}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs ${isMobile ? "bg-sidebar text-white" : "text-muted-foreground"}`}
            onClick={() => setMode("mobile")}
          >
            <Smartphone className="size-3.5" /> מובייל
          </button>
          <button
            type="button"
            aria-pressed={!isMobile}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs ${!isMobile ? "bg-sidebar text-white" : "text-muted-foreground"}`}
            onClick={() => setMode("desktop")}
          >
            <Monitor className="size-3.5" /> מחשב
          </button>
        </div>
      </div>
      <div
        data-testid="karovim-header-preview"
        data-preview-mode={mode}
        className={`relative mx-auto w-full overflow-hidden rounded-xl border border-amber-400/40 bg-[#172c57] text-[#d4af37] shadow-inner ${isMobile ? "max-w-[390px]" : "max-w-[900px]"}`}
        style={{ aspectRatio: `${logicalWidth} / ${logicalHeight}` }}
      >
        <span className="absolute right-[3%] top-[5%] text-[clamp(8px,2.5vw,13px)] font-bold">ב״ה</span>
        <div className="absolute left-[3%] top-[3%] flex items-center gap-[clamp(4px,1.5vw,10px)] text-white/85">
          <Bell className="size-[clamp(11px,3vw,18px)]" />
          <MessageSquareText className="size-[clamp(11px,3vw,18px)]" />
          <LogIn className="size-[clamp(11px,3vw,18px)] text-amber-300" />
        </div>
        <img
          data-testid="karovim-logo-size-preview"
          src="/karovim-logo-v2.png"
          alt="תצוגה מקדימה של לוגו קרובים — ניתן לגרירה"
          className="absolute z-10 touch-none select-none object-contain active:cursor-grabbing"
          draggable={false}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          style={{
            left: `${50 + (offsetX / logicalWidth) * 100}%`,
            top: `${(isMobile ? 16 : 3) + (offsetY / logicalHeight) * 100}%`,
            width: `${(logoWidth / logicalWidth) * 100}%`,
            height: `${(logoHeight / logicalHeight) * 100}%`,
            transform: "translateX(-50%)",
            cursor: "grab",
          }}
        />
        <div className="absolute inset-x-0 bottom-[13%] flex items-center justify-center gap-[3%] border-y border-amber-400/35 py-[1.7%] text-[clamp(7px,1.8vw,11px)] font-semibold">
          <span className="inline-flex items-center gap-1"><Building2 className="size-[1.1em]" /> בית הכנסת</span>
          <span className="inline-flex items-center gap-1"><BookOpen className="size-[1.1em]" /> סידור</span>
          <span className="inline-flex items-center gap-1"><ScrollText className="size-[1.1em]" /> חומש ומפרשים</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-[13%] items-center justify-center gap-[9%] bg-[#142951] text-[clamp(7px,1.8vw,11px)] font-semibold">
          <span className="inline-flex items-center gap-1"><BookOpen className="size-[1.1em]" /> שיעורים</span>
          <span className="inline-flex items-center gap-1"><Users className="size-[1.1em]" /> חברותות</span>
          <span className="inline-flex items-center gap-1"><Megaphone className="size-[1.1em]" /> מודעות</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>אפשר לגרור את הלוגו בתוך התצוגה או להשתמש בבקרי המיקום.</span>
        <Button type="button" variant="outline" size="sm" onClick={() => updatePosition(0, 0)}>
          איפוס מיקום {isMobile ? "במובייל" : "במחשב"}
        </Button>
      </div>
    </div>
  );
}

export function SettingsAdmin() {
  const { data } = useSettings();
  const save = useSaveRow("settings", "settings");
  const [form, setForm] = useState<Partial<Settings>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const liveDesign = useLiveDesign();
  const settingsTab = searchParams.get("settingsTab") === "themes" ? "themes" : "general";

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!data) return <p className="text-muted-foreground">טוען…</p>;

  const numericControl = (
    key: keyof Settings,
    label: string,
    min: number,
    max: number,
    fallback: number,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`setting-${key}`}>{label}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2" dir="ltr">
        <Input
          type="range"
          aria-label={`שינוי ${label}`}
          min={min}
          max={max}
          step={1}
          value={String(form[key] ?? fallback)}
          onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
          className="h-8 cursor-pointer px-0"
        />
        <Input
          id={`setting-${key}`}
          data-testid={`setting-${key}`}
          type="number"
          min={min}
          max={max}
          step={1}
          value={String(form[key] ?? fallback)}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            setForm({ ...form, [key]: Number.isFinite(parsed) ? parsed : fallback });
          }}
        />
      </div>
    </div>
  );

  const field = (key: keyof Settings, label: string, type: "text" | "number" = "text") => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        dir={type === "number" ? "ltr" : undefined}
        value={String(form[key] ?? "")}
        onChange={(e) =>
          setForm({
            ...form,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          })
        }
      />
    </div>
  );

  return (
    <>
      <Tabs
        dir="rtl"
        value={settingsTab}
        onValueChange={(tab) => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", "settings");
          if (tab === "themes") next.set("settingsTab", "themes");
          else next.delete("settingsTab");
          setSearchParams(next, { replace: true });
        }}
        className="min-w-0 space-y-3 text-right sm:space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1">
          <TabsTrigger value="general" className="min-h-10 px-2 text-xs sm:text-sm">פרטי בית הכנסת</TabsTrigger>
          <TabsTrigger value="themes" className="min-h-10 gap-1.5 px-2 text-xs sm:gap-2 sm:text-sm">
            <Palette className="size-4" /> ערכות נושא
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <form
            className="card-elev space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ ...form });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {field("name", "שם בית הכנסת")}
              {field("subtitle", "כותרת משנה")}
              {field("address", "כתובת")}
              {field("phone", "טלפון")}
              {field("latitude", "קו רוחב", "number")}
              {field("longitude", "קו אורך", "number")}
              {field("candle_offset_minutes", "הדלקת נרות — דקות לפני השקיעה", "number")}
              {field("tzeit_offset_minutes", "צאת הכוכבים — דקות אחרי השקיעה", "number")}
            </div>
            <fieldset className="space-y-3 rounded-2xl border border-border p-4">
              <legend className="px-2 font-semibold">תצוגת הכותרת העליונה</legend>
              <p className="text-xs text-muted-foreground">
                אפשר להציג את שם בית הכנסת והכתובת, או את לוגו קרובים ללא שורת הכתובת.
              </p>
              <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="בחירת תצוגת כותרת">
                <button
                  type="button"
                  aria-pressed={(form.home_header_variant ?? "standard") === "standard"}
                  className={`rounded-xl border p-3 text-right transition ${(form.home_header_variant ?? "standard") === "standard" ? "border-amber-500 ring-2 ring-amber-200" : "border-border"}`}
                  onClick={() => setForm({ ...form, home_header_variant: "standard" })}
                >
                  <span className="block font-semibold">שם וכתובת</span>
                  <span className="mt-1 block text-xs text-muted-foreground">התצוגה הקיימת</span>
                </button>
                <button
                  type="button"
                  aria-pressed={form.home_header_variant === "karovim_logo"}
                  className={`rounded-xl border p-3 text-right transition ${form.home_header_variant === "karovim_logo" ? "border-amber-500 ring-2 ring-amber-200" : "border-border"}`}
                  onClick={() => setForm({ ...form, home_header_variant: "karovim_logo" })}
                >
                  <img
                    src="/karovim-logo-v2.png"
                    alt="קרובים – להיות קרוב זה יהודי"
                    className="mx-auto h-16 w-auto object-contain"
                  />
                  <span className="mt-2 block text-center text-xs text-muted-foreground">לוגו בלבד, ללא כתובת</span>
                </button>
              </div>
              {form.home_header_variant === "karovim_logo" && (
                <section
                  data-testid="karovim-logo-size-settings"
                  className="space-y-4 rounded-xl border border-amber-400/30 bg-amber-50/40 p-3 sm:p-4"
                  aria-labelledby="karovim-logo-size-title"
                >
                  <div>
                    <h3 id="karovim-logo-size-title" className="font-semibold">גודל לוגו קרובים</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      המידות נשמרות באתר וחלות על כל המשתמשים. הלוגו נשאר ממורכז ומתאים את עצמו לרוחב המסך.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <fieldset className="grid gap-3 rounded-xl border border-border bg-background/80 p-3">
                      <legend className="px-2 text-sm font-semibold">מובייל</legend>
                      {numericControl("karovim_logo_mobile_width", "רוחב במובייל (פיקסלים)", 140, 360, 230)}
                      {numericControl("karovim_logo_mobile_height", "גובה במובייל (פיקסלים)", 70, 240, 130)}
                      {numericControl("karovim_logo_mobile_offset_x", "מיקום אופקי במובייל", -120, 120, 0)}
                      {numericControl("karovim_logo_mobile_offset_y", "מיקום אנכי במובייל", -80, 80, 0)}
                    </fieldset>
                    <fieldset className="grid gap-3 rounded-xl border border-border bg-background/80 p-3">
                      <legend className="px-2 text-sm font-semibold">מחשב</legend>
                      {numericControl("karovim_logo_desktop_width", "רוחב במחשב (פיקסלים)", 240, 720, 480)}
                      {numericControl("karovim_logo_desktop_height", "גובה במחשב (פיקסלים)", 120, 420, 270)}
                      {numericControl("karovim_logo_desktop_offset_x", "מיקום אופקי במחשב", -240, 240, 0)}
                      {numericControl("karovim_logo_desktop_offset_y", "מיקום אנכי במחשב", -120, 120, 0)}
                    </fieldset>
                  </div>
                  <KarovimHeaderPreview form={form} setForm={setForm} />
                </section>
              )}
            </fieldset>
            <p className="text-xs text-muted-foreground">
              קווי האורך והרוחב קובעים את חישוב זמני היום. ברירת המחדל היא בני ברק (32.0853, 34.8338).
            </p>
            <Button type="submit" disabled={save.isPending}>
              שמירת הגדרות
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="themes" className="mt-0">
          <section className="card-elev space-y-4 p-3.5 sm:space-y-5 sm:p-5" aria-labelledby="community-themes-title">
            <div>
              <h2 id="community-themes-title" className="text-lg font-bold sm:text-xl">ערכות נושא ועיצוב חי</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                כל הערכות המובנות והמותאמות, עריכה, שכפול, שמירה ופרסום — באותה מערכת קיימת וללא כפילויות.
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              <Button
                type="button"
                className="min-h-11 justify-start gap-2 px-3 text-sm sm:min-h-14 sm:justify-center"
                onClick={() => window.dispatchEvent(new CustomEvent("open-app-themes"))}
              >
                <Palette className="size-5" /> פתיחת מנהל ערכות הנושא
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 justify-start gap-2 px-3 text-sm sm:min-h-14 sm:justify-center"
                onClick={() => {
                  liveDesign.enable();
                  navigate("/community?designMode=1");
                }}
              >
                <WandSparkles className="size-5" /> פתיחת עורך עיצוב חי
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              בעורך החי אפשר לבחור רכיב אמיתי בעמוד, לשנות צבעים, גופנים, מידות, ריווח, מסגרות וצללים, ולשמור לפי רכיב, סוג רכיב או היקף גלובלי.
            </p>
          </section>
        </TabsContent>
      </Tabs>
      <AppSettings showTrigger={false} />
    </>
  );
}
