/**
 * A new announcement, shiur, chavruta or minyan - the same row whichever door
 * it came in by: the full form, "הוספה מהירה" (+) or the smart assistant.
 *
 * Each door used to write its own: the quick add put every shiur and minyan
 * at place 100 (the middle of a list numbered 10, 20, 30…), the assistant put
 * announcements first and gave them a look the full form did not, and the
 * full form gave a new announcement a kind the other two never did. Here are
 * the defaults once, and a new row always goes to the end of its list - the
 * same as dragging would put it.
 */
import { supabase } from "@community/integrations/supabase/client";
import { communityId } from "@/community/lib/community";
import { presetAnnouncementStyle } from "@community/lib/announcement-style";
import type { Announcement, Chavruta, Minyan, MinyanCategory, Shiur } from "@community/lib/data";
import { minyanSubcategories } from "@community/lib/data";

type Table = "announcements" | "shiurim" | "chavrutot" | "minyanim";

/** After the last row of this synagogue's list: its largest place, plus ten. */
export async function nextSortOrderFor(table: Table): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("sort_order")
    .eq("community_id", communityId())
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (Number((data?.[0] as { sort_order?: number } | undefined)?.sort_order) || 0) + 10;
}

/* ---------- what a new one starts as: the full form opens with these ---------- */

export const newAnnouncement = (): Partial<Announcement> => ({
  kind: "general",
  title: "",
  body: "",
  pinned: false,
  notification_enabled: false,
  show_on_home: true,
  home_width: "half",
  image_url: null,
  image_path: null,
  expires_at: null,
  style: presetAnnouncementStyle("classic") as Announcement["style"],
});

export const newShiur = (): Partial<Shiur> => ({
  title: "",
  teacher: "",
  day_of_week: 0,
  time_text: "",
  location: "",
  description: "",
  category_id: null,
  schedule_type: "weekly",
  active: true,
  notification_enabled: false,
  reminder_minutes: 15,
});

export const newChavruta = (): Partial<Chavruta> => ({
  topic: "",
  partners: "",
  time_text: "",
  contact: "",
  looking_for_partner: false,
  notification_enabled: false,
  active: true,
});

/** A minyan in a tab, under the tab's first prayer - its own key, or "custom" for a tab the synagogue made. */
export const newMinyan = (category: MinyanCategory): Partial<Minyan> & { day_type: string; category_id: string | null } => ({
  day_type: category.system_key ?? "custom",
  category_id: category.id,
  prayer: minyanSubcategories(category)[0]?.id ?? "other",
  label: "",
  time_mode: "fixed",
  fixed_time: "07:00",
  relative_to: "sunset",
  offset_minutes: 0,
  room: "",
  note: "",
  active: true,
  notification_enabled: false,
  reminder_minutes: 15,
});

/* ---------- writing one: the defaults, what was filled in, and its place at the end ---------- */

async function insert(table: Table, defaults: Record<string, unknown>, fields: Record<string, unknown>) {
  const sort_order = fields["sort_order"] ?? (await nextSortOrderFor(table));
  const { error } = await supabase
    .from(table)
    .insert({ ...defaults, ...fields, sort_order, community_id: communityId() } as never);
  if (error) throw error;
}

export const createAnnouncement = (fields: Partial<Announcement>) =>
  insert("announcements", newAnnouncement(), fields as Record<string, unknown>);

export const createShiur = (fields: Partial<Shiur>) => insert("shiurim", newShiur(), fields as Record<string, unknown>);

export const createChavruta = (fields: Partial<Chavruta>) =>
  insert("chavrutot", newChavruta(), fields as Record<string, unknown>);

export function createMinyan(category: MinyanCategory | null, fields: Partial<Minyan>) {
  const base = category ? newMinyan(category) : newMinyan({ id: null, system_key: "custom" } as unknown as MinyanCategory);
  return insert("minyanim", base, fields as Record<string, unknown>);
}
