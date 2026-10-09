import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { handleAppAuthLink, isNativeApp } from "@/lib/appGoogleSignIn";

/**
 * In the Android app: the link that brings Google sign-in back from the
 * phone's browser (see src/lib/appGoogleSignIn.ts) - whether the app was
 * still open or is started by it.
 */
export function AppAuthLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp()) return;
    const handle = async (url?: string) => {
      if (!url) return;
      const result = await handleAppAuthLink(url);
      if (!result) return;
      if (result.ok) {
        toast.success("התחברת בהצלחה!");
        navigate("/community");
      } else {
        toast.error("error" in result ? result.error : "ההתחברות עם גוגל לא הצליחה");
      }
    };
    void CapacitorApp.getLaunchUrl().then((launch) => handle(launch?.url));
    const sub = CapacitorApp.addListener("appUrlOpen", ({ url }) => void handle(url));
    return () => {
      void sub.then((s) => s.remove());
    };
  }, [navigate]);
  return null;
}
