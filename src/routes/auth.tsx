import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "כניסת גבאי — בית הכנסת אושר של יהודי" },
      {
        name: "description",
        content: "אזור כניסה לגבאי בית הכנסת לניהול זמני התפילות, המודעות והשיעורים.",
      },
      { property: "og:title", content: "כניסת גבאי — בית הכנסת אושר של יהודי" },
      { property: "og:description", content: "כניסה לפאנל הניהול של בית הכנסת." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error("פרטי הכניסה שגויים");
        return;
      }
      await supabase.rpc("claim_admin");
      navigate({ to: "/admin", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        setPendingConfirm(true);
        return;
      }
      await supabase.rpc("claim_admin");
      navigate({ to: "/admin", replace: true });
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-center text-2xl font-bold">כניסת גבאי</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          אזור ניהול זמני התפילות והתכנים.
        </p>

        {pendingConfirm ? (
          <div className="card-elev mt-6 p-6 text-center">
            <p className="font-medium">שלחנו אליך מייל אימות</p>
            <p className="mt-2 text-sm text-muted-foreground">
              יש ללחוץ על הקישור במייל כדי להשלים את ההרשמה, ואז לחזור ולהתחבר.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="card-elev mt-6 space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "רגע…" : mode === "signin" ? "כניסה" : "יצירת חשבון גבאי"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin"
                ? "אין עדיין חשבון? יצירת חשבון גבאי"
                : "כבר יש חשבון? כניסה"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
