import { useLocation } from "react-router-dom";
import { AdminAiShortcut } from "./AdminAiShortcut";
import { QuickAddButton } from "./QuickAddButton";

/**
 * The gabbai's floating buttons - "הוספה מהירה" (+) and the smart assistant
 * (✨) - rendered from this one place, mounted once in the app's frame
 * (GlobalAppShell), so the two appear on the same pages.
 *
 * They were rendered by each page for itself: the + by the home page and by
 * the admin page, the ✨ by the footer of the synagogue's pages - so the + was
 * missing from the shiurim, the ✨ floated where the + did not, and on the
 * admin page the + stood over every section's own add button. Now: on every
 * page of the synagogue, never on the admin page (each of its sections has
 * its own add button, and the top bar keeps the small ones), and not on the
 * siddur and chumash, which are not the gabbai's.
 */
export function AdminFloatingButtons() {
  const { pathname } = useLocation();
  if (!pathname.startsWith("/community") || pathname.startsWith("/community/admin")) return null;
  return (
    <>
      <QuickAddButton placement="floating" />
      <AdminAiShortcut placement="floating" />
    </>
  );
}
