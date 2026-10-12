import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "@community/components/admin/adminMobile.css";
import { useAuth } from "@community/lib/use-auth";
import { DAYS_HE, minyanSubcategories, useMinyanCategories } from "@community/lib/data";
import { hebrewError } from "@community/lib/hebrewError";
import { ANNOUNCEMENT_KINDS } from "@community/lib/announcement-kinds";
import { useAdminButtons } from "@community/lib/adminButtons";
import { createAnnouncement, createChavruta, createMinyan, createShiur } from "@community/lib/createContent";
import { SaveButton } from "@community/components/admin/adminUi";
import { FloatingDraggable } from "./FloatingDraggable";
import { HEADER_ICON_BUTTON } from "./headerIconButton";

/**
 * "הוספה מהירה" for the gabbai: a round button floating in the corner, or a
 * small one in the top bar - as he chose in the site's settings (adminButtons).
 * Each place renders it with its own placement; only the chosen one shows.
 * What it adds is written as the full forms write it (createContent.ts): the
 * same defaults, at the end of its list.
 */

/** Writes one, says "נשמר" (or why not), refreshes its list. */
async function quickSave(
  qc: ReturnType<typeof useQueryClient>,
  queryKey: string,
  write: () => Promise<void>,
  failure: string,
): Promise<boolean> {
  try {
    await write();
  } catch (error) {
    toast.error(hebrewError(error, failure));
    return false;
  }
  await qc.invalidateQueries({ queryKey: [queryKey] });
  toast.success("נשמר");
  return true;
}
export function QuickAddButton({ placement = "floating" }: { placement?: "floating" | "header" }) {
  const { isAdmin, loading } = useAuth();
  const { prefs, set } = useAdminButtons();
  const [open, setOpen] = useState(false);
  const shown = !loading && isAdmin && prefs.quickAdd.on && prefs.quickAdd.floating === (placement === "floating");

  // Floating, it takes the corner: the assistant's button stands above it rather than on it.
  const atHome = !prefs.quickAdd.pos;
  useEffect(() => {
    if (!shown || placement !== "floating" || !atHome) return;
    const root = document.documentElement;
    root.style.setProperty("--quick-add-space", "4rem");
    return () => {
      root.style.removeProperty("--quick-add-space");
    };
  }, [shown, placement, atHome]);

  if (!shown) return null;

  return (
    <>
    {/* Room at the page's foot, so its last lines can be scrolled out from under the button. */}
    {placement === "floating" && <div aria-hidden className="h-20 md:hidden" />}
    <Dialog open={open} onOpenChange={setOpen}>
      {placement === "floating" ? (
        <FloatingDraggable
          pos={prefs.quickAdd.pos}
          onMove={(pos) => set("quickAdd", { pos })}
          home={{ left: "1rem", bottom: "calc(1.25rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" }}
        >
          <DialogTrigger asChild>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full shadow-2xl md:h-14 md:w-14"
              aria-label="הוספה מהירה"
              title="הוספה מהירה - אפשר לגרור למקום אחר"
              data-testid="quick-add-floating"
            >
              <Plus className="size-6 md:size-7" />
            </Button>
          </DialogTrigger>
        </FloatingDraggable>
      ) : (
      <DialogTrigger asChild>
          <button
            type="button"
            aria-label="הוספה מהירה"
            title="הוספה מהירה"
            data-testid="quick-add-header"
            className={HEADER_ICON_BUTTON}
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
      </DialogTrigger>
      )}
      <DialogContent
        dir="rtl"
        className="gabbai-quick-add max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 text-right sm:p-6"
      >
        <DialogHeader className="text-right">
          <DialogTitle>הוספה מהירה</DialogTitle>
          <DialogDescription>הוספת תוכן חדש בלי לעבור למסך הניהול המלא.</DialogDescription>
        </DialogHeader>
        <QuickAddTabs onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
    </>
  );
}

