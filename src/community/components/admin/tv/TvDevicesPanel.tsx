import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Link2,
  Megaphone,
  MonitorSmartphone,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  ScanEye,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNow } from "@community/lib/realtime";
import { TV_THEMES, getTheme } from "@/tv/themes";
import { DEFAULT_TV_CONFIG } from "@/tv/config";
import { formatDuration } from "@/tv/device";
import { SlideStrip, TvPreview } from "./TvPreview";
import { useTvSlides } from "./tvPreviewData";
import {
  deleteDevice,
  deviceHealth,
  renameDevice,
  requestSnapshot,
  sendCommand,
  useClaimDevice,
  useTvConfig,
  useTvDevices,
  type TvCommandName,
  type TvDevice,
} from "./tvAdminData";

/**
 * Paired screens: status, a live mirror of what each one shows, and a remote.
 *
 * The mirror is not a video feed: the TV reports which slide it is on (on
 * every change, and in its heartbeat) and the site renders that slide with
 * the same component. It updates within about a second and costs almost no
 * bandwidth. "צילום מסך אמיתי" fetches an actual picture from the TV when
 * the mirror is not enough (e.g. to check a background image or glare).
 */

export function TvDevicesPanel() {
  const devices = useTvDevices();
  const now = useNow(5000).getTime();
  const approved = (devices.data ?? []).filter((d) => d.approved);
  const pending = (devices.data ?? []).filter((d) => !d.approved);
  const queryClient = useQueryClient();

  return (
    <div className="space-y-5">
      <PairCard />

      {devices.isLoading && <p className="text-center text-muted-foreground">טוען מסכים…</p>}
      {devices.error && <p className="text-center text-destructive">לא ניתן לטעון את רשימת המסכים.</p>}

      {!devices.isLoading && approved.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <MonitorSmartphone className="mx-auto mb-2 size-8" />
          עדיין אין מסכים מצומדים. התקינו את אפליקציית הלוח על הטלוויזיה, והזינו כאן את הקוד שמופיע בפינת המסך.
        </div>
      )}

      {approved.map((d) => (
        <DeviceCard key={d.id} device={d} now={now} />
      ))}

      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {pending.length} מסכים ממתינים לצימוד (מוצגים בהם קודים). מסך שלא צומד ולא נראה שבוע נמחק אוטומטית.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            title="מוחק רק מסכים שלא צומדו. מסך אמיתי שנמחק יקבל קוד חדש בהפעלה הבאה."
            onClick={async () => {
              try {
                for (const d of pending) await deleteDevice(d.id);
                await queryClient.invalidateQueries({ queryKey: ["tv_devices"] });
                toast.success(`נוקו ${pending.length} מסכים שלא צומדו`);
              } catch {
                toast.error("הניקוי נכשל");
              }
            }}
          >
            ניקוי מסכים לא מצומדים
          </Button>
        </div>
      )}
    </div>
  );
}

function PairCard() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const claim = useClaimDevice();
  const submit = async () => {
    try {
      const d = await claim.mutateAsync({ code, name: name.trim() || "מסך בית הכנסת" });
      toast.success(`"${d.name}" צומד. שמו מוצג עכשיו על המסך לאישור.`);
      setCode("");
      setName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הצימוד נכשל");
    }
  };
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Link2 className="size-4" /> צימוד מסך חדש
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        בטלוויזיה מופיע בפינה קוד בן 6 ספרות. הקוד מבטיח שרק מסך שאתם רואים מולכם יתחבר למערכת.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div dir="ltr">
          <InputOTP maxLength={6} value={code} onChange={setCode} inputMode="numeric" pattern="^[0-9]*$" aria-label="קוד צימוד">
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם המסך, למשל: אולם ראשי" className="w-56" />
        <Button type="button" onClick={submit} disabled={code.length !== 6 || claim.isPending}>
          {claim.isPending ? "מצמד…" : "צמד מסך"}
        </Button>
      </div>
    </section>
  );
}

