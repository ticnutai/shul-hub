import { BookMarked, Landmark, ScrollText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

const destinations = [
  { to: "/community", label: "בית הכנסת", icon: Landmark },
  { to: "/siddur", label: "סידור", icon: BookMarked },
  { to: "/chumash", label: "חומש ומפרשים", icon: ScrollText },
] as const;

const isDestinationActive = (pathname: string, to: string) =>
  to === "/community" ? pathname.startsWith("/community") : pathname.startsWith(to);

/**
 * The three permanent application destinations. Keep this as the single
 * source of truth so Community, Siddur and Chumash cannot drift apart.
 */
export function PrimaryDestinationNav({ className }: { className?: string }) {
  const { pathname } = useLocation();

  return (
    <nav
      dir="rtl"
      className={cn("primary-destination-nav", className)}
      aria-label="מדורים ראשיים"
    >
      {destinations.map(({ to, label, icon: Icon }) => {
        const active = isDestinationActive(pathname, to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn("primary-destination-item", active && "primary-destination-item-active")}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
