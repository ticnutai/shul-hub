import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "omer_checklist_v2";
const SEEDED_KEY = "omer_checklist_seeded_v2";

function loadLocal(hebrewYear: number): Set<number> {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (p.year === hebrewYear) return new Set<number>(p.counted);
    }
  } catch { /* ignore */ }
  return new Set<number>();
}

function saveLocal(hebrewYear: number, counted: Set<number>) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ year: hebrewYear, counted: [...counted].sort((a, b) => a - b) }),
    );
  } catch { /* ignore */ }
}

async function saveRemote(hebrewYear: number, counted: Set<number>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        omer_checklist: { year: hebrewYear, counted: [...counted].sort((a, b) => a - b) },
      },
    });
  } catch { /* ignore */ }
}

async function loadRemote(hebrewYear: number): Promise<Set<number> | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const cl = user?.user_metadata?.omer_checklist;
    if (!cl || cl.year !== hebrewYear) return null;
    return new Set<number>(cl.counted);
  } catch { return null; }
}

export interface OmerStats {
  totalCounted: number;
  streak: number;
  percentage: number;
  missedAny: boolean;
  firstMissed: number | null;
}

function computeStats(counted: Set<number>, currentDay: number | null): OmerStats {
  const totalCounted = counted.size;
  const percentage = Math.round((totalCounted / 49) * 100);
  const maxDay = currentDay ?? 49;

  let streak = 0;
  for (let d = maxDay; d >= 1; d--) {
    if (counted.has(d)) streak++;
    else break;
  }

  let firstMissed: number | null = null;
  for (let d = 1; d <= maxDay; d++) {
    if (!counted.has(d)) { firstMissed = d; break; }
  }

  return { totalCounted, streak, percentage, missedAny: firstMissed !== null, firstMissed };
}

export function useOmerChecklist(hebrewYear: number, currentDay: number | null) {
  const [counted, setCounted] = useState<Set<number>>(() => loadLocal(hebrewYear));

  // Seed past days on first launch during a season
  useEffect(() => {
    if (currentDay === null || currentDay < 1) return;
    const seedKey = `${SEEDED_KEY}_${hebrewYear}`;
    if (localStorage.getItem(seedKey)) return;
    if (counted.size > 0) { localStorage.setItem(seedKey, "1"); return; }
    const initial = new Set<number>();
    for (let d = 1; d <= currentDay; d++) initial.add(d);
    setCounted(initial);
    saveLocal(hebrewYear, initial);
    localStorage.setItem(seedKey, "1");
  }, [currentDay, hebrewYear, counted.size]);

  // Merge remote data on auth state change
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      loadRemote(hebrewYear).then((remote) => {
        if (!remote) return;
        setCounted((prev) => {
          const merged = new Set([...prev, ...remote]);
          saveLocal(hebrewYear, merged);
          return merged;
        });
      });
    });
    return () => subscription.unsubscribe();
  }, [hebrewYear]);

  const toggleDay = useCallback(
    (day: number) => {
      setCounted((prev) => {
        const next = new Set(prev);
        if (next.has(day)) next.delete(day);
        else next.add(day);
        saveLocal(hebrewYear, next);
        saveRemote(hebrewYear, next);
        return next;
      });
    },
    [hebrewYear],
  );

  const markToday = useCallback(() => {
    if (currentDay === null) return;
    setCounted((prev) => {
      if (prev.has(currentDay)) return prev;
      const next = new Set(prev);
      next.add(currentDay);
      saveLocal(hebrewYear, next);
      saveRemote(hebrewYear, next);
      return next;
    });
  }, [currentDay, hebrewYear]);

  const isCounted = useCallback((day: number) => counted.has(day), [counted]);
  const stats = computeStats(counted, currentDay);

  return { counted, toggleDay, markToday, isCounted, stats };
}
