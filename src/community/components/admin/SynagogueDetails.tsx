/**
 * One synagogue's own details: who it is, where it is, and its logos.
 *
 * These lived in a "הגדרות" tab that always meant the synagogue being edited,
 * so fixing the address of one shul meant switching the whole admin over to
 * it first. They belong to the synagogue, so they open from its row in "בתי
 * כנסת" and are saved to that synagogue - whichever one is being edited.
 *
 * What the site's header shows (the name and address, or one of these logos)
 * is a question about the site, and is answered in "תצוגת דף הבית". Here are
 * only the facts and the files.
 *
 * The name is kept in two places in the database - the list of synagogues and
 * the synagogue's settings - and it is one field here, written to both, so
 * the switcher and the site can never disagree about what a shul is called.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@community/integrations/supabase/client";
import type { Settings } from "@community/lib/data";
import { readLogos, type SynagogueLogo } from "@community/lib/logos";
import { PlacePicker } from "./PlacePicker";


/** The settings row with the columns newer than the generated types. */
export type SettingsWithLogos = Settings & { logos?: SynagogueLogo[] | null; header_logo?: string | null };


const MAX_LOGO_BYTES = 3 * 1024 * 1024;

export function SynagogueDetailsDialog({
  community,
  canRename,
  onClose,
}: {
  community: { id: string; name: string } | null;
  /** The list of synagogues is the platform admin's to change. */
  canRename: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const open = Boolean(community);
  const id = community?.id ?? "";
  const [form, setForm] = useState<Partial<SettingsWithLogos>>({});
  const [saving, setSaving] = useState(false);
  /**
   * Whether the name was edited here. Only then is the list's name changed:
   * the two can already differ (אושר של יהודי is "בית הכנסת" on its site),
   * and saving an address must not quietly rename a synagogue.
   */
  const [renamed, setRenamed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Files uploaded in this window and not saved yet: removed if it is closed without saving. */
  const pending = useRef<string[]>([]);
  const close = () => {
    if (pending.current.length) void supabase.storage.from("community-media").remove(pending.current);
    pending.current = [];
    onClose();
  };

  const row = useQuery({
    queryKey: ["synagogue-details", id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("community_id", id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SettingsWithLogos | null;
    },
  });

  useEffect(() => {
    setRenamed(false);
    if (row.data) setForm({ ...row.data, logos: readLogos(row.data.logos) });
    else if (open && row.isFetched) setForm({ name: community?.name });
  }, [row.data, row.isFetched, open, community?.name]);

  const logos = readLogos(form.logos);
  const set = (patch: Partial<SettingsWithLogos>) => setForm((f) => ({ ...f, ...patch }));

  const field = (key: keyof Settings, label: string, type: "text" | "number" = "text", testId?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`syn-${String(key)}`}>{label}</Label>
      <Input
        id={`syn-${String(key)}`}
        data-testid={testId}
        type={type}
        dir={type === "number" ? "ltr" : undefined}
        value={String(form[key] ?? "")}
        onChange={(e) => set({ [key]: type === "number" ? Number(e.target.value) : e.target.value } as Partial<SettingsWithLogos>)}
      />
    </div>
  );

  async function uploadLogos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const added: SynagogueLogo[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`"${file.name}" אינו קובץ תמונה`);
          continue;
        }
        if (file.size > MAX_LOGO_BYTES) {
          toast.error(`"${file.name}" גדול מדי (עד 3MB)`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        const path = `logos/${id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("community-media").upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("community-media").getPublicUrl(path);
        added.push({ id: crypto.randomUUID(), url: data.publicUrl, path, name: file.name.replace(/\.[^.]+$/, "") });
        pending.current.push(path);
      }
      if (added.length) {
        set({ logos: [...logos, ...added] });
        toast.success(added.length === 1 ? "הלוגו הועלה. לשמירה לחצו \"שמירה\"." : `${added.length} לוגואים הועלו. לשמירה לחצו "שמירה".`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!row.data?.id) {
      toast.error("לבית הכנסת הזה עדיין אין שורת הגדרות");
      return;
    }
    setSaving(true);
    try {
      const saved = readLogos(row.data.logos);
      const kept = new Set(logos.map((l) => l.id));
      const payload = {
        name: form.name,
        subtitle: form.subtitle,
        address: form.address,
        phone: form.phone,
        city: form.city,
        latitude: form.latitude,
        longitude: form.longitude,
        elevation: form.elevation,
        candle_offset_minutes: form.candle_offset_minutes,
        tzeit_offset_minutes: form.tzeit_offset_minutes,
        shabbat_end_minutes: form.shabbat_end_minutes,
        logos,
        // A logo taken away cannot stay the one in the header.
        header_logo: form.header_logo && kept.has(form.header_logo) ? form.header_logo : null,
      };
      const { error } = await supabase
        .from("settings")
        .update(payload as never)
        .eq("id", row.data.id)
        .eq("community_id", id);
      if (error) throw error;
      const name = (form.name ?? "").trim();
      if (canRename && renamed && name && name !== community?.name) {
        const { error: renameError } = await supabase.from("communities").update({ name }).eq("id", id);
        if (renameError) throw renameError;
      }
      // Files of logos that were removed go too, once the row no longer points at them.
      const gone = saved.filter((l) => !kept.has(l.id)).map((l) => l.path);
      if (gone.length) await supabase.storage.from("community-media").remove(gone);
      await Promise.all(
        [["settings"], ["synagogue-details", id], ["communities-overview"], ["my-communities"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      // Uploaded files that were then removed before saving are not kept either.
      const unsaved = pending.current.filter((p) => !logos.some((l) => l.path === p));
      if (unsaved.length) await supabase.storage.from("community-media").remove(unsaved);
      pending.current = [];
      toast.success("פרטי בית הכנסת נשמרו");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto text-right" data-testid="synagogue-details">
        <DialogHeader className="text-right">
          <DialogTitle>{community?.name}</DialogTitle>
          <DialogDescription>
            הפרטים והמיקום של בית הכנסת, והלוגואים שלו. מה מוצג בכותרת האתר נבחר ב"תצוגת דף הבית".
          </DialogDescription>
        </DialogHeader>

        {row.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> טוען…
          </p>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="syn-name">שם בית הכנסת</Label>
                <Input
                  id="syn-name"
                  data-testid="syn-name"
                  value={String(form.name ?? "")}
                  onChange={(e) => {
                    setRenamed(true);
                    set({ name: e.target.value });
                  }}
                />
                {community && form.name && form.name !== community.name && (
                  <p className="text-[11px] text-muted-foreground">
                    ברשימת בתי הכנסת ובבחירה בראש העמוד הוא נקרא "{community.name}".
                    {canRename ? " שינוי השם כאן יעדכן גם שם." : ""}
                  </p>
                )}
              </div>
              {field("subtitle", "כותרת משנה")}
              {field("address", "כתובת", "text", "syn-address")}
              {field("phone", "טלפון")}
            </section>

            <section className="space-y-3">
              {/* PlacePicker carries its own "מיקום בית הכנסת" heading. */}
              <PlacePicker
                latitude={form.latitude as number | undefined}
                longitude={form.longitude as number | undefined}
                candle={form.candle_offset_minutes as number | undefined}
                onPick={(place) =>
                  set({
                    city: place.name,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    elevation: place.elevation,
                    candle_offset_minutes: place.candle,
                  })
                }
              />
              <details className="rounded-2xl border border-border p-4">
                <summary className="cursor-pointer text-sm font-semibold">כוונון ידני של הקואורדינטות והדקות</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {field("latitude", "קו רוחב", "number")}
                  {field("longitude", "קו אורך", "number")}
                  {field("candle_offset_minutes", "הדלקת נרות — דקות לפני השקיעה", "number")}
                  {field("tzeit_offset_minutes", "צאת הכוכבים — דקות אחרי השקיעה", "number")}
                  {field("shabbat_end_minutes", "צאת שבת וחג — דקות אחרי השקיעה (40 מקובל, 72 ר״ת)", "number")}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  קווי האורך והרוחב קובעים את חישוב זמני היום באתר ובלוח. ברירת המחדל היא בני ברק.
                </p>
              </details>
            </section>

            <section className="space-y-3" data-testid="synagogue-logos">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">לוגואים</h3>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  aria-label="העלאת לוגו"
                  onChange={(e) => void uploadLogos(e.target.files)}
                />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} הוספת לוגו
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                אפשר להעלות כמה לוגואים. איזה מהם מופיע בכותרת האתר - בוחרים ב"תצוגת דף הבית".
              </p>
              {logos.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  עדיין אין לוגואים. בכותרת אפשר להציג את לוגו קרובים המובנה.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-3">
                  {logos.map((logo) => (
                    <li key={logo.id} className="space-y-2 rounded-xl border p-2">
                      <div className="grid h-24 place-items-center rounded-lg bg-[#16264a] p-2">
                        <img src={logo.url} alt={logo.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          aria-label="שם הלוגו"
                          value={logo.name}
                          className="h-8 text-xs"
                          onChange={(e) =>
                            set({ logos: logos.map((l) => (l.id === logo.id ? { ...l, name: e.target.value } : l)) })
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`מחיקת ${logo.name}`}
                          onClick={() => set({ logos: logos.filter((l) => l.id !== logo.id) })}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                      {form.header_logo === logo.id && (
                        <p className="text-[11px] font-medium text-primary">מוצג עכשיו בכותרת האתר</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="button" onClick={() => void save()} disabled={saving || uploading} data-testid="syn-save">
                {saving && <Loader2 className="size-4 animate-spin" />} שמירה
              </Button>
              <Button type="button" variant="ghost" onClick={close}>
                ביטול
              </Button>
              {!canRename && (
                <p className="ms-auto self-center text-[11px] text-muted-foreground">
                  השם נשמר לאתר; שם בית הכנסת ברשימה משתנה על ידי מנהל המערכת.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
