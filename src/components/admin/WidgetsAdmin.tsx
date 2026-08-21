import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useHomeWidgets, type HomeWidget } from "@/lib/data";

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

  return (
    <div className="card-elev p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <ul className="mt-4 space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex === null || dragIndex === index) return;
              onChange(reorder(items, dragIndex, index));
              setDragIndex(index);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={
              "flex cursor-grab items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-opacity " +
              (dragIndex === index ? "opacity-60" : "")
            }
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground" />
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
  const { data = [], isLoading } = useHomeWidgets();
  const qc = useQueryClient();
  const [sections, setSections] = useState<HomeWidget[]>([]);
  const [zmanim, setZmanim] = useState<HomeWidget[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
        hint="גררו כדי לשנות סדר, וכבו כדי להסתיר מכל המתפללים."
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
        שמירת התצוגה
      </Button>
    </div>
  );
}
