import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, Eye, EyeOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@community/integrations/supabase/client";
import { useHomeWidgets, type HomeWidget } from "@community/lib/data";

function reorder(list: HomeWidget[], from: number, to: number) {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (!moved) return list;
  next.splice(to, 0, moved);
  return next;
}

function WidgetList({
  title,
  hint,
  items,
  onChange,
}: {
  title: string;
  hint: string;
  items: HomeWidget[];
  onChange: (items: HomeWidget[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  function beginPointerDrag(index: number, pointerId: number) {
    dragIndexRef.current = index;
    setDragIndex(index);

    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-widget-index]");
      const nextIndex = Number(target?.dataset.widgetIndex);
      const currentIndex = dragIndexRef.current;
      if (!Number.isInteger(nextIndex) || currentIndex === null || nextIndex === currentIndex)
        return;
      onChange(reorder(itemsRef.current, currentIndex, nextIndex));
      dragIndexRef.current = nextIndex;
      setDragIndex(nextIndex);
    };

    const end = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      dragIndexRef.current = null;
      setDragIndex(null);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  }

  return (
    <div className="card-elev p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <ul className="mt-4 space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            data-widget-index={index}
            className={
              "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-opacity " +
              (dragIndex === index ? "opacity-60" : "")
            }
          >
            <button
              type="button"
              className="touch-none cursor-grab rounded-md p-2 text-muted-foreground hover:bg-muted active:cursor-grabbing"
              onPointerDown={(event) => {
                event.preventDefault();
                beginPointerDrag(index, event.pointerId);
              }}
              aria-label={`גרירת ${item.label}`}
            >
              <GripVertical className="size-5" />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
            {item.visible ? (
              <Eye className="size-4 text-muted-foreground" />
            ) : (
              <EyeOff className="size-4 text-muted-foreground" />
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

  useEffect(() => {
    if (!data) return;
    setSections(data.filter((w) => w.kind === "section"));
    setZmanim(data.filter((w) => w.kind === "zman"));
  }, [data]);

  async function save() {
    setSaving(true);
    const rows = [...sections, ...zmanim].map((widget, index) => ({
      id: widget.id,
      key: widget.key,
      label: widget.label,
      kind: widget.kind,
      visible: widget.visible,
      sort_order: (index + 1) * 10,
    }));
    const { error } = await supabase.from("home_widgets").upsert(rows, { onConflict: "id" });
    setSaving(false);
    if (error) {
      toast.error(error.message || "השמירה נכשלה");
      return;
    }
    qc.invalidateQueries({ queryKey: ["home_widgets"] });
    toast.success("סדר הווידג'טים נשמר לכל המשתמשים");
  }

  if (isLoading) return <p className="text-muted-foreground">טוען…</p>;

  return (
    <div className="space-y-4">
      <WidgetList
        title="מקטעי דף הבית"
        hint="גררו מהידית כדי לשנות סדר, וכבו כדי להסתיר מכל המתפללים."
        items={sections}
        onChange={setSections}
      />
      <WidgetList
        title="זמני היום"
        hint="בחרו אילו זמנים הלכתיים יוצגו ובאיזה סדר."
        items={zmanim}
        onChange={setZmanim}
      />
      <Button onClick={save} disabled={saving}>
        <Smartphone className="size-4" /> שמירת תצוגת דף הבית
      </Button>
    </div>
  );
}
