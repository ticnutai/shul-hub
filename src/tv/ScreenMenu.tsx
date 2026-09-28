/**
 * The menu a gabbai can reach from the remote, standing under the board.
 *
 * One system, several synagogues: until now which one a screen showed was
 * decided once, by an administrator typing a pairing code at a computer.
 * That is right for pairing and wrong for a hall - a screen that should
 * serve a different minyan this week meant finding somebody with a laptop.
 *
 * So the connection dot, which was only ever a light, becomes the way in.
 * Up or Down opens this; the dot takes a gold ring so it is obvious what was
 * reached; the arrows move, OK chooses and Back leaves. Nothing here is
 * reachable by accident: with the menu closed the arrows do exactly what
 * they always did, and the board on the wall is unchanged.
 *
 * The theme sits here too, because Up and Down used to cycle it and this
 * takes those keys. Nothing was removed, only moved somewhere it can be
 * seen rather than guessed at.
 */
import { useEffect, useRef, useState } from "react";

import { listCommunities, setDeviceCommunity, type CommunityChoice } from "./device";
import type { TvTheme } from "./config";

export type MenuState = "closed" | "open";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which synagogue this screen is showing now, for the tick beside it. */
  currentCommunity: string | null;
  /**
   * Whether this really is a screen and may move itself.
   *
   * The same board opens in a browser for an administrator, where there is
   * no device and no secret, so choosing a synagogue would only produce a
   * failure. There it offers the theme and says where the choice belongs.
   */
  canSwitch: boolean;
  themes: TvTheme[];
  currentTheme: string;
  onTheme: (id: string) => void;
  /** Said out loud on the board and in the screen's log. */
  onLog?: (level: "info" | "warn" | "error", message: string) => void;
  /** Overridden in tests; on the wall the board reloads onto the new synagogue. */
  reload?: () => void;
}

type Row =
  | { kind: "community"; community: CommunityChoice }
  | { kind: "theme" };

export function ScreenMenu({
  open,
  onClose,
  currentCommunity,
  canSwitch,
  themes,
  currentTheme,
  onTheme,
  onLog,
  reload,
}: Props) {
  const [communities, setCommunities] = useState<CommunityChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const liveIndex = useRef(0);
  liveIndex.current = index;

  // Asked for when the menu opens rather than kept fresh in the background:
  // the list changes when a synagogue is added, which is rare, and a board
  // should not be talking to the server for a menu nobody has opened.
  useEffect(() => {
    if (!open || !canSwitch) return;
    let alive = true;
    setError(null);
    listCommunities()
      .then((rows) => alive && setCommunities(rows))
      .catch(() => alive && setError("אין חיבור - רשימת בתי הכנסת לא נטענה"));
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const rows: Row[] = [
    ...(canSwitch ? communities ?? [] : []).map((community) => ({ kind: "community" as const, community })),
    { kind: "theme" as const },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // The menu owns the remote while it is up, so the board underneath does
      // not also move a slide on the same press.
      const stop = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      switch (e.key) {
        case "ArrowUp":
          stop();
          setIndex((i) => (i - 1 + rows.length) % Math.max(1, rows.length));
          break;
        case "ArrowDown":
          stop();
          setIndex((i) => (i + 1) % Math.max(1, rows.length));
          break;
        case "Enter":
        case " ": {
          stop();
          const row = rows[liveIndex.current];
          if (!row || busy) break;
          if (row.kind === "theme") {
            const at = themes.findIndex((t) => t.id === currentTheme);
            onTheme(themes[(at + 1) % Math.max(1, themes.length)]?.id ?? currentTheme);
            break;
          }
          if (row.community.id === currentCommunity) {
            onClose();
            break;
          }
          setBusy(true);
          void setDeviceCommunity(row.community.id)
            .then((c) => {
              onLog?.("info", `המסך הועבר לבית הכנסת: ${c.name}`);
              // The board is built from this synagogue's data all the way
              // down - its minyanim, its design, its day's screen - so it
              // starts again rather than trying to swap them underneath.
              (reload ?? (() => window.location.reload()))();
            })
            .catch(() => {
              setBusy(false);
              setError("לא הצלחתי להעביר את המסך. נסו שוב בעוד רגע.");
            });
          break;
        }
        case "Escape":
        case "Backspace":
        case "GoBack":
          stop();
          onClose();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, rows.length, busy, themes, currentTheme, currentCommunity, onTheme, onClose, onLog, reload]);

  if (!open) return null;

  const themeName = themes.find((t) => t.id === currentTheme)?.name ?? currentTheme;

  return (
    <div className="tv-menu" role="dialog" aria-label="בחירת בית כנסת" data-testid="screen-menu">
      <div className="tv-menu-card">
        <div className="tv-menu-title">באיזה בית כנסת המסך הזה</div>

        {error && <div className="tv-menu-note is-error">{error}</div>}
        {canSwitch && !communities && !error && <div className="tv-menu-note">טוען…</div>}
        {!canSwitch && (
          <div className="tv-menu-note">בחירת בית כנסת נעשית מהמסך עצמו, עם השלט.</div>
        )}

        <ul className="tv-menu-list">
          {rows.map((row, i) => {
            const active = i === index;
            if (row.kind === "theme") {
              return (
                <li key="theme" className={`tv-menu-row is-theme${active ? " is-active" : ""}`}>
                  <span>ערכת נושא</span>
                  <span className="tv-menu-value">{themeName}</span>
                </li>
              );
            }
            const here = row.community.id === currentCommunity;
            return (
              <li
                key={row.community.id}
                className={`tv-menu-row${active ? " is-active" : ""}${here ? " is-here" : ""}`}
                aria-current={here}
              >
                <span>{row.community.name}</span>
                <span className="tv-menu-value">
                  {busy && active ? "מעביר…" : here ? "המסך הזה" : ""}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="tv-menu-hint">חיצים לתנועה · OK לבחירה · חזרה ליציאה</div>
      </div>
    </div>
  );
}