function QuickAddTabs({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState("announcement");
  return (
    <Tabs value={tab} onValueChange={setTab} className="mt-2">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
        <TabsTrigger value="announcement">מודעה</TabsTrigger>
        <TabsTrigger value="shiur">שיעור</TabsTrigger>
        <TabsTrigger value="chavruta">חברותא</TabsTrigger>
        <TabsTrigger value="minyan">מניין</TabsTrigger>
      </TabsList>
      <TabsContent value="announcement" className="mt-4">
        <QuickAnnouncement onDone={onDone} />
      </TabsContent>
      <TabsContent value="shiur" className="mt-4">
        <QuickShiur onDone={onDone} />
      </TabsContent>
      <TabsContent value="chavruta" className="mt-4">
        <QuickChavruta onDone={onDone} />
      </TabsContent>
      <TabsContent value="minyan" className="mt-4">
        <QuickMinyan onDone={onDone} />
      </TabsContent>
    </Tabs>
  );
}

function QuickAnnouncement({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<string>("general");
  const [pinned, setPinned] = useState(false);
  const [showOnHome, setShowOnHome] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const ok = await quickSave(
      qc,
      "announcements",
      () => createAnnouncement({ title: title.trim(), body: body.trim(), kind, pinned, show_on_home: showOnHome }),
      "שמירת המודעה נכשלה",
    );
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>סוג מודעה</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger aria-label="סוג מודעה">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANNOUNCEMENT_KINDS.map((k) => (
              <SelectItem key={k.id} value={k.id}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>כותרת</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת המודעה"
        />
      </div>
      <div className="space-y-2">
        <Label>תוכן</Label>
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="quick-pinned" checked={pinned} onCheckedChange={setPinned} />
        <Label htmlFor="quick-pinned">סימון כמודעה מוצמדת</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="quick-show-on-home" checked={showOnHome} onCheckedChange={setShowOnHome} />
        <Label htmlFor="quick-show-on-home">להציג גם בדף הבית</Label>
      </div>
      <SaveButton onClick={() => void save()} pending={saving} disabled={!title.trim()} />
    </div>
  );
}

function QuickShiur({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [teacher, setTeacher] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [day, setDay] = useState("0");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const ok = await quickSave(
      qc,
      "shiurim",
      () =>
        createShiur({
          title: title.trim(),
          teacher: teacher.trim(),
          time_text: time.trim(),
          location: location.trim(),
          day_of_week: Number(day),
        }),
      "שמירת השיעור נכשלה",
    );
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>נושא השיעור</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>מגיד השיעור</Label>
          <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>יום</Label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_HE.map((d, i) => (
                <SelectItem key={d} value={String(i)}>
                  יום {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>שעה (טקסט חופשי)</Label>
          <Input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="20:30 / אחרי מנחה"
          />
        </div>
        <div className="space-y-2">
          <Label>מיקום</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <SaveButton onClick={() => void save()} pending={saving} disabled={!title.trim()} />
    </div>
  );
}

function QuickChavruta({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [partners, setPartners] = useState("");
  const [time, setTime] = useState("");
  const [contact, setContact] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!topic.trim()) return;
    setSaving(true);
    const ok = await quickSave(
      qc,
      "chavrutot",
      () =>
        createChavruta({
          topic: topic.trim(),
          partners: partners.trim(),
          time_text: time.trim(),
          contact: contact.trim(),
          looking_for_partner: looking,
        }),
      "שמירת החברותא נכשלה",
    );
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>נושא הלימוד</Label>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>שמות הלומדים</Label>
        <Input value={partners} onChange={(e) => setPartners(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>זמן הלימוד</Label>
          <Input value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>איש קשר</Label>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="quick-looking" checked={looking} onCheckedChange={setLooking} />
        <Label htmlFor="quick-looking">מחפשים חברותא</Label>
      </div>
      <SaveButton onClick={() => void save()} pending={saving} disabled={!topic.trim()} />
    </div>
  );
}

/**
 * A minyan, into the same tabs and prayers as the full minyan form.
 *
 * It used to write only the old day type ("weekday"/"friday") with a fixed
 * list of prayers - no tab at all - so a minyan added here could land in no
 * tab, or under a prayer the synagogue's tab does not have. Now it is put in
 * a tab (category_id) and, when the tab has them, a prayer, exactly as the
 * full form does (createContent.ts).
 */
function QuickMinyan({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useMinyanCategories();
  const [label, setLabel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [prayer, setPrayer] = useState("");
  const [time, setTime] = useState("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);

  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const subcategories = minyanSubcategories(category);
  const chosenPrayer = subcategories.some((item) => item.id === prayer) ? prayer : subcategories[0]?.id ?? "other";

  async function save() {
    if (!label.trim() || !time.trim() || !category) return;
    const [hours = NaN, minutes = NaN] = time.split(":").map(Number);
    if (
      !/^\d{2}:\d{2}$/.test(time) ||
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours > 23 ||
      minutes > 59
    ) {
      toast.error("יש להזין שעה תקינה");
      return;
    }
    setSaving(true);
    const fixedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    const ok = await quickSave(
      qc,
      "minyanim",
      () =>
        createMinyan(category, {
          label: label.trim(),
          prayer: chosenPrayer,
          time_mode: "fixed",
          fixed_time: fixedTime,
          room: room.trim(),
        }),
      "שמירת המניין נכשלה",
    );
    setSaving(false);
    if (ok) onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="quick-minyan-label">שם המניין</Label>
        <Input
          id="quick-minyan-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="שחרית א׳"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>לשונית</Label>
          <Select
            value={category?.id ?? ""}
            onValueChange={(value) => {
              setCategoryId(value);
              setPrayer("");
            }}
            disabled={categories.length === 0}
          >
            <SelectTrigger aria-label="לשונית">
              <SelectValue placeholder={categories.length === 0 ? "טוען…" : "בחירת לשונית"} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {subcategories.length > 0 && (
          <div className="space-y-2">
            <Label>תפילה (שחרית, מנחה…)</Label>
            <Select value={chosenPrayer} onValueChange={setPrayer}>
              <SelectTrigger aria-label="תפילה">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subcategories.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quick-minyan-time">שעה</Label>
          <Input
            id="quick-minyan-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="07:00"
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quick-minyan-room">אולם / מיקום</Label>
          <Input id="quick-minyan-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="אולם מרכזי" />
        </div>
      </div>
      <SaveButton onClick={() => void save()} pending={saving} disabled={!label.trim() || !time.trim() || !category} />
    </div>
  );
}
