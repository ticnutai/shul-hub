import { useEffect, useRef, useState } from "react";
import { Palette, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TvConfig } from "@/tv/config";
import { ROLE_LABELS, guessRoles, parseFigmaColors, readHandoff, type FigmaColor } from "@/tv/figmaTokens";
import { THEME_ROLES, fromRoles, type ThemeRole } from "@/tv/transfer";
import { isLightColor } from "@/tv/themes";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/** One id, reused: the import is a live draft, not a pile of new themes. */
const DRAFT_ID = "c_figma";

/**
 * Bringing a palette over from Figma, without a token and without an account.
 *
 * The admin exports the file's variables to JSON in Figma and drops the file
 * here. Every colour in it is listed; ten of them are guessed into the roles
 * the board uses, and each guess can be changed. The theme is written into
 * the draft as the file lands, so the preview beside it - and the live window
 * on the second screen - shows the palette while it is still being sorted
 * out. Nothing reaches a TV until "שמור ושדר", like every other edit.
 */
export function FigmaImport({
  config,
  onEdit,
  handoff,
}: {
  config: TvConfig;
  onEdit: Edit;
  /** A palette the Figma plugin sent over (the URL fragment), read once. */
  handoff?: string | null;
}) {
  const [colours, setColours] = useState<FigmaColor[] | null>(null);
  const [roles, setRoles] = useState<Record<ThemeRole, string | null> | null>(null);
  const [name, setName] = useState("ערכה מפיגמה");
  /** What was selected before, to go back to on cancel. */
  const previousTheme = useRef(config.theme);
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const apply = (nextRoles: Record<ThemeRole, string | null>, themeName: string) => {
    const filled = Object.fromEntries(
      THEME_ROLES.map((r) => [r, nextRoles[r]]).filter(([, v]) => v),
    ) as Record<string, string>;
    const vars = fromRoles(filled);
    onEdit("figma.import", (c) => ({
      ...c,
      theme: DRAFT_ID,
      customThemes: [
        ...c.customThemes.filter((t) => t.id !== DRAFT_ID),
        {
          id: DRAFT_ID,
          name: themeName.trim() || "ערכה מפיגמה",
          description: "יובאה מפיגמה",
          light: isLightColor(vars["--tv-bg-a"]),
          vars,
        },
      ],
    }));
  };

  const load = async (file: File) => {
    try {
      const found = parseFigmaColors(await file.text());
      const guessed = guessRoles(found);
      const themeName = file.name.replace(/\.json$/i, "").slice(0, 40) || "ערכה מפיגמה";
      previousTheme.current = config.theme === DRAFT_ID ? previousTheme.current : config.theme;
      setColours(found);
      setRoles(guessed);
      setName(themeName);
      apply(guessed, themeName);
      toast.success(`נמצאו ${found.length} צבעים בקובץ`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "לא הצלחנו לקרוא את הקובץ");
    }
  };

  const setRole = (role: ThemeRole, value: string | null) => {
    if (!roles) return;
    const next = { ...roles, [role]: value };
    setRoles(next);
    apply(next, name);
  };

  const cancel = () => {
    onEdit("figma.cancel", (c) => ({
      ...c,
      theme: previousTheme.current,
      customThemes: c.customThemes.filter((t) => t.id !== DRAFT_ID),
    }));
    setColours(null);
    setRoles(null);
  };

  // The plugin's palette arrives before anything is dropped here.
  const handled = useRef(false);
  useEffect(() => {
    if (!handoff || handled.current) return;
    handled.current = true;
    const sent = readHandoff(handoff);
    if (!sent) {
      toast.error("הקישור מפיגמה לא הכיל צבעים שאפשר לקרוא");
      return;
    }
    const guessed = guessRoles(sent.colours);
    previousTheme.current = config.theme === DRAFT_ID ? previousTheme.current : config.theme;
    setColours(sent.colours);
    setRoles(guessed);
    setName(sent.name);
    apply(guessed, sent.name);
    toast.success(`התקבלו ${sent.colours.length} צבעים מפיגמה`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  if (!colours || !roles) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void load(file);
          }}
          className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed p-5 text-center transition ${
            dragging ? "border-primary bg-primary/5" : "hover:border-primary/60"
          }`}
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium">גררו לכאן קובץ JSON מפיגמה</span>
          <span className="text-xs text-muted-foreground">או לחצו לבחירת קובץ</span>
        </button>
        <input
          ref={fileInput}
          data-testid="figma-file"
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void load(file);
            e.target.value = "";
          }}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          בפיגמה: לפתוח את לוח המשתנים (Variables) ← <span dir="ltr">Export</span> ל-JSON, או
          להשתמש בתוסף חינמי כמו <span dir="ltr">Design Tokens</span>. אין צורך בחשבון, בטוקן או
          בחיבור לאינטרנט — הקובץ נקרא כאן בדפדפן.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            apply(roles, e.target.value);
          }}
          aria-label="שם הערכה"
          className="h-8"
        />
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="ביטול הייבוא" onClick={cancel}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">{colours.length} צבעים בקובץ</div>
        <div className="flex flex-wrap gap-1">
          {colours.map((c) => (
            <span
              key={c.name}
              title={`${c.name} · ${c.value}`}
              className="size-5 rounded border"
              style={{ background: c.value }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {THEME_ROLES.map((role) => (
          <div key={role} className="flex items-center gap-2 text-xs">
            <span
              className="size-5 shrink-0 rounded border"
              style={{ background: roles[role] ?? "transparent" }}
              aria-hidden
            />
            <span className="w-24 shrink-0">{ROLE_LABELS[role]}</span>
            <select
              value={roles[role] ?? ""}
              aria-label={ROLE_LABELS[role]}
              onChange={(e) => setRole(role, e.target.value || null)}
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2"
            >
              <option value="">— כברירת המחדל —</option>
              {colours.map((c) => (
                <option key={c.name} value={c.value}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        הערכה כבר מוצגת בתצוגה המקדימה ובחלון החי. תפקיד שלא נבחר לו צבע לוקח את הצבע של ערכת
        ברירת המחדל. בסיום: <span className="font-medium">שמור ושדר</span>.
      </p>
    </div>
  );
}
