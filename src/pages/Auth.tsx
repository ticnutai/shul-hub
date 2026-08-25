/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Book, Eye, EyeOff } from "lucide-react";

const REMEMBER_ME_KEY = "torah_remember_me";
const AUTO_LOGIN_KEY = "torah_auto_login";

export const getRememberedCredentials = () => {
  try {
    const stored = localStorage.getItem(REMEMBER_ME_KEY);
    if (stored) return JSON.parse(stored) as { email: string; password: string };
  } catch { /* ignore invalid stored credentials */ }
  return null;
};

export const getAutoLoginEnabled = () => {
  return localStorage.getItem(AUTO_LOGIN_KEY) === "true";
};

export const setAutoLoginEnabled = (enabled: boolean) => {
  localStorage.setItem(AUTO_LOGIN_KEY, enabled ? "true" : "false");
};

export const clearRememberedCredentials = () => {
  localStorage.removeItem(REMEMBER_ME_KEY);
  localStorage.removeItem(AUTO_LOGIN_KEY);
};

export const Auth = () => {
  const remembered = getRememberedCredentials();
  const [email, setEmail] = useState(remembered?.email || "");
  const [password, setPassword] = useState(remembered?.password || "");
  const [displayName, setDisplayName] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(!!remembered);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [attemptedAutoLogin, setAttemptedAutoLogin] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("שגיאה בהתחברות עם גוגל");
        setIsLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate("/community");
    } catch (e: any) {
      toast.error(e?.message || "שגיאה בהתחברות עם גוגל");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !session.user.is_anonymous) {
        navigate("/community");
        return;
      }

      // Auto-login if enabled and credentials are remembered
      if (!attemptedAutoLogin && getAutoLoginEnabled() && remembered) {
        setAttemptedAutoLogin(true);
        setIsLoading(true);
        supabase.auth.signInWithPassword({
          email: remembered.email,
          password: remembered.password,
        }).then(({ error }) => {
          if (!error) {
            navigate("/community");
          } else {
            setIsLoading(false);
            // Credentials invalid, clear them
            clearRememberedCredentials();
            setRememberMe(false);
          }
        });
      }
    });
  }, [navigate, attemptedAutoLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Save or clear remembered credentials
        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem(REMEMBER_ME_KEY);
          localStorage.removeItem(AUTO_LOGIN_KEY);
        }

        toast.success("התחברת בהצלחה!");
        navigate("/community");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;
        toast.success("נרשמת בהצלחה! מעבירים אותך...");
        navigate("/community");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message?.includes("Invalid login credentials")) {
        toast.error("אימייל או סיסמה שגויים");
      } else if (error.message?.includes("User already registered")) {
        toast.error("המשתמש כבר רשום במערכת");
      } else {
        toast.error(error.message || "שגיאה באימות");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error("יש להזין אימייל כדי לקבל קישור לאיפוס סיסמה");
      return;
    }

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("קישור לאיפוס הסיסמה נשלח לאימייל");
    } catch (error: any) {
      toast.error(error?.message || "לא ניתן לשלוח כרגע קישור לאיפוס סיסמה");
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Show loading while auto-login is in progress
  if (isLoading && attemptedAutoLogin && !email) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-amber-500 shadow-lg shadow-amber-100">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Book className="h-12 w-12 text-amber-500" />
          </div>
          <CardTitle className="text-2xl text-[#1b2a4a]">
            {isLogin ? "כניסה למערכת" : "הרשמה"}
          </CardTitle>
          <CardDescription className="text-[#1b2a4a]/70">
            {isLogin
              ? "לכל משתמש נשמרים נתונים נפרדים. התחבר כדי לעבוד על המרחב האישי שלך."
              : "צור חשבון חדש כדי להתחיל"}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-[#1b2a4a] font-semibold">שם תצוגה</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="השם שיוצג באפליקציה"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="text-right border-amber-300 focus:border-amber-500 focus:ring-amber-500 text-[#1b2a4a]"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#1b2a4a] font-semibold">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-right border-amber-300 focus:border-amber-500 focus:ring-amber-500 text-[#1b2a4a]"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#1b2a4a] font-semibold">סיסמה</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="text-right pl-10 border-amber-300 focus:border-amber-500 focus:ring-amber-500 text-[#1b2a4a]"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 p-3 text-amber-400 hover:text-[#1b2a4a] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-[#1b2a4a]/60 text-right">
                  לפחות 6 תווים
                </p>
              )}
            </div>

            {isLogin && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isLoading || isResettingPassword}
                  className="text-sm text-[#1b2a4a] hover:underline disabled:opacity-50"
                >
                  {isResettingPassword ? "שולח קישור..." : "שכחתי סיסמה"}
                </button>
                <div className="flex items-center gap-2 justify-end">
                  <Label htmlFor="remember-me" className="text-sm cursor-pointer text-[#1b2a4a]">
                    זכור אותי
                  </Label>
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    className="border-amber-400 data-[state=checked]:bg-[#1b2a4a] data-[state=checked]:border-[#1b2a4a]"
                  />
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full bg-[#1b2a4a] hover:bg-[#152240] text-white font-bold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {isLogin ? "מתחבר..." : "נרשם..."}
                </>
              ) : isLogin ? (
                "התחבר"
              ) : (
                "הרשם"
              )}
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-amber-300" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-[#1b2a4a]/60">או</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full border-amber-400 text-[#1b2a4a] hover:bg-amber-50 font-semibold gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1A6.97 6.97 0 0 1 5.47 12c0-.73.13-1.44.36-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              <span>התחברות עם גוגל</span>
            </Button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setDisplayName("");
                }}
                className="text-[#1b2a4a] hover:underline font-medium"
                disabled={isLoading}
              >
                {isLogin
                  ? "אין חשבון? יצירת משתמש חדש"
                  : "כבר יש לך חשבון? התחבר כאן"}
              </button>
            </div>

            <div className="text-center">
              <Link to="/" className="text-sm text-[#1b2a4a]/60 hover:underline">
                חזרה לדף הבית
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
