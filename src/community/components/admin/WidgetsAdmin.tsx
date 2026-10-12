import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Columns2, Eye, EyeOff, PanelTop } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@community/integrations/supabase/client";
import { useHomeWidgets, type HomeWidget } from "@community/lib/data";
import { communityId } from "@/community/lib/community";
import { hebrewError } from "@community/lib/hebrewError";
import { SettingsSaveBar } from "@community/components/admin/HomeHeroSettings";
import { useUnsavedChangesGuard } from "@community/lib/unsavedChanges";
import { DragGrip, useReorder } from "@community/lib/useReorder";
import { SectionLink, useFocusTarget } from "./adminUi";

function WidgetList({
  title,
  hint,
  items,
  onChange,
  footer,
}: {
  title: string;
  hint: string;
  items: HomeWidget[];
  onChange: (items: HomeWidget[]) => void;
  footer?: ReactNode;
}) {
  // Dragged like every list (useReorder.ts), but kept with the other changes until "שמירה".
  const { ordered, draggedId, rowProps, gripProps } = useReorder(items, { onReorder: onChange });

  return (
    <div className="card-elev p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      {footer}
      <ul className="mt-4 space-y-2">
        {ordered.map((item) => (
          <li
            key={item.id}
            {...rowProps(item.id)}
            data-widget-key={item.key}
            className={
              "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-opacity " +
              (draggedId === item.id ? "opacity-60" : "")
            }
          >
            <DragGrip label={`גרירת ${item.label}`} {...gripProps(item.id)} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
            {item.kind === "section" && (
              <Select
                value={item.layout_width === "half" ? "half" : "full"}
                onValueChange={(layoutWidth) =>
                  onChange(
                    items.map((widget) =>
                      widget.id === item.id ? { ...widget, layout_width: layoutWidth } : widget,
                    ),
                  )
                }
              >
                <SelectTrigger
                  className="order-last h-9 w-full sm:order-none sm:w-[8.75rem]"
                  aria-label={`רוחב ${item.label} בדף הבית`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">
                    <span className="flex items-center gap-2"><PanelTop className="size-4" /> רוחב מלא</span>
                  </SelectItem>
                  <SelectItem value="half">
                    <span className="flex items-center gap-2"><Columns2 className="size-4" /> חצי שורה</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            {/* Only a picture of what the switch beside it says. */}
            {item.visible ? (
              <Eye className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <EyeOff className="size-4 text-muted-foreground" aria-hidden />
            )}
            <Switch
              checked={item.visible}
              onCheckedChange={(checked) =>
                onChange(items.map((w) => (w.id === item.id ? { ...w, visible: checked } : w)))
              }
              aria-label={`הצגת ${item.label}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WidgetsAdmin() {
  const { data, isLoading } = useHomeWidgets();
  const qc = useQueryClient();
  const [sections, setSections] = useState<HomeWidget[]>([]);
  const [zmanim, setZmanim] = useState<HomeWidget[]>([]);
  const [saving, setSaving] = useState(false);
  // Opened from the announcement form's "מקטעי דף הבית": brought into view.
  const focusRef = useFocusTarget<HTMLDivElement>("sections", !isLoading);

  const resetFromSaved = () => {
    if (!data) return;
    setSections(data.filter((w) => w.kind === "section"));
    setZmanim(data.filter((w) => w.kind === "zman"));
  };
  useEffect(resetFromSaved, [data]);

  // The list drags and switches like the lists that save at once, but this
  // one waits for "שמירה" (it is a whole layout, saved together) - so it
  // says when something is not saved yet, and leaving asks first.
  const snapshot = (list: HomeWidget[]) =>
    JSON.stringify(list.map((w) => [w.id, w.visible, w.layout_width === "half" ? "half" : "full"]));
  const changed =
    Boolean(data) &&
    snapshot([...sections, ...zmanim]) !==
      snapshot([...(data ?? []).filter((w) => w.kind === "section"), ...(data ?? []).filter((w) => w.kind === "zman")]);
  useUnsavedChangesGuard(changed);

  async function save() {
    setSaving(true);
    const rows = [...sections, ...zmanim].map((widget, index) => ({
      id: widget.id,
      key: widget.key,
      label: widget.label,
      kind: widget.kind,
      visible: widget.visible,
      layout_width: widget.layout_width === "half" ? "half" : "full",
      sort_order: (index + 1) * 10,
    }));
    const { error } = await supabase.from("home_widgets")
      .upsert(
        rows.map((r) => ({ ...r, community_id: communityId() })),
        { onConflict: "id" },
      );
    setSaving(false);
    if (error) {
      toast.error(hebrewError(error, "השמירה נכשלה"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["home_widgets"] });
    toast.success("נשמר");
  }

  if (isLoading) return <p className="text-muted-foreground">טוען…</p>;

  return (
    <div ref={focusRef} className="scroll-mt-24 space-y-4" data-testid="home-sections">
      <WidgetList
        title="מקטעי דף הבית"
        hint="גררו לשינוי סדר, בחרו רוחב מלא או חצי שורה, וכבו כדי להסתיר מכל המתפללים."
        items={sections}
        onChange={setSections}
        footer={
          <SectionLink
            hint="אילו מודעות מופיעות בדף הבית, ובאיזה רוחב - נקבע בכל מודעה."
            label="מודעות"
            tab="announcements"
            testId="go-announcements"
          />
        }
      />
      <WidgetList
        title="זמני היום"
        hint="בחרו אילו זמנים הלכתיים יוצגו ובאיזה סדר."
        items={zmanim}
        onChange={setZmanim}
      />
      <div className="card-elev p-4" data-testid="widgets-save">
        <SettingsSaveBar changed={changed} pending={saving} onSubmit={() => void save()} onReset={resetFromSaved} />
      </div>
    </div>
  );
}
