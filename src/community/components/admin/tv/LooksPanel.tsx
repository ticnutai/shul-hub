import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyLook, lookFromConfig, MAX_LOOKS, type TvConfig, type TvLook } from "@/tv/config";
import { TV_FONTS, getTheme } from "@/tv/themes";
import { FRAME_CHOICES, SKIN_CHOICES } from "./tvChoices";

type Edit = (key: string, update: (c: TvConfig) => TvConfig) => void;

/**
 * Whole looks: the colours together with the style, corners, spacing, font,
 * background and clock. A designer builds one on the board, saves it here,
 * exports it; another synagogue imports it and gets the same board in one
 * click - not a palette to pair with a style by hand.
 */
export function LooksPanel({ config, onEdit }: { config: TvConfig; onEdit: Edit }) {
  const [name, setName] = useState("");
  const looks = config.customLooks;
  const full = looks.length >= MAX_LOOKS;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || full) return;
    onEdit("look-save", (c) => ({ ...c, customLooks: [...c.customLooks, lookFromConfig(c, trimmed)].slice(0, MAX_LOOKS) }));
    setName("");
  };

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input
          id="look-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם למראה, למשל: חנוכה באבן ירושלים"
          maxLength={40}
          className="h-9 min-w-0 flex-1 basis-48"
          aria-label="שם המראה"
        />
        <Button type="submit" size="sm" disabled={!name.trim() || full}>
          <Plus className="size-4" /> שמירת המראה הנוכחי
        </Button>
      </form>
      {full && <p className="text-xs text-muted-foreground">הגעתם ל-{MAX_LOOKS} מראות. מחקו מראה כדי לשמור חדש.</p>}

      {looks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          עדיין אין מראות שמורים. עצבו את הלוח (ערכה, סגנון, פינות, מרווחים, גופן) ושמרו אותו כאן בשם. מראה
          שמיובא מקובץ מופיע כאן גם הוא.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="looks-list">
          {looks.map((look) => (
            <LookCard
              key={look.id}
              look={look}
              config={config}
              onApply={() => onEdit("look-apply", (c) => applyLook(c, look))}
              onDelete={() => onEdit("look-delete", (c) => ({ ...c, customLooks: c.customLooks.filter((l) => l.id !== look.id) }))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LookCard({ look, config, onApply, onDelete }: { look: TvLook; config: TvConfig; onApply: () => void; onDelete: () => void }) {
  const theme = getTheme(look.theme, config.customThemes);
  const v = theme.vars;
  const b = look.board;
  const facts = [
    theme.name,
    b.skin ? SKIN_CHOICES.find((s) => s.id === b.skin)?.name : null,
    b.frame && b.frame.shape !== "auto" ? `פינות: ${FRAME_CHOICES.find((f) => f.id === b.frame!.shape)?.name}` : null,
    b.font ? TV_FONTS.find((f) => f.id === b.font)?.name.split(" (")[0] : null,
  ].filter(Boolean);
  const active = config.theme === look.theme && (!b.skin || config.skin === b.skin);

  return (
    <li className="overflow-hidden rounded-lg border">
      <div
        aria-hidden
        className="flex h-10 items-center gap-1.5 px-2"
        style={{ background: `linear-gradient(135deg, ${v["--tv-bg-b"]}, ${v["--tv-bg-a"]})` }}
      >
        <span className="rounded px-1.5 text-[11px] font-bold" style={{ background: v["--tv-accent"], color: v["--tv-on-accent"] }}>
          18:42
        </span>
        <span className="h-5 flex-1 rounded-sm border" style={{ background: v["--tv-panel"], borderColor: v["--tv-accent-2"] }} />
        <span className="h-5 flex-1 rounded-sm border" style={{ background: v["--tv-panel"], borderColor: v["--tv-accent-2"] }} />
      </div>
      <div className="space-y-1.5 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{look.name}</span>
          {active && (
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-primary">
              <Check className="size-3" /> על הלוח
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{facts.join(" · ")}</p>
        {look.description && <p className="text-xs text-muted-foreground">{look.description}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" className="h-8 flex-1" onClick={onApply}>
            החלה על הלוח
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onDelete} aria-label={`מחיקת ${look.name}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
