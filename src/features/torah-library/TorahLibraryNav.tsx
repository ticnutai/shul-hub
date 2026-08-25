import { Link } from "@tanstack/react-router";
import { BookOpenText, BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";

export function TorahLibraryNav({ active }: { active: "chumash" | "siddur" }) {
  const items = [
    { id: "chumash", to: "/torah-chumash", label: "חומש", icon: BookOpenText },
    { id: "siddur", to: "/torah-siddur", label: "סידור", icon: BookMarked },
  ] as const;

  return (
    <nav aria-label="ספרייה תורנית" className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            to={item.to}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-2 font-semibold transition-colors",
              active === item.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/50",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