function DeviceCard({ device, now }: { device: TvDevice; now: number }) {
  const health = deviceHealth(device, now);
  const s = device.state ?? {};
  const saved = useTvConfig();
  const baseConfig = saved.data?.config;

  // What the TV is actually rendering: the admin's config with the theme the
  // TV reports (it may have been changed from the remote).
  const mirrorConfig = useMemo(
    () =>
      baseConfig
        ? { ...baseConfig, theme: (s.theme as typeof baseConfig.theme) ?? baseConfig.theme, themeOverrides: s.themeOverride ? {} : baseConfig.themeOverrides }
        : null,
    [baseConfig, s.theme, s.themeOverride],
  );
  // Until the saved config arrives, build from the defaults rather than an
  // empty object (buildSlides reads config.slides).
  const board = useTvSlides(mirrorConfig ?? DEFAULT_TV_CONFIG);
  const index = Math.max(0, board.slides.findIndex((x) => x.id === s.slideId));
  const clock = useNow(1000).getTime();
  const progress = s.paused
    ? (s.elapsedMs ?? 0) / ((s.slideSeconds ?? 20) * 1000)
    : s.slideStartedAt
      ? (clock - s.slideStartedAt) / ((s.slideSeconds ?? 20) * 1000)
      : 0;

  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, command: TvCommandName, payload?: Record<string, unknown>) => {
    setBusy(label);
    try {
      await sendCommand(device.id, command, payload);
      if (!health.online) toast.warning("המסך לא מחובר כרגע - הפקודה תבוצע רק אם יתחבר בדקה וחצי הקרובות.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שליחת הפקודה נכשלה");
    } finally {
      setBusy(null);
    }
  };

  const [snapshot, setSnapshot] = useState<{ image: string; capturedAt: string } | null>(null);
  const takeSnapshot = async () => {
    setBusy("snapshot");
    try {
      setSnapshot(await requestSnapshot(device.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הצילום נכשל");
    } finally {
      setBusy(null);
    }
  };

  const [message, setMessage] = useState("");
  const [messageSeconds, setMessageSeconds] = useState(30);

  return (
    <article className="rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b p-4">
        <span className={`size-3 rounded-full ${health.online ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`} aria-hidden />
        <DeviceName device={device} />
        {health.online ? (
          <Badge variant="secondary">מחובר</Badge>
        ) : (
          <Badge variant="destructive">
            מנותק{health.silentMs ? ` · לא דיווח ${formatDuration(health.silentMs)}` : ""}
          </Badge>
        )}
        {s.paused && <Badge variant="outline">⏸ מושהה</Badge>}
        {s.themeOverride && <Badge variant="outline">ערכה מהשלט: {getTheme(s.themeOverride).name}</Badge>}
        <span className="ms-auto text-xs text-muted-foreground">
          {device.app_version ? `גרסה ${device.app_version}` : ""}
          {s.screen ? ` · ${s.screen.split("@")[0]}` : ""}
          {health.lastSeen ? ` · דיווח אחרון ${health.lastSeen.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="text-sm font-medium">מה מוצג עכשיו על המסך</div>
          {mirrorConfig ? (
            <div className={health.online ? "" : "opacity-50 grayscale"}>
              <TvPreview
                {...board}
                config={mirrorConfig}
                index={index}
                paused={Boolean(s.paused)}
                progress={progress}
                cycle={s.cycle ?? 0}
                label={`שיקוף חי של ${device.name}`}
              />
            </div>
          ) : (
            <div className="aspect-video animate-pulse rounded-xl bg-muted" />
          )}
          {!health.online && (
            <p className="text-xs text-destructive">
              המסך לא מדווח. השיקוף מציג את המצב האחרון שדווח. פרטים ביומן.
            </p>
          )}
          <SlideStrip slides={board.slides} index={index} onPick={(i) => run("goto", "goto", { slideId: board.slides[i]?.id })} />
          <p className="text-xs text-muted-foreground">לחיצה על שקופית מעבירה את המסך אליה.</p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium">שלט רחוק</div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => run("prev", "prev")} disabled={busy !== null}>
                <SkipForward className="size-4" /> הקודם
              </Button>
              {s.paused ? (
                <Button type="button" size="sm" onClick={() => run("resume", "resume")} disabled={busy !== null}>
                  <Play className="size-4" /> המשך סבב
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => run("pause", "pause")} disabled={busy !== null}>
                  <Pause className="size-4" /> עצירה
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => run("next", "next")} disabled={busy !== null}>
                הבא <SkipBack className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor={`theme-${device.id}`}>
              ערכת נושא במסך הזה
            </label>
            <select
              id={`theme-${device.id}`}
              value={s.themeOverride ?? ""}
              onChange={(e) => run("theme", "theme", { theme: e.target.value || null })}
              className="block h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">לפי העיצוב השמור ({getTheme(baseConfig?.theme).name})</option>
              {TV_THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">הודעה על המסך</div>
            <Textarea
              value={message}
              maxLength={400}
              rows={2}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="למשל: תפילת מנחה תתחיל היום באיחור של 10 דקות"
            />
            <div className="flex items-center gap-2">
              <select
                aria-label="משך הצגת ההודעה"
                value={messageSeconds}
                onChange={(e) => setMessageSeconds(Number(e.target.value))}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {[15, 30, 60, 120, 300].map((sec) => (
                  <option key={sec} value={sec}>
                    {sec < 60 ? `${sec} שניות` : `${sec / 60} דקות`}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                disabled={!message.trim() || busy !== null}
                onClick={async () => {
                  await run("message", "message", { text: message.trim(), seconds: messageSeconds });
                  setMessage("");
                }}
              >
                <Megaphone className="size-4" /> הצג על המסך
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={takeSnapshot} disabled={busy !== null}>
              <Camera className="size-4" /> {busy === "snapshot" ? "מצלם…" : "צילום מסך אמיתי"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => run("identify", "identify")} disabled={busy !== null}>
              <ScanEye className="size-4" /> זיהוי מסך
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => run("reload", "reload")} disabled={busy !== null}>
              <RefreshCw className="size-4" /> טעינה מחדש
            </Button>
            <RemoveDevice device={device} />
          </div>

          {snapshot && (
            <figure className="space-y-1">
              <img src={snapshot.image} alt={`צילום מסך של ${device.name}`} className="w-full rounded-lg border" />
              <figcaption className="text-xs text-muted-foreground">
                צולם ב-{new Date(snapshot.capturedAt).toLocaleTimeString("he-IL")}
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </article>
  );
}

function DeviceName({ device }: { device: TvDevice }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(device.name);
  useEffect(() => setValue(device.name), [device.name]);
  if (!editing)
    return (
      <button type="button" className="flex items-center gap-1.5 font-semibold" onClick={() => setEditing(true)} aria-label="שינוי שם המסך">
        {device.name} <Pencil className="size-3.5 text-muted-foreground" />
      </button>
    );
  const save = async () => {
    try {
      if (value.trim() && value.trim() !== device.name) await renameDevice(device.id, value.trim());
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שינוי השם נכשל");
    }
  };
  return (
    <span className="flex items-center gap-1">
      <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} className="h-8 w-48" autoFocus />
      <Button type="button" size="sm" onClick={save}>
        שמירה
      </Button>
    </span>
  );
}

function RemoveDevice({ device }: { device: TvDevice }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-destructive">
          <Trash2 className="size-4" /> הסרה
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>להסיר את "{device.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            היומן של המסך יימחק. הטלוויזיה תמשיך להציג את הלוח ותציג קוד צימוד חדש, כך שאפשר לצמד אותה שוב.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                await deleteDevice(device.id);
                toast.success("המסך הוסר");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "ההסרה נכשלה");
              }
            }}
          >
            הסר
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
