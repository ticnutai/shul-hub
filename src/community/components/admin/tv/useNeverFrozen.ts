import { useEffect } from "react";

/**
 * The editor can never be left unclickable.
 *
 * A modal locks the page by putting `pointer-events: none` on the body and
 * clears it when it closes. When it closes into a trigger that has just been
 * disabled or removed - which is what "ביטול שינויים" and "מחיקת ערכה" do,
 * by their nature - that cleanup can be skipped, and the whole page stops
 * answering while looking perfectly normal. It was reported twice.
 *
 * Both of those now ask inline instead of opening a modal, so the case should
 * not arise; this is the net under them. Whenever the body is locked and no
 * modal is open, the lock is lifted - including while a dialog is still
 * playing its closing animation, which is a few hundred milliseconds in which
 * clicks were silently swallowed. It costs one MutationObserver, watching for
 * the attribute a dialog flips when it closes, and runs only while the editor
 * is mounted.
 */
const OPEN_MODAL =
  '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[data-radix-popper-content-wrapper]';

export function useNeverFrozen(): void {
  useEffect(() => {
    const { body } = document;
    const unlockIfStuck = () => {
      if (body.style.pointerEvents !== "none") return;
      if (document.querySelector(OPEN_MODAL)) return;
      body.style.removeProperty("pointer-events");
    };

    // The lock is a style on the body, and a dialog announces itself with
    // data-state deep inside a portal - so both, and the subtree for the one.
    const observer = new MutationObserver(unlockIfStuck);
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["style", "data-state"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("focus", unlockIfStuck);
    return () => {
      observer.disconnect();
      window.removeEventListener("focus", unlockIfStuck);
    };
  }, []);
}
