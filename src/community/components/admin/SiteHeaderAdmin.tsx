/**
 * How the website looks at the top: the header, and the site's themes.
 *
 * Part of "תצוגת דף הבית". These were in a "הגדרות" tab beside the
 * synagogue's address and coordinates, which are facts about the synagogue
 * rather than about the site - those are in its details, under "בתי כנסת ופרטים".
 * The header shows the name and address or one of the synagogue's logos
 * (uploaded in those details), and is chosen here.
 */
import { Hint } from "@/components/InfoTip";
import { useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BookOpen, Building2, LogIn, Megaphone, MessageSquareText, Palette, ScrollText, Users, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveDesign } from "@/lib/live-design";
import { useSaveRow } from "@community/lib/admin";
import { SettingsSaveBar, useUnsavedChangesGuard } from "@community/components/admin/HomeHeroSettings";
import { useSettings, type Settings } from "@community/lib/data";
import { readLogos } from "@community/lib/logos";
import type { SettingsWithLogos } from "./SynagogueDetails";
import { ChoiceCard, ChoiceGroup, PreviewDeviceToggle, SectionLink, SliderField, useFocusTarget } from "./adminUi";

type PreviewMode = "mobile" | "desktop";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function KarovimHeaderPreview({
  form,
  setForm,
  logoSrc,
}: {
  form: Partial<Settings>;
  setForm: Dispatch<SetStateAction<Partial<Settings>>>;
  logoSrc: string;
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
        <PreviewDeviceToggle value={isMobile ? "phone" : "computer"} onChange={(device) => setMode(device === "phone" ? "mobile" : "desktop")} />
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
          src={logoSrc}
          alt="תצוגה מקדימה של הלוגו - אפשר לגרור"
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
          איפוס מיקום {isMobile ? "בטלפון" : "במחשב"}
        </Button>
      </div>
    </div>
  );
}

/** The built-in logo, shown when the synagogue has not chosen one of its own. */
export const BUILT_IN_LOGO = "/karovim-logo-v2.png";

