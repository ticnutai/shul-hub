import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MigrationCredentialsDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("ticnutai@gmail.com");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!import.meta.env.DEV) return null;

  async function save() {
    if (!email.trim() || !password) {
      toast.error("יש להזין אימייל וסיסמה");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/__dev/migration-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) throw new Error("save failed");
      setPassword("");
      setOpen(false);
      toast.success("פרטי מנהל המיגרציות נשמרו מקומית");
    } catch {
      toast.error("שמירת פרטי ההתחברות נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="הגדרות מיגרציות למפתחים"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold"
        >
          <KeyRound className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="w-[calc(100vw-1rem)] max-w-md rounded-2xl text-right">
        <DialogHeader className="text-right">
          <DialogTitle>הגדרות מיגרציות למפתחים</DialogTitle>
          <DialogDescription>
            הפרטים נשמרים רק במחשב הזה בקובץ מוחרג מ־Git. הסיסמה אינה מוצגת מחדש.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="migration-admin-email">אימייל מנהל</Label>
            <Input
              id="migration-admin-email"
              dir="ltr"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="migration-admin-password">סיסמה</Label>
            <Input
              id="migration-admin-password"
              dir="ltr"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            <KeyRound className="size-4" /> {saving ? "שומר…" : "שמירה מקומית"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
