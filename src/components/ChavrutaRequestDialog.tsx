import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserRoundPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  topic: "",
  level: "beginner",
  intent: "learn",
  study_format: "chavruta",
  availability: "",
  notes: "",
  share_contact: false,
};

export function ChavrutaRequestDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: async (values: TablesInsert<"chavruta_requests">) => {
      const { error: insertError } = await supabase.from("chavruta_requests").insert(values);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("הבקשה נשלחה ותפורסם לאחר אישור המנהל");
      setForm(initialForm);
      setError("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin_chavruta_requests"] });
    },
    onError: () => toast.error("שליחת הבקשה נכשלה. נסו שוב מאוחר יותר."),
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.topic.trim()) {
      setError("שם ונושא לימוד הם שדות חובה.");
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError("יש להזין לפחות טלפון או אימייל.");
      return;
    }
    setError("");
    submit.mutate({
      ...form,
      name: form.name.trim(),
      topic: form.topic.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      status: "pending",
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserRoundPlus className="size-4" /> בקשת חברותא
        </Button>
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-2xl text-right"
      >
        <DialogHeader className="text-right">
          <DialogTitle>בקשה למציאת חברותא</DialogTitle>
          <DialogDescription>מלאו את הפרטים. הבקשה תפורסם לאחר אישור מנהל.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
          <Field label="שם *">
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field label="נושא לימוד *">
            <Input value={form.topic} onChange={(e) => update("topic", e.target.value)} />
          </Field>
          <Field label="טלפון">
            <Input
              dir="ltr"
              className="text-right"
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              autoComplete="tel"
            />
          </Field>
          <Field label="אימייל">
            <Input
              dir="ltr"
              className="text-right"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="email"
            />
          </Field>
          <SelectField
            label="רמה"
            value={form.level}
            onChange={(value) => update("level", value)}
            items={[
              ["beginner", "מתחיל"],
              ["intermediate", "בינוני"],
              ["advanced", "מתקדם"],
            ]}
          />
          <SelectField
            label="מה מחפשים"
            value={form.intent}
            onChange={(value) => update("intent", value)}
            items={[
              ["learn", "ללמוד"],
              ["teach", "ללמד"],
              ["both", "ללמד וללמוד"],
            ]}
          />
          <SelectField
            label="מסגרת"
            value={form.study_format}
            onChange={(value) => update("study_format", value)}
            items={[
              ["chavruta", "חברותא אישית"],
              ["group", "קבוצה"],
            ]}
          />
          <Field label="זמנים אפשריים">
            <Input
              value={form.availability}
              onChange={(e) => update("availability", e.target.value)}
              placeholder="לדוגמה: א׳–ה׳ בערב"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="הערות">
              <Textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border p-3 sm:col-span-2">
            <div>
              <Label htmlFor="share-contact">אישור לפרסום פרטי קשר</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                אם האפשרות כבויה, הטלפון והאימייל יוצגו למנהל בלבד.
              </p>
            </div>
            <Switch
              id="share-contact"
              checked={form.share_contact}
              onCheckedChange={(checked) => update("share_contact", checked)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submit.isPending} className="sm:col-span-2">
            {submit.isPending ? "שולח…" : "שליחת הבקשה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: string[][];
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir="rtl">
          {items.map(([id, text]) => (
            <SelectItem key={id} value={id}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
