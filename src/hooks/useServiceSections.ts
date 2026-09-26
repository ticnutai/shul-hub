import { useEffect, useMemo, useState } from "react";
import { loadSiddurCategory, useSiddurSections, type SiddurSection } from "@/hooks/useSiddurData";
import { profileOf, type DayProfile } from "@/lib/jewishDay";
import { composeService, type FestivalData, type Section, type ServiceId } from "@/lib/siddurService";
import { readingOn, readingSection } from "@/lib/readingText";
import type { Nusach } from "@/lib/siddurToday";

/**
 * A prayer of the siddur as it is said today ("לפי לוח שנה"), or as printed
 * when the mode is off (profile null). The page, the section strip and the
 * list at the top all read the same list, so a tap lands on what is shown.
 */

const SERVICES: Record<string, ServiceId> = { shacharit: "shacharit", mincha: "mincha", arvit: "arvit" };

const festivalCache: Record<string, Promise<FestivalData | null>> = {};
function loadFestival(nusach: string): Promise<FestivalData | null> {
  const family = nusach === "ashkenaz" ? "ashkenaz" : nusach === "edot_hamizrach" ? null : "sefard";
  if (!family) return Promise.resolve(null);
  festivalCache[family] ??= (
    family === "ashkenaz" ? import("@/data/siddur/festival_ashkenaz.json") : import("@/data/siddur/festival_sefard.json")
  )
    .then((m) => m.default as unknown as FestivalData)
    .catch(() => null);
  return festivalCache[family]!;
}

export function useServiceSections(nusach: string, catId: string, profile: DayProfile | null) {
  const base = useSiddurSections(nusach, catId);
  const service = profile ? SERVICES[catId] : undefined;
  // Arvit is said at night: before nightfall it is the coming night's.
  const day = profile && service === "arvit" && !profile.evening ? profileOf(profile.hdate.next(), true, true) : profile;

  const [other, setOther] = useState<Section[] | null>(null);
  const [festival, setFestival] = useState<FestivalData | null>(null);
  const [reading, setReading] = useState<Section | null>(null);

  useEffect(() => {
    if (!service) return;
    let alive = true;
    void Promise.all([loadSiddurCategory(nusach, "other"), loadFestival(nusach)]).then(([o, f]) => {
      if (!alive) return;
      setOther(o?.sections ?? []);
      setFestival(f);
    });
    return () => {
      alive = false;
    };
  }, [nusach, service]);

  const dayKey = day?.hdate.abs();
  useEffect(() => {
    setReading(null);
    if (service !== "shacharit" || !day || !readingOn(day.hdate)) return;
    let alive = true;
    const minhag = nusach === "edot_hamizrach" ? "sephardi" : nusach === "chabad" ? "chabad" : "ashkenazi";
    // A placeholder in its place at once, the verses when the chumash is loaded.
    setReading({ title: "קריאת התורה להיום", lines: ["טוען את הקריאה…"] });
    readingSection(day.hdate, true, minhag)
      .then((s) => alive && setReading(s))
      .catch(() => alive && setReading(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nusach, service, dayKey]);

  const sections = useMemo<SiddurSection[] | null>(() => {
    if (!base.sections || !service || !day || !other) return base.sections;
    return composeService({
      service,
      nusach: nusach as Nusach,
      profile: day,
      base: base.sections,
      other,
      festival,
      reading,
    });
  }, [base.sections, service, day, other, festival, reading, nusach]);

  return { ...base, sections, composed: Boolean(service && day && other) };
}