export function SiteHeaderSettings() {
  const { data } = useSettings();
  const save = useSaveRow("settings", "settings");
  const [form, setForm] = useState<Partial<SettingsWithLogos>>({});
  // Opened from the synagogue's details ("בחירת הלוגו שבכותרת"): brought into view.
  const focusRef = useFocusTarget<HTMLFormElement>("header", Boolean(data));

  useEffect(() => {
    if (data) setForm(data as unknown as SettingsWithLogos);
  }, [data]);

  // Only what this section owns: the header. The synagogue's own details are
  // saved from its window under "בתי כנסת".
  const ownKeys = Object.keys(form).filter(
    (k) => k === "id" || k === "home_header_variant" || k === "header_logo" || k.startsWith("karovim_logo_"),
  );
  const stored = (data ?? {}) as Record<string, unknown>;
  const changed = Boolean(data) && ownKeys.some((k) => form[k as keyof typeof form] !== stored[k]);
  useUnsavedChangesGuard(changed);

  if (!data) return <p className="text-muted-foreground">טוען…</p>;

  const logos = readLogos((data as unknown as SettingsWithLogos).logos);
  const chosen = logos.find((l) => l.id === form.header_logo) ?? null;
  const logoSrc = chosen?.url ?? BUILT_IN_LOGO;
  const logoMode = form.home_header_variant === "karovim_logo";

  const numericControl = (key: keyof Settings, label: string, min: number, max: number, fallback: number) => (
    <SliderField
      id={`setting-${key}`}
      testId={`setting-${key}`}
      label={label}
      min={min}
      max={max}
      value={Number(form[key] ?? fallback)}
      onChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
    />
  );

  return (
    <form
      ref={focusRef}
      className="card-elev scroll-mt-24 space-y-4 p-5"
      data-testid="site-header-settings"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(Object.fromEntries(ownKeys.map((k) => [k, form[k as keyof typeof form]])));
      }}
    >
      <div>
        <h3 className="text-base font-semibold">הכותרת העליונה של האתר</h3>
        <Hint>שם בית הכנסת והכתובת, או לוגו בלי שורת הכתובת.</Hint>
        <SectionLink
          hint="את הלוגואים עצמם מעלים בפרטי בית הכנסת."
          label="העלאת לוגואים"
          tab="communities"
          extra={{ details: "current" }}
          testId="go-upload-logos"
        />
      </div>
      <ChoiceGroup className="grid gap-3 sm:grid-cols-2" label="בחירת תצוגת כותרת">
        <ChoiceCard
          selected={!logoMode}
          onSelect={() => setForm({ ...form, home_header_variant: "standard" })}
          title="שם וכתובת"
          description={data.name}
        />
        <ChoiceCard
          selected={logoMode}
          label="לוגו, ללא כתובת"
          onSelect={() => setForm({ ...form, home_header_variant: "karovim_logo" })}
        >
          <img src={logoSrc} alt="" className="mx-auto h-16 w-auto object-contain" />
          <span className="mt-2 block text-center text-xs text-muted-foreground">לוגו, ללא כתובת</span>
        </ChoiceCard>
      </ChoiceGroup>

      {logoMode && (
        <section className="space-y-2" aria-label="איזה לוגו">
          <div className="text-sm font-semibold">איזה לוגו</div>
          <ChoiceGroup className="flex flex-wrap gap-2" label="בחירת לוגו לכותרת" testId="header-logo-choice">
            {[{ id: null as string | null, url: BUILT_IN_LOGO, name: "קרובים (מובנה)" }, ...logos].map((logo) => (
              <ChoiceCard
                key={logo.id ?? "built-in"}
                selected={(form.header_logo ?? null) === logo.id}
                label={logo.name}
                onSelect={() => setForm({ ...form, header_logo: logo.id })}
                className="w-32 p-2 text-center text-[11px]"
              >
                <span className="mb-1 grid h-14 place-items-center rounded-lg bg-[#16264a] p-1">
                  <img src={logo.url} alt="" className="max-h-full max-w-full object-contain" />
                </span>
                <span className="block truncate">{logo.name}</span>
              </ChoiceCard>
            ))}
          </ChoiceGroup>
          {logos.length === 0 && (
            <p className="text-xs text-muted-foreground">לבית הכנסת הזה עוד אין לוגואים משלו.</p>
          )}
        </section>
      )}

      {logoMode && (
        <section
          data-testid="karovim-logo-size-settings"
          className="space-y-4 rounded-xl border border-amber-400/30 bg-amber-50/40 p-3 sm:p-4"
          aria-labelledby="karovim-logo-size-title"
        >
          <div>
            <h3 id="karovim-logo-size-title" className="font-semibold">גודל הלוגו</h3>
            <Hint>
              המידות נשמרות באתר וחלות על כל המשתמשים. הלוגו נשאר ממורכז ומתאים את עצמו לרוחב המסך.
            </Hint>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="grid gap-3 rounded-xl border border-border bg-background/80 p-3">
              <legend className="px-2 text-sm font-semibold">טלפון</legend>
              {numericControl("karovim_logo_mobile_width", "רוחב בטלפון (פיקסלים)", 140, 360, 230)}
              {numericControl("karovim_logo_mobile_height", "גובה בטלפון (פיקסלים)", 70, 240, 130)}
              {numericControl("karovim_logo_mobile_offset_x", "מיקום אופקי בטלפון", -120, 120, 0)}
              {numericControl("karovim_logo_mobile_offset_y", "מיקום אנכי בטלפון", -80, 80, 0)}
            </fieldset>
            <fieldset className="grid gap-3 rounded-xl border border-border bg-background/80 p-3">
              <legend className="px-2 text-sm font-semibold">מחשב</legend>
              {numericControl("karovim_logo_desktop_width", "רוחב במחשב (פיקסלים)", 240, 720, 480)}
              {numericControl("karovim_logo_desktop_height", "גובה במחשב (פיקסלים)", 120, 420, 270)}
              {numericControl("karovim_logo_desktop_offset_x", "מיקום אופקי במחשב", -240, 240, 0)}
              {numericControl("karovim_logo_desktop_offset_y", "מיקום אנכי במחשב", -120, 120, 0)}
            </fieldset>
          </div>
          <KarovimHeaderPreview form={form as never} setForm={setForm as never} logoSrc={logoSrc} />
        </section>
      )}
      <SettingsSaveBar
        changed={changed}
        pending={save.isPending}
        onReset={() => setForm(data as unknown as SettingsWithLogos)}
      />
    </form>
  );
}

/**
 * The site's themes and its live design editor.
 *
 * Both open what the site already has - the themes dialog is mounted once by
 * GlobalAppShell (a second copy fought the first for the same click), and the
 * live editor is the page itself in design mode. The TV boards have their
 * own themes, in "תצוגות"; these are the website's.
 */
export function SiteDesignShortcuts() {
  const navigate = useNavigate();
  const liveDesign = useLiveDesign();
  return (
    <section className="card-elev space-y-4 p-3.5 sm:p-5" aria-labelledby="community-themes-title">
      <div>
        <h3 id="community-themes-title" className="text-base font-semibold">ערכות נושא ועיצוב חי של האתר</h3>
        <Hint>
          הצבעים והעיצוב של האתר. ללוחות הטלוויזיה יש ערכות משלהן, במדור "תצוגות".
        </Hint>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <Button
          type="button"
          className="min-h-11 justify-start gap-2 px-3 text-sm sm:justify-center"
          onClick={() => {
            // Both, like the footer's shortcut does: the dialog is lazy-loaded
            // by the shell, and a click that lands before its chunk has
            // arrived would otherwise do nothing. The flag is read on mount.
            document.documentElement.dataset.openAppThemes = "true";
            window.dispatchEvent(new CustomEvent("open-app-themes"));
          }}
        >
          <Palette className="size-5" /> פתיחת ניהול ערכות הנושא
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 justify-start gap-2 px-3 text-sm sm:justify-center"
          onClick={() => {
            liveDesign.enable();
            navigate("/community?designMode=1");
          }}
        >
          <WandSparkles className="size-5" /> פתיחת עורך עיצוב חי
        </Button>
      </div>
    </section>
  );
}
