import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@community/lib/use-auth";

/**
 * A round "✨" button to the admin's smart assistant, on every page of the
 * site and the phone app - shown only to a signed-in admin, and not on the
 * admin page itself. The assistant checks the role again on its own.
 */
export function AdminAiShortcut() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  if (!isAdmin || pathname.startsWith("/community/admin")) return null;
  return (
    <Link
      to="/community/admin?tab=ai"
      aria-label="עוזר חכם למנהל"
      title="עוזר חכם"
      data-testid="admin-ai-shortcut"
      className="fixed left-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-amber-400 text-[#172c57] shadow-xl ring-2 ring-white/70 transition hover:scale-105"
      style={{ bottom: "calc(1rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" }}
    >
      <Sparkles className="size-6" />
    </Link>
  );
}
