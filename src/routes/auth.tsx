import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Eye, EyeOff, KeyRound, Mail, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getRememberAuth, setRememberAuth } from "@/lib/auth-storage";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "כניסה לאתר — בית הכנסת אושר של יהודי" },
      {
        name: "description",
        content: "כניסה או הרשמה לחשבון מתפלל באתר בית הכנסת אושר של יהודי.",
      },
      { property: "og:title", content: "כניסה לאתר — בית הכנסת אושר של יהודי" },
      { property: "og:description", content: "כניסה או הרשמה לחשבון מתפלל." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(getRememberAuth);
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    const recoveryRequested = new URLSearchParams(window.location.search).get("recovery") === "1";
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !recoveryRequested) navigate({ to: "/", replace: true });
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    if (recoveryRequested) setMode("reset");

    return () => subscription.subscription.unsubscribe();
  }, [navigate]);

  async function goHome() {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (uid) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      if (roleRow) {
        navigate({ to: "/admin", replace: true });
        return;
      }
    }
    navigate({ to: "/", replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      setRememberAuth(remember);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error("פרטי הכניסה שגויים");
        return;
      }
      await supabase.rpc("claim_admin");
      await goHome();
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
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
      await goHome();
    }
  }

  async function sendPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("יש להזין כתובת אימייל");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?recovery=1`,
    });
    setBusy(false);
    if (error) {
      toast.error("לא הצלחנו לשלוח קישור לאיפוס הסיסמה");
      return;
    }
    setResetEmailSent(true);
  }

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("הסיסמאות אינן תואמות");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("לא הצלחנו לעדכן את הסיסמה");
      return;
    }
    toast.success("הסיסמה עודכנה בהצלחה");
    await goHome();
  }

  const title =
    mode === "signin"
      ? "כניסה לחשבון"
      : mode === "signup"
        ? "הרשמה למתפללים"
        : mode === "forgot"
          ? "איפוס סיסמה"
          : "בחירת סיסמה חדשה";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-center text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === "signin"
            ? "כניסה עם החשבון האישי שלך."
            : mode === "signup"
              ? "ההרשמה פותחת חשבון מתפלל רגיל. הרשאות ניהול ניתנות על ידי הגבאי בלבד."
              : mode === "forgot"
                ? "נשלח אליך קישור מאובטח לבחירת סיסמה חדשה."
                : "יש לבחור סיסמה חדשה לחשבון שלך."}
        </p>

        {pendingConfirm ? (
          <div className="card-elev mt-6 p-6 text-center">
            <p className="font-medium">שלחנו אליך מייל אימות</p>
            <p className="mt-2 text-sm text-muted-foreground">
              יש ללחוץ על הקישור במייל כדי להשלים את ההרשמה, ואז לחזור ולהתחבר.
            </p>
          </div>
        ) : mode === "forgot" ? (
          <form onSubmit={sendPasswordReset} className="card-elev mt-6 space-y-4 p-6">
            {resetEmailSent ? (
              <div className="space-y-3 text-center" role="status">
                <Mail className="mx-auto size-10 text-primary" />
                <p className="font-medium">קישור לאיפוס הסיסמה נשלח</p>
                <p className="text-sm text-muted-foreground">
                  יש לפתוח את המייל וללחוץ על הקישור. מומלץ לבדוק גם בתיקיית הספאם.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">אימייל</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={busy}>
                  <Mail className="size-4" />
                  {busy ? "שולח…" : "שליחת קישור לאיפוס"}
                </Button>
              </>
            )}
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setMode("signin");
                setResetEmailSent(false);
              }}
            >
              <RotateCcw className="size-4" />
              חזרה לכניסה
            </button>
          </form>
        ) : mode === "reset" ? (
          <form onSubmit={saveNewPassword} className="card-elev mt-6 space-y-4 p-6">
            <PasswordField
              id="new-password"
              label="סיסמה חדשה"
              value={password}
              show={showPassword}
              onShowChange={setShowPassword}
              onChange={setPassword}
            />
            <PasswordField
              id="confirm-password"
              label="אימות סיסמה חדשה"
              value={confirmPassword}
              show={showPassword}
              onShowChange={setShowPassword}
              onChange={setConfirmPassword}
            />
            <Button type="submit" className="w-full gap-2" disabled={busy}>
              <KeyRound className="size-4" />
              {busy ? "שומר…" : "שמירת הסיסמה החדשה"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submit} className="card-elev mt-6 space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <PasswordField
              id="password"
              label="סיסמה"
              value={password}
              show={showPassword}
              onShowChange={setShowPassword}
              onChange={setPassword}
            />
            {mode === "signin" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={remember}
                  className="flex items-center gap-2 text-sm text-foreground"
                  onClick={() => setRemember((value) => !value)}
                >
                  <span
                    className={`grid size-5 place-items-center rounded border transition-colors ${
                      remember
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background"
                    }`}
                    aria-hidden="true"
                  >
                    {remember && <Check className="size-3.5" />}
                  </span>
                  זכור אותי
                </button>
                <button
                  type="button"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode("forgot")}
                >
                  שכחתי סיסמה
                </button>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "רגע…" : mode === "signin" ? "כניסה" : "הרשמה"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "אין עדיין חשבון? הרשמה" : "כבר יש חשבון? כניסה"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  show,
  onShowChange,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onShowChange: (show: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          dir="ltr"
          autoComplete={id === "password" ? "current-password" : "new-password"}
          className="pe-11"
          required
          minLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="absolute inset-y-0 end-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
          aria-pressed={show}
          onClick={() => onShowChange(!show)}
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    </div>
  );
}
