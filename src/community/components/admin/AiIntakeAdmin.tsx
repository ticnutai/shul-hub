import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Loader2, Mic, MicOff, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import { useMinyanCategories, useMinyanim, DAYS_HE, PRAYERS } from "@community/lib/data";
import { ZMAN_LABELS, type SolarEvent } from "@community/lib/zmanim";
import { jerusalemDateKey } from "@community/lib/minyan-time";
import { presetAnnouncementStyle } from "@community/lib/announcement-style";
import { ANNOUNCEMENT_KINDS } from "@community/lib/announcement-kinds";

/**
 * "עוזר חכם": a photo, a dictated sentence or a pasted message becomes
 * proposed changes - minyanim, one-day changes, announcements, shiurim.
 *
 * The analysis runs in the ai-intake edge function (the API key never reaches
 * the browser). It only proposes: every item shows here, can be corrected or
 * unticked, and only "אישור והכנסה" writes - with this admin's own session.
 */

type MinyanProposal = {
  action: "create" | "update";
  existing_id: string | null;
  category_id: string | null;
  new_category_name: string | null;
  prayer: string;
  label: string;
  time_mode: "fixed" | "relative";
  fixed_time: string | null;
  relative_to: SolarEvent | null;
  offset_minutes: number;
  room: string;
  note: string;
  confidence: "high" | "low";
  reason: string;
};
type OverrideProposal = {
  minyan_id: string;
  on_date: string;
  at_time: string | null;
  cancelled: boolean;
  note: string;
  reason: string;
};
type AnnouncementProposal = {
  kind: string;
  title: string;
  body: string;
  expires_at: string | null;
  pinned: boolean;
  reason: string;
};
type ShiurProposal = {
  title: string;
  teacher: string;
  description: string;
  location: string;
  schedule_type: "weekly" | "daily";
  day_of_week: number;
  time_text: string;
  reason: string;
};
type Proposal = {
  summary: string;
  questions: string[];
  minyanim: MinyanProposal[];
  overrides: OverrideProposal[];
  announcements: AnnouncementProposal[];
  shiurim: ShiurProposal[];
};
type Picked<T> = T & { _on: boolean };
type Img = { media_type: "image/jpeg"; data: string; preview: string };

/** Downscaled to what the model reads anyway (1568px long side), as JPEG - a phone photo leaves at a few hundred KB. */
async function prepareImage(file: File): Promise<Img> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const preview = canvas.toDataURL("image/jpeg", 0.85);
  return { media_type: "image/jpeg", data: preview.split(",", 2)[1]!, preview };
}

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
function newRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const on = <T,>(list: T[]): Picked<T>[] => list.map((x) => ({ ...x, _on: true }));
const input = "h-8 rounded-md border bg-background px-2 text-sm";

