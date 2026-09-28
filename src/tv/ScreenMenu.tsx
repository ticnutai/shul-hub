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
import type { TvTheme } from "./themes";

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
  /** Overridden in tests; on the wall the board reloads onto the new synagogue. */
  reload?: () => void;
}

type Row =
  | { kind: "community"; community: CommunityChoice }
  | { kind: "theme" }
  | { kind: "close" };

export function ScreenMenu({
  open,
  onClose,
  currentCommunity,
  canSwitch,
  themes,
  currentTheme,
  onTheme,
  reload,
}: Props) {
  const [communities, setCommunities] = useState<CommunityChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const liveIndex = useRef(0);
  liveIndex.current = index;
  /**
   * The same flag the key handler can actually see.
   *
   * `busy` in state is captured by the listener's closure and stays false
   * there however many times it is set, so a key that repeats - and the TV
   * remote's OK does repeat - sent the move twice. It showed up as the same
   * line twice in the screen's log, one second apart, on the real box.
   */
  const busyRef = useRef(false);
  /**
   * The rows as they are now, for a listener that was registered earlier.
   *
   * The synagogues are fetched when the menu opens, so for the first moment
   * the list is two rows - the theme and the close - and the arrows wrapped
   * around inside those two. Four presses moved one place, and when the
   * synagogues arrived that place was a synagogue rather than the row the
   * gabbai was aiming for: pressing OK then moved the screen to another shul
   * instead of changing the theme. Seen on the box, and it is exactly what
   * was reported - "I try to change the theme and it does not change".
   */
  const rowsRef = useRef<Row[]>([]);

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
    if (!open) return;
    setIndex(0);
    busyRef.current = false;
    setBusy(false);
  }, [open]);

  const rows: Row[] = [
    ...(canSwitch ? communities ?? [] : []).map((community) => ({ kind: "community" as const, community })),
    { kind: "theme" as const },
    // A way out that needs nothing but the arrows and OK.
    //
    // The obvious way out is Back, and on this hardware Back never reaches
    // the page at all: Android hands it to the app, and the app can only act
    // on it through a Capacitor plugin the installed APK does not have -
    // measured on the box, where every call answers '"App" plugin is not
    // implemented on android'. A menu that can only be left by a button that
    // does nothing is a trap, and this is signage on a wall.
    { kind: "close" as const },
  ];

  rowsRef.current = rows;
  /** The synagogues have been asked for and have not come back yet. */
  const loading = canSwitch && communities === null && !error;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Nothing is worth pressing while the list is still arriving: the rows
      // are about to change under the press, and a key aimed at one of them
      // would land on another. It is a moment, and the menu says "טוען…".
      if (loading) {
        if (["ArrowUp", "ArrowDown", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      // The menu owns the remote while it is up, so the board underneath does
      // not also move a slide on the same press.
      const stop = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      switch (e.key) {
        case "ArrowUp":
          stop();
          setIndex((i) => (i - 1 + rowsRef.current.length) % Math.max(1, rowsRef.current.length));
          break;
        case "ArrowDown":
          stop();
          setIndex((i) => (i + 1) % Math.max(1, rowsRef.current.length));
          break;
        case "Enter":
        case " ": {
          stop();
          const row = rowsRef.current[liveIndex.current];
          if (!row || busyRef.current) break;
          if (row.kind === "close") {
            onClose();
            break;
          }
          if (row.kind === "theme") {
            const at = themes.findIndex((t) => t.id === currentTheme);
            onTheme(themes[(at + 1) % Math.max(1, themes.length)]?.id ?? currentTheme);
            break;
          }
          if (row.community.id === currentCommunity) {
            onClose();
            break;
          }
          busyRef.current = true;
          setBusy(true);
          void setDeviceCommunity(row.community.id)
            .then(() => {
              // The move is written to the screen's log by the server, in the
              // same transaction that makes it - so it is not written again
              // from here. It was, and every move appeared twice in the log,
              // one second apart, which read as a double press.
              //
              // The board is built from this synagogue's data all the way
              // down - its minyanim, its design, its day's screen - so it
              // starts again rather than trying to swap them underneath.
              (reload ?? (() => window.location.reload()))();
            })
            .catch(() => {
              busyRef.current = false;
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
  }, [open, loading, rows.length, themes, currentTheme, currentCommunity, onTheme, onClose, reload]);

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
            if (row.kind === "close") {
              return (
                <li key="close" className={`tv-menu-row is-close${active ? " is-active" : ""}`}>
                  <span>סגירה</span>
                </li>
              );
            }
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

        <div className="tv-menu-hint">חיצים לתנועה · OK לבחירה</div>
      </div>
    </div>
  );
}
