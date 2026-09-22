/**
 * Which synagogue this admin is editing - said out loud, and changed here.
 *
 * Every edit on the page below lands in whichever synagogue this names, and
 * an edit that lands in the wrong one is not an error anybody sees: it
 * appears, correctly formatted and quite wrong, on somebody else's wall. So
 * this is not a setting tucked into a menu. It is the name of the synagogue,
 * at the top of the page, always visible, and clicking it changes it.
 *
 * A gabbai of one synagogue never sees it. There is nothing to choose, and a
 * control that always says the same thing is a control that gets clicked by
 * accident.
 *
 * Three things it does that a plain <select> would not:
 *
 *   It says which are switched off. A synagogue being prepared is not shown
 *   to the public, and forgetting that is how a shul ends up with a board
 *   nobody can find - or, worse, a half-finished one that everybody can.
 *
 *   It writes the choice into the address bar, so a reload, a bookmark or a
 *   link to the other gabbai all mean the same synagogue.
 *
 *   It empties the cache rather than filtering it. One synagogue's minyanim,
 *   shown for half a second under another's name, is exactly the confusion
 *   this whole design exists to prevent.
 */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, EyeOff, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type Community,
  listMyCommunities,
  setCommunity,
  updateCurrentCommunity,
  useCommunity,
  useCommunityId,
  writeCommunityToUrl,
} from "@/community/lib/community";

/** Above this many, reading the list is slower than typing into it. */
const SEARCH_FROM = 7;

export function CommunitySwitcher() {
  const queryClient = useQueryClient();
  const currentId = useCommunityId();
  const [mine, setMine] = useState<Community[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    void listMyCommunities()
      .then((list) => {
        if (!alive) return;
        setMine(list);

        // An admin who was last editing a synagogue that is not open to the
        // public would otherwise be moved off it without being told: the
        // visitor-side resolve only knows about live ones. If the one being
        // remembered is one of theirs, keep them on it.
        const wanted =
          new URLSearchParams(window.location.search).get("shul") ??
          readRemembered();
        const keep = list.find((c) => c.slug === wanted);
        if (keep && keep.id !== currentId) {
          setCommunity(keep);
          queryClient.clear();
          return;
        }
        // Not a switch - the same synagogue, now with the one fact the
        // visitor-side list never carries.
        const here = list.find((c) => c.id === currentId);
        if (here) updateCurrentCommunity({ active: here.active, name: here.name });
      })
      .catch(() => {
        /* no list: the name still shows, there is just nothing to switch to */
      });
    return () => {
      alive = false;
    };
    // Once, on mount: this restores a choice, it does not follow one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = mine.find((c) => c.id === currentId) ?? null;

  const shown = useMemo(() => {
    const q = filter.trim();
    if (!q) return mine;
    return mine.filter((c) => c.name.includes(q) || c.slug.includes(q.toLowerCase()));
  }, [mine, filter]);

  if (mine.length < 2) return null;

  const choose = (c: Community) => {
    setOpen(false);
    setFilter("");
    if (c.id === currentId) return;
    setCommunity(c);
    writeCommunityToUrl(c.slug);
    queryClient.clear();
    toast.success(`עכשיו עורכים את ${c.name}`, {
      description: c.active === false ? "בית הכנסת כבוי - השינויים לא יופיעו באתר הציבורי" : undefined,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 max-w-[18rem] justify-between gap-2 px-3"
          aria-label="בית הכנסת שבעריכה"
          data-testid="community-switcher"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-semibold">{current?.name ?? "בחירת בית כנסת"}</span>
            {current?.active === false && <OffBadge />}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" dir="rtl" className="w-80 p-1.5 text-right">
        <p className="px-2 pb-1.5 pt-1 text-[11px] text-muted-foreground">
          כל מה שנערוך בדף הזה שייך לבית הכנסת שנבחר כאן.
        </p>

        {mine.length >= SEARCH_FROM && (
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="חיפוש"
              className="h-8 pr-7 text-sm"
            />
          </div>
        )}

        <div className="max-h-72 overflow-y-auto">
          {shown.map((c) => {
            const active = c.id === currentId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm transition hover:bg-accent ${
                  active ? "bg-accent/60 font-semibold" : ""
                }`}
              >
                <Check className={`size-4 shrink-0 ${active ? "opacity-100" : "opacity-0"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{c.slug}</span>
                </span>
                {c.active === false && <OffBadge />}
              </button>
            );
          })}
          {shown.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">אין בית כנסת בשם הזה.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OffBadge() {
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
      title="לא מוצג באתר הציבורי"
    >
      <EyeOff className="size-3" /> כבוי
    </span>
  );
}

function readRemembered(): string | null {
  try {
    return localStorage.getItem("shul-hub.community");
  } catch {
    return null;
  }
}

/**
 * The synagogue being edited, under the page title, plus the one warning
 * that has to travel with it.
 *
 * A synagogue that is switched off can be edited exactly like any other, and
 * nothing that happens on the page will show up on the public site. That is
 * correct - it is how a synagogue gets prepared - and it is also the kind of
 * thing somebody discovers an hour later. So it is said here, once, in the
 * place they are already looking.
 */
export function ShulNow() {
  const shul = useCommunity();
  if (!shul) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-foreground">{shul.name}</span>
      {shul.active === false && (
        <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <EyeOff className="size-3" /> כבוי - מה שנערוך כאן עדיין לא מוצג באתר הציבורי
        </span>
      )}
    </p>
  );
}
