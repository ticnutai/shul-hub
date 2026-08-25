import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveRow } from "@community/lib/admin";
import { useSettings, type Settings } from "@community/lib/data";

export function SettingsAdmin() {
  const { data } = useSettings();
  const save = useSaveRow("settings", "settings");
  const [form, setForm] = useState<Partial<Settings>>({});

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
  );
}
