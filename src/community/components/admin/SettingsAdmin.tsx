import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Palette, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as AppSettings } from "@/components/Settings";
import { useLiveDesign } from "@/lib/live-design";
import { useSaveRow } from "@community/lib/admin";
import { useSettings, type Settings } from "@community/lib/data";

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
