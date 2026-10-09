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
import { supabase } from "@community/integrations/supabase/client";
import { useAuth } from "@community/lib/use-auth";
import { DAYS_HE, PRAYERS } from "@community/lib/data";
import { ANNOUNCEMENT_KINDS } from "@community/lib/announcement-kinds";
import { communityId } from "@/community/lib/community";
import { useAdminButtons } from "@community/lib/adminButtons";
import { FloatingDraggable } from "./FloatingDraggable";

/**
 * "הוספה מהירה" for the admin: a round button floating in the corner, or a
 * small one in the top bar - as he chose in the site's settings (adminButtons).
 * Each place renders it with its own placement; only the chosen one shows.
 */
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
            className="inline-flex size-9 items-center justify-center rounded-full border border-amber-400/45 bg-amber-400/10 text-amber-300 transition hover:bg-amber-400/20 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
      </DialogTrigger>
      )}
      <DialogContent
        dir="rtl"
        className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto text-right"
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
      <TabsList className="flex h-auto flex-wrap justify-start">
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
  const [pinned, setPinned] = useState(false);
  const [showOnHome, setShowOnHome] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      community_id: communityId(),
      title: title.trim(),
      body: body.trim(),
      kind: "general",
      pinned,
      notification_enabled: false,
      show_on_home: showOnHome,
    });
    setSaving(false);
    if (error) {
      toast.error("שמירת המודעה נכשלה");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["announcements"] });
    toast.success("המודעה נשמרה");
    onDone();
  }

  return (
    <div className="space-y-4">
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
      <Button onClick={save} disabled={saving || !title.trim()}>
        שמירה
      </Button>
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
    const { error } = await supabase.from("shiurim").insert({
      community_id: communityId(),
      title: title.trim(),
      teacher: teacher.trim(),
      time_text: time.trim(),
      location: location.trim(),
      day_of_week: Number(day),
      schedule_type: "weekly",
      sort_order: 100,
      active: true,
      notification_enabled: false,
      reminder_minutes: 15,
    });
    setSaving(false);
    if (error) {
      toast.error("שמירת השיעור נכשלה");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["shiurim"] });
    toast.success("השיעור נשמר");
    onDone();
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
          <Label>שעה</Label>
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
      <Button onClick={save} disabled={saving || !title.trim()}>
        שמירה
      </Button>
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
    const { error } = await supabase.from("chavrutot").insert({
      community_id: communityId(),
      topic: topic.trim(),
      partners: partners.trim(),
      time_text: time.trim(),
      contact: contact.trim(),
      looking_for_partner: looking,
      sort_order: 100,
      active: true,
      notification_enabled: false,
    });
    setSaving(false);
    if (error) {
      toast.error("שמירת החברותא נכשלה");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["chavrutot"] });
    toast.success("החברותא נשמרה");
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>נושא</Label>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>שותפים קיימים</Label>
        <Input value={partners} onChange={(e) => setPartners(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>שעה</Label>
          <Input value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>איש קשר</Label>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="quick-looking" checked={looking} onCheckedChange={setLooking} />
        <Label htmlFor="quick-looking">מחפש שותף</Label>
      </div>
      <Button onClick={save} disabled={saving || !topic.trim()}>
        שמירה
      </Button>
    </div>
  );
}

function QuickMinyan({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [prayer, setPrayer] = useState("shacharit");
  const [time, setTime] = useState("");
  const [room, setRoom] = useState("");
  const [dayType, setDayType] = useState("weekday");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!label.trim() || !time.trim()) return;
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
    const { error } = await supabase.from("minyanim").insert({
      community_id: communityId(),
      label: label.trim(),
      prayer: prayer,
      day_type: dayType,
      time_mode: "fixed",
      fixed_time: fixedTime,
      room: room.trim(),
      sort_order: 100,
      active: true,
      notification_enabled: false,
      reminder_minutes: 15,
    });
    setSaving(false);
    if (error) {
      toast.error("שמירת המניין נכשלה");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["minyanim"] });
    toast.success("המניין נשמר");
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>שם המניין</Label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="למשל: מניין ראשון"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>תפילה</Label>
          <Select value={prayer} onValueChange={setPrayer}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRAYERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>יום</Label>
          <Select value={dayType} onValueChange={setDayType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekday">ימות החול</SelectItem>
              <SelectItem value="friday">יום שישי</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>שעה (HH:MM)</Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="07:00"
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label>חדר/מקום</Label>
          <Input value={room} onChange={(e) => setRoom(e.target.value)} />
        </div>
      </div>
      <Button onClick={save} disabled={saving || !label.trim() || !time.trim()}>
        שמירה
      </Button>
    </div>
  );
}
