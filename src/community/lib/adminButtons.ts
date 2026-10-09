/**
 * The admin's own buttons - "הוספה מהירה" (+) and the smart assistant (✨):
 * each shown or not, and floating in the corner of the screen or standing in
 * the top bar beside the account. Kept with the admin's display settings,
 * so each one chooses for himself, apart on the phone and on the computer.
 */
import { useCallback, useRef } from "react";
import { useDisplayMode } from "@/contexts/DisplayModeContext";

export type AdminButtonId = "quickAdd" | "assistant";
/** pos: where a floating button was dragged to (its corner, as a share of the screen); none - its own corner. */
export type AdminButtonPref = { on: boolean; floating: boolean; pos?: { x: number; y: number } };
export type AdminButtonsPrefs = Record<AdminButtonId, AdminButtonPref>;

export const ADMIN_BUTTONS: { id: AdminButtonId; label: string; hint: string }[] = [
  { id: "quickAdd", label: "הוספה מהירה (+)", hint: "הוספת מודעה, שיעור, חברותא או מניין בלי לעבור למסך הניהול" },
  { id: "assistant", label: "עוזר חכם (✨)", hint: "קיצור דרך לעוזר החכם של המנהל" },
];

export const DEFAULT_ADMIN_BUTTONS: AdminButtonsPrefs = {
  quickAdd: { on: true, floating: true },
  assistant: { on: true, floating: true },
};

const share = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
const validPos = (p: unknown): p is { x: number; y: number } =>
  Boolean(p) && typeof p === "object" && share((p as { x: unknown }).x) && share((p as { y: unknown }).y);

export function normalizeAdminButtons(value: unknown): AdminButtonsPrefs {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<AdminButtonId, Partial<AdminButtonPref>>>;
  const one = (id: AdminButtonId): AdminButtonPref => ({
    on: typeof v[id]?.on === "boolean" ? v[id]!.on! : DEFAULT_ADMIN_BUTTONS[id].on,
    floating: typeof v[id]?.floating === "boolean" ? v[id]!.floating! : DEFAULT_ADMIN_BUTTONS[id].floating,
    ...(validPos(v[id]?.pos) ? { pos: v[id]!.pos } : {}),
  });
  return { quickAdd: one("quickAdd"), assistant: one("assistant") };
}

export function useAdminButtons() {
  const { displaySettings, updateDisplaySettings } = useDisplayMode();
  const prefs = normalizeAdminButtons(displaySettings.adminButtons);
  // The latest choice, so two switches flipped one after the other both count
  // (the second must not be built on the screen from before the first).
  const latest = useRef(prefs);
  latest.current = prefs;
  const set = useCallback(
    (id: AdminButtonId, patch: Partial<AdminButtonPref>) => {
      const next = { ...latest.current, [id]: { ...latest.current[id], ...patch } };
      latest.current = next;
      updateDisplaySettings({ adminButtons: next });
    },
    [updateDisplaySettings],
  );
  return { prefs, set };
}
