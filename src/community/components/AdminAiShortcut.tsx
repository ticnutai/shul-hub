import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@community/lib/use-auth";
import { useAdminButtons } from "@community/lib/adminButtons";
import { FloatingDraggable } from "./FloatingDraggable";

/**
 * The admin's smart assistant (✨), on every page of the site and the phone
 * app but the admin page itself - shown only to a signed-in admin (the
 * assistant checks the role again on its own). A round button floating in
 * the corner, above "הוספה מהירה" when that floats too, or a small one in
 * the top bar - as he chose in the site's settings (adminButtons).
 */
export function AdminAiShortcut({ placement = "floating" }: { placement?: "floating" | "header" }) {
  const { isAdmin } = useAuth();
  const { prefs, set } = useAdminButtons();
  const { pathname } = useLocation();
  if (!isAdmin || pathname.startsWith("/community/admin")) return null;
  if (!prefs.assistant.on || prefs.assistant.floating !== (placement === "floating")) return null;
  if (placement === "header")
    return (
      <Link
        to="/community/admin?tab=ai"
        aria-label="עוזר חכם למנהל"
        title="עוזר חכם"
        data-testid="admin-ai-header"
        className="inline-flex size-9 items-center justify-center rounded-full border border-amber-400/45 bg-amber-400/10 text-amber-300 transition hover:bg-amber-400/20 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <Sparkles className="size-5" aria-hidden="true" />
      </Link>
    );
  return (
    <FloatingDraggable
      pos={prefs.assistant.pos}
      onMove={(pos) => set("assistant", { pos })}
      home={{ left: "1rem", bottom: "calc(1.25rem + var(--quick-add-space, 0px) + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" }}
    >
      <Link
        to="/community/admin?tab=ai"
        aria-label="עוזר חכם למנהל"
        title="עוזר חכם - אפשר לגרור למקום אחר"
        data-testid="admin-ai-shortcut"
        draggable={false}
        className="inline-flex size-12 items-center justify-center rounded-full bg-amber-400 text-[#172c57] shadow-xl ring-2 ring-white/70 transition hover:scale-105 md:size-14"
      >
        <Sparkles className="size-6" />
      </Link>
    </FloatingDraggable>
  );
}
