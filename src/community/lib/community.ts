/**
 * Which synagogue this session is looking at.
 *
 * One question, asked in one place, because the alternative is every query
 * deciding for itself and one of them eventually deciding wrong. A row
 * written to the wrong synagogue is not an error anybody sees: it simply
 * appears on somebody else's wall.
 *
 * Three kinds of visitor answer it differently, and none of them is asked
 * to type anything:
 *
 *   A screen   knows from the moment it was paired - the admin who typed
 *              its code decided, and the server remembers. See tv/device.
 *   An admin   from the account they signed in with. One synagogue and
 *              there is nothing to choose; several and they pick, once.
 *   A visitor  from the link they followed (?shul=...), or the choice they
 *              made last time, or - while there is only one - that one.
 *
 * It is resolved once at boot and held here, so the query functions, which
 * are plain async functions rather than hooks, can ask for it without
 * every one of them being rewritten to take it as an argument.
 *
 * `communityId()` throws when nothing has been resolved. That is on
 * purpose: a query that runs before the synagogue is known would silently
 * read the wrong one, and a crash during development is how that gets
 * found. Nothing renders before the provider has resolved.
 */
import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";

export interface Community {
  id: string;
  slug: string;
  name: string;
  /**
   * Shown to the public. Undefined when it was not asked for - the visitor
   * side only ever sees live ones, so it has no use for the answer.
   */
  active?: boolean;
}

const STORAGE_KEY = "shul-hub.community";

let current: Community | null = null;
const listeners = new Set<() => void>();

/** The synagogue in hand, for the queries. Throws rather than guessing. */
export function communityId(): string {
  if (!current) {
    throw new Error(
      "לא ידוע לאיזה בית כנסת השאילתה שייכת - נקראה לפני שנבחר בית כנסת",
    );
  }
  return current.id;
}

/** The same, for code that can sensibly do nothing yet. */
export function currentCommunity(): Community | null {
  return current;
}

export function setCommunity(next: Community | null, remember = true): void {
  if (next?.id === current?.id) return;
  current = next;
  if (remember) {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next.slug);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
  }
  for (const l of listeners) l();
}

/**
 * Fills in something we have since learned about the synagogue in hand.
 *
 * The visitor-side list does not carry `active` - a visitor only ever sees
 * live ones, so the answer would always be the same. The admin side does
 * need it, and learns it a moment later than it learns the name. This is
 * that moment, and it is not a change of synagogue: switching is
 * setCommunity, and nothing here may quietly become a different shul.
 */
export function updateCurrentCommunity(patch: Partial<Omit<Community, "id">>): void {
  if (!current) return;
  const next = { ...current, ...patch };
  if (next.slug === current.slug && next.name === current.name && next.active === current.active) return;
  current = next;
  for (const l of listeners) l();
}

export function subscribeCommunity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For useSyncExternalStore, which needs a stable snapshot. */
export function communitySnapshot(): Community | null {
  return current;
}

export async function listCommunities(): Promise<Community[]> {
  const { data, error } = await supabase
    .from("communities")
    .select("id, slug, name")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/**
 * The synagogues this account may administer, live or not.
 *
 * Deliberately not the same list as listCommunities(): a visitor may only
 * see synagogues that are open, while an admin has to be able to reach one
 * that is still being prepared - that is what preparing means. The server
 * decides which ones those are; a list built here would only be a
 * suggestion.
 */
export async function listMyCommunities(): Promise<Community[]> {
  const { data, error } = await supabase.rpc("my_communities");
  if (error) throw error;
  return (data ?? []) as Community[];
}

/**
 * Puts the synagogue in the address bar.
 *
 * So that a reload, a bookmark or a link sent to the other gabbai all open
 * the same one, and so that the answer to "which synagogue am I editing?"
 * is written somewhere the browser itself will show you. Replaces rather
 * than pushes: switching synagogue is not a place you go back from.
 */
export function writeCommunityToUrl(slug: string): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("shul") === slug) return;
    url.searchParams.set("shul", slug);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* an address bar we cannot write to changes nothing that matters */
  }
}

/**
 * Works out which synagogue this visit is about, and remembers it.
 *
 * Returns the list as well, so a caller that has to offer a choice does
 * not have to ask for it a second time.
 */
export async function resolveCommunity(): Promise<{
  community: Community | null;
  all: Community[];
}> {
  const all = await listCommunities();
  if (all.length === 0) return { community: null, all };

  const byLink = new URLSearchParams(window.location.search).get("shul");
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* nothing remembered */
  }

  // A link wins over a memory: someone who follows a link to a particular
  // synagogue means that one, whatever they looked at last week. A single
  // synagogue needs no choice at all.
  const chosen =
    all.find((c) => c.slug === byLink) ??
    all.find((c) => c.slug === stored) ??
    (all.length === 1 ? all[0] : null);

  // Remember a link only once it has actually been followed, and never
  // remember a fallback that was just the only one there was.
  setCommunity(chosen, Boolean(byLink));
  return { community: chosen, all };
}

/**
 * The synagogue, as React sees it - null until it has been settled.
 *
 * Every query that reads a synagogue's data takes this, puts it in its
 * cache key and refuses to run without it. That does three jobs at once:
 * nothing queries before the answer is known, one synagogue's rows can
 * never be served from cache under another's name, and switching
 * synagogue refetches by itself.
 */
export function useCommunityId(): string | null {
  return useCommunity()?.id ?? null;
}

/** The whole synagogue, for the few places that show it rather than query it. */
export function useCommunity(): Community | null {
  return useSyncExternalStore(subscribeCommunity, communitySnapshot, communitySnapshot);
}
