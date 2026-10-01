import { BookHeart, BookMarked, Landmark, ScrollText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

/**
 * Tehillim is a tab of the Siddur (Siddur.tsx, STATIC_TABS) with a door of
 * its own here: the same page, opened on it. `?tab=tehillim` is what tells
 * the Siddur, and what tells this row which of the two is open.
 */
export const TEHILLIM_HREF = "/siddur?tab=tehillim";

const destinations = [
  { id: "community", to: "/community", label: "בית הכנסת", icon: Landmark },
  { id: "siddur", to: "/siddur", label: "סידור", icon: BookMarked },
  { id: "tehillim", to: TEHILLIM_HREF, label: "תהילים", icon: BookHeart },
  { id: "chumash", to: "/chumash", label: "חומש ומפרשים", icon: ScrollText },
] as const;

type DestinationId = (typeof destinations)[number]["id"];

function activeDestination(pathname: string, search: string): DestinationId | null {
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/chumash")) return "chumash";
  if (pathname.startsWith("/siddur")) return new URLSearchParams(search).get("tab") === "tehillim" ? "tehillim" : "siddur";
  return null;
}

/**
 * The permanent application destinations. Keep this as the single source of
 * truth so Community, Siddur, Tehillim and Chumash cannot drift apart.
 */
export function PrimaryDestinationNav({ className }: { className?: string }) {
  const { pathname, search } = useLocation();
  const active = activeDestination(pathname, search);

  return (
    <nav
      dir="rtl"
      className={cn("primary-destination-nav", className)}
      aria-label="מדורים ראשיים"
    >
      {destinations.map(({ id, to, label, icon: Icon }) => (
        <Link
          key={id}
          to={to}
          data-destination={id}
          aria-current={active === id ? "page" : undefined}
          className={cn("primary-destination-item", active === id && "primary-destination-item-active")}
        >
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