export function AiIntakeAdmin() {
  const qc = useQueryClient();
  const { data: categories = [] } = useMinyanCategories();
  const { data: minyanim = [] } = useMinyanim();
  const [images, setImages] = useState<Img[]>([]);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState<Pick<Proposal, "summary" | "questions"> | null>(null);
  const [mins, setMins] = useState<Picked<MinyanProposal>[]>([]);
  const [overrides, setOverrides] = useState<Picked<OverrideProposal>[]>([]);
  const [anns, setAnns] = useState<Picked<AnnouncementProposal>[]>([]);
  const [shiurim, setShiurim] = useState<Picked<ShiurProposal>[]>([]);
  const recRef = useRef<Recognition | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => recRef.current?.stop(), []);

  const catName = (id: string | null, fallback: string | null) =>
    categories.find((c) => c.id === id)?.name ?? (fallback ? `${fallback} (חדש)` : "ללא קטגוריה");
  const minyanName = (id: string) => {
    const m = minyanim.find((x) => x.id === id);
    return m ? `${m.label || PRAYERS.find((p) => p.id === m.prayer)?.label || m.prayer} · ${catName(m.category_id, null)}` : "מניין לא ידוע";
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = newRecognition();
    if (!rec) {
      toast.error("הדפדפן לא תומך בהקלטה. נסו ב-Chrome, או הקלידו.");
      return;
    }
    rec.lang = "he-IL";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0].transcript;
        else live += r[0].transcript;
      }
      if (finalText) setText((t) => (t ? `${t} ${finalText.trim()}` : finalText.trim()));
      setInterim(live);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") toast.error("צריך לאשר גישה למיקרופון");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const next = await Promise.all([...files].slice(0, 6 - images.length).map(prepareImage));
    setImages((cur) => [...cur, ...next].slice(0, 6));
  };

  const analyze = async () => {
    recRef.current?.stop();
    setBusy(true);
    setSummary(null);
    try {
      const now = new Date();
      const { data, error } = await supabase.functions.invoke("ai-intake", {
        body: {
          communityId: communityId(),
          text,
          images: images.map(({ media_type, data }) => ({ media_type, data })),
          today: jerusalemDateKey(now),
          weekday: new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" }).format(now),
        },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const detail = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(detail?.error ?? "העוזר עוד לא הופעל בשרת, או שאינו זמין כרגע.");
      }
      const p = (data as { proposal: Proposal }).proposal;
      setSummary({ summary: p.summary, questions: p.questions });
      setMins(on(p.minyanim));
      setOverrides(on(p.overrides));
      setAnns(on(p.announcements));
      setShiurim(on(p.shiurim));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הניתוח נכשל");
    } finally {
      setBusy(false);
    }
  };

  const picked = mins.filter((m) => m._on).length + overrides.filter((o) => o._on).length +
    anns.filter((a) => a._on).length + shiurim.filter((s) => s._on).length;

  const apply = async () => {
    setApplying(true);
    const cid = communityId();
    let done = 0;
    const failed: string[] = [];
    const newCats = new Map<string, string>();
    try {
      for (const m of mins.filter((x) => x._on)) {
        let categoryId = m.category_id;
        let dayType = categories.find((c) => c.id === categoryId)?.system_key ?? "custom";
        if (!categoryId && m.new_category_name) {
          const name = m.new_category_name.trim();
          categoryId = newCats.get(name) ?? null;
          if (!categoryId) {
            const { data, error } = await supabase
              .from("minyan_categories")
              .insert({ community_id: cid, name, active: true, sort_order: 100 + newCats.size * 10 } as never)
              .select("id")
              .single();
            if (error || !data) {
              failed.push(`קטגוריה ${name}`);
              continue;
            }
            categoryId = (data as { id: string }).id;
            newCats.set(name, categoryId);
          }
          dayType = "custom";
        }
        const row = {
          category_id: categoryId,
          day_type: dayType,
          prayer: m.prayer || "other",
          label: m.label,
          time_mode: m.time_mode,
          fixed_time: m.time_mode === "fixed" ? m.fixed_time : null,
          relative_to: m.time_mode === "relative" ? m.relative_to : null,
          offset_minutes: m.time_mode === "relative" ? m.offset_minutes : 0,
          room: m.room,
          note: m.note,
        };
        const { error } =
          m.action === "update" && m.existing_id
            ? await supabase.from("minyanim").update(row as never).eq("id", m.existing_id)
            : await supabase
                .from("minyanim")
                .insert({ ...row, community_id: cid, active: true, sort_order: 100, notification_enabled: false, reminder_minutes: 15 } as never);
        if (error) failed.push(m.label || m.prayer);
        else done++;
      }
      for (const o of overrides.filter((x) => x._on)) {
        const { error } = await supabase.from("minyan_overrides").upsert(
          {
            community_id: cid,
            minyan_id: o.minyan_id,
            on_date: o.on_date,
            at_time: o.cancelled ? null : o.at_time,
            cancelled: o.cancelled,
            note: o.note,
          } as never,
          { onConflict: "minyan_id,on_date" },
        );
        if (error) failed.push(`שינוי ${o.on_date}`);
        else done++;
      }
      for (const a of anns.filter((x) => x._on)) {
        const { error } = await supabase.from("announcements").insert({
          community_id: cid,
          kind: a.kind,
          title: a.title,
          body: a.body,
          expires_at: a.expires_at,
          pinned: a.pinned,
          notification_enabled: false,
          show_on_home: true,
          home_width: "half",
          sort_order: 5,
          style: presetAnnouncementStyle("classic"),
        } as never);
        if (error) failed.push(a.title);
        else done++;
      }
      for (const s of shiurim.filter((x) => x._on)) {
        const { error } = await supabase.from("shiurim").insert({
          community_id: cid,
          title: s.title,
          teacher: s.teacher,
          description: s.description,
          location: s.location,
          schedule_type: s.schedule_type,
          day_of_week: s.day_of_week,
          time_text: s.time_text,
          active: true,
          notification_enabled: false,
          reminder_minutes: 15,
          sort_order: 100,
        } as never);
        if (error) failed.push(s.title);
        else done++;
      }
    } finally {
      await qc.invalidateQueries();
      setApplying(false);
    }
    if (failed.length) toast.error(`נכנסו ${done}. נכשלו: ${failed.join(", ")}`);
    else {
      toast.success(`נכנסו ${done} פריטים`);
      setSummary(null);
      setMins([]);
      setOverrides([]);
      setAnns([]);
      setShiurim([]);
      setImages([]);
      setText("");
    }
  };

  const hasProposal = summary !== null;

  return (
    <div className="space-y-5" dir="rtl">
      <section className="card-elev space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">עוזר חכם</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          מצלמים לוח זמנים או מודעה, אומרים בקול, או מדביקים הודעה. העוזר מציע מה להכניס ולאן - ושום דבר
          לא נשמר עד שמאשרים.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-16 text-base" onClick={() => fileRef.current?.click()} disabled={busy || images.length >= 6}>
            <Camera className="size-5" /> צילום / תמונה
          </Button>
          <Button
            type="button"
            variant={listening ? "destructive" : "outline"}
            className="h-16 text-base"
            onClick={toggleMic}
            disabled={busy}
            aria-pressed={listening}
          >
            {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            {listening ? "עצירה" : "דיבור"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          data-testid="ai-images"
          onChange={(e) => {
            void addImages(e.target.files);
            e.target.value = "";
          }}
        />

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.preview} alt={`תמונה ${i + 1}`} className="h-20 w-20 rounded-md border object-cover" />
                <button
                  type="button"
                  aria-label="הסרת התמונה"
                  onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                  className="absolute -left-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="block text-sm">
          טקסט (או מה שנאמר בקול)
          <textarea
            value={listening && interim ? `${text} ${interim}` : text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={'לדוגמה: "מנחה ביום שישי 10 דקות לפני הדלקת נרות, ושיעור דף יומי כל יום ב-20:30 עם הרב כהן"'}
            className="mt-1 block w-full rounded-md border bg-background p-2 text-base"
          />
        </label>

        <Button type="button" className="h-12 w-full text-base" onClick={() => void analyze()} disabled={busy || (!text.trim() && images.length === 0)}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          {busy ? "מנתח…" : "ניתוח"}
        </Button>
      </section>

      {hasProposal && (
        <section className="card-elev space-y-4 p-5" aria-label="הצעות">
          <div>
            <h3 className="font-semibold">מה הבנתי</h3>
            <p className="text-sm">{summary.summary}</p>
            {summary.questions.length > 0 && (
              <ul className="mt-2 list-disc pr-5 text-sm text-amber-700 dark:text-amber-400">
                {summary.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            )}
          </div>

          {mins.length > 0 && (
            <Group title="מניינים">
              {mins.map((m, i) => {
                const set = (p: Partial<MinyanProposal & { _on: boolean }>) =>
                  setMins((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <Row key={i} on={m._on} onToggle={(v) => set({ _on: v })} low={m.confidence === "low"} reason={m.reason}>
                    <span className={`rounded px-1.5 text-xs ${m.action === "update" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                      {m.action === "update" ? "עדכון" : "חדש"}
                    </span>
                    <span className="text-xs text-muted-foreground">{catName(m.category_id, m.new_category_name)}</span>
                    <input aria-label="שם" value={m.label} onChange={(e) => set({ label: e.target.value })} className={`${input} w-32`} />
                    <select aria-label="סוג שעה" value={m.time_mode} onChange={(e) => set({ time_mode: e.target.value as MinyanProposal["time_mode"] })} className={input}>
                      <option value="fixed">שעה קבועה</option>
                      <option value="relative">יחסית לזמן</option>
                    </select>
                    {m.time_mode === "fixed" ? (
                      <input aria-label="שעה" type="time" value={m.fixed_time ?? ""} onChange={(e) => set({ fixed_time: e.target.value })} className={input} />
                    ) : (
                      <>
                        <input
                          aria-label="דקות"
                          type="number"
                          value={Math.abs(m.offset_minutes)}
                          onChange={(e) => set({ offset_minutes: Math.sign(m.offset_minutes || -1) * Math.abs(Number(e.target.value)) })}
                          className={`${input} w-16`}
                        />
                        <select
                          aria-label="לפני או אחרי"
                          value={m.offset_minutes < 0 ? "before" : "after"}
                          onChange={(e) => set({ offset_minutes: (e.target.value === "before" ? -1 : 1) * Math.abs(m.offset_minutes) })}
                          className={input}
                        >
                          <option value="before">דק׳ לפני</option>
                          <option value="after">דק׳ אחרי</option>
                        </select>
                        <select aria-label="זמן" value={m.relative_to ?? "sunset"} onChange={(e) => set({ relative_to: e.target.value as SolarEvent })} className={input}>
                          {(Object.keys(ZMAN_LABELS) as SolarEvent[]).map((z) => (
                            <option key={z} value={z}>
                              {ZMAN_LABELS[z]}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </Row>
                );
              })}
            </Group>
          )}

          {overrides.length > 0 && (
            <Group title="שינויים ליום אחד">
              {overrides.map((o, i) => {
                const set = (p: Partial<OverrideProposal & { _on: boolean }>) =>
                  setOverrides((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <Row key={i} on={o._on} onToggle={(v) => set({ _on: v })} reason={o.reason}>
                    <span className="text-sm">{minyanName(o.minyan_id)}</span>
                    <input aria-label="תאריך" type="date" value={o.on_date} onChange={(e) => set({ on_date: e.target.value })} className={input} />
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={o.cancelled} onChange={(e) => set({ cancelled: e.target.checked })} /> מבוטל
                    </label>
                    {!o.cancelled && (
                      <input aria-label="שעה" type="time" value={o.at_time ?? ""} onChange={(e) => set({ at_time: e.target.value })} className={input} />
                    )}
                  </Row>
                );
              })}
            </Group>
          )}

          {anns.length > 0 && (
            <Group title="מודעות">
              {anns.map((a, i) => {
                const set = (p: Partial<AnnouncementProposal & { _on: boolean }>) =>
                  setAnns((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <Row key={i} on={a._on} onToggle={(v) => set({ _on: v })} reason={a.reason}>
                    <select aria-label="סוג" value={a.kind} onChange={(e) => set({ kind: e.target.value })} className={input}>
                      {ANNOUNCEMENT_KINDS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <input aria-label="כותרת" value={a.title} onChange={(e) => set({ title: e.target.value })} className={`${input} w-full sm:w-56`} />
                    <textarea aria-label="תוכן" value={a.body} onChange={(e) => set({ body: e.target.value })} rows={2} className="w-full rounded-md border bg-background p-2 text-sm" />
                    <label className="flex items-center gap-1 text-xs">
                      עד
                      <input type="date" value={a.expires_at ?? ""} onChange={(e) => set({ expires_at: e.target.value || null })} className={input} />
                    </label>
                  </Row>
                );
              })}
            </Group>
          )}

          {shiurim.length > 0 && (
            <Group title="שיעורים">
              {shiurim.map((s, i) => {
                const set = (p: Partial<ShiurProposal & { _on: boolean }>) =>
                  setShiurim((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <Row key={i} on={s._on} onToggle={(v) => set({ _on: v })} reason={s.reason}>
                    <input aria-label="נושא" value={s.title} onChange={(e) => set({ title: e.target.value })} className={`${input} w-40`} />
                    <input aria-label="מרצה" value={s.teacher} onChange={(e) => set({ teacher: e.target.value })} className={`${input} w-32`} />
                    <select
                      aria-label="מתי"
                      value={s.schedule_type === "daily" ? "daily" : String(s.day_of_week)}
                      onChange={(e) =>
                        e.target.value === "daily"
                          ? set({ schedule_type: "daily" })
                          : set({ schedule_type: "weekly", day_of_week: Number(e.target.value) })
                      }
                      className={input}
                    >
                      <option value="daily">כל יום</option>
                      {DAYS_HE.map((d, n) => (
                        <option key={d} value={n}>
                          יום {d}
                        </option>
                      ))}
                    </select>
                    <input aria-label="שעה" value={s.time_text} onChange={(e) => set({ time_text: e.target.value })} className={`${input} w-24`} />
                  </Row>
                );
              })}
            </Group>
          )}

          {picked === 0 && mins.length + overrides.length + anns.length + shiurim.length === 0 && (
            <p className="text-sm text-muted-foreground">לא נמצא מה להכניס. נסו תמונה ברורה יותר או תיאור מפורט.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11" onClick={() => void apply()} disabled={applying || picked === 0}>
              {applying ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              אישור והכנסה ({picked})
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setSummary(null)} disabled={applying}>
              <Trash2 className="size-4" /> ביטול
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Row({
  on,
  onToggle,
  low,
  reason,
  children,
}: {
  on: boolean;
  onToggle: (v: boolean) => void;
  low?: boolean;
  reason: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-2 ${low ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/30" : ""} ${on ? "" : "opacity-50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input type="checkbox" aria-label="לכלול" checked={on} onChange={(e) => onToggle(e.target.checked)} className="size-5" />
        {children}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {low ? "⚠️ לא בטוח — כדאי לבדוק. " : ""}
        {reason}
      </p>
    </div>
  );
}
