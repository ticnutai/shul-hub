import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDevice } from "@/contexts/DeviceContext";
import { useOmerSeason } from "@/features/omer/hooks/useOmerSeason";

const STANDARD_MAIN_PAGES = ["/community", "/siddur", "/chumash"] as const;
const MIN_HORIZONTAL_DISTANCE = 72;
const MAX_VERTICAL_DISTANCE = 56;
const EDGE_GUARD = 24;

const BLOCKED_TARGETS = [
  "button", "a", "input", "textarea", "select", "label",
  "[role='dialog']", "[role='slider']", "[role='tablist']",
  "[contenteditable='true']", "[data-no-page-swipe]",
].join(",");

type StartPoint = { x: number; y: number; target: EventTarget | null };

/** Horizontal swipe navigation between the three main mobile pages. */
export function MobilePageSwipeNavigation() {
  const { isMobile } = useDevice();
  const location = useLocation();
  const navigate = useNavigate();
  const omerInSeason = useOmerSeason();
  const startRef = useRef<StartPoint | null>(null);
  const latestRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    const mainPages: readonly string[] = omerInSeason
      ? [...STANDARD_MAIN_PAGES, "/omer"]
      : STANDARD_MAIN_PAGES;
    const currentIndex = mainPages.indexOf(location.pathname);
    if (currentIndex < 0) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        startRef.current = null;
        latestRef.current = null;
        return;
      }
      const touch = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      const selection = window.getSelection();
      if (
        touch.clientX < EDGE_GUARD ||
        touch.clientX > window.innerWidth - EDGE_GUARD ||
        target?.closest(BLOCKED_TARGETS) ||
        (selection && !selection.isCollapsed)
      ) {
        startRef.current = null;
        latestRef.current = null;
        return;
      }
      startRef.current = { x: touch.clientX, y: touch.clientY, target: event.target };
      latestRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const finishGesture = (x: number, y: number) => {
      const start = startRef.current;
      startRef.current = null;
      latestRef.current = null;
      if (!start) return;
      const dx = x - start.x;
      const dy = y - start.y;
      if (
        Math.abs(dx) < MIN_HORIZONTAL_DISTANCE ||
        Math.abs(dy) > MAX_VERTICAL_DISTANCE ||
        Math.abs(dx) < Math.abs(dy) * 1.35
      ) return;

      // Swipe left advances; swipe right returns to the previous main page.
      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= mainPages.length) return;
      navigate(mainPages[nextIndex]);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!startRef.current || event.touches.length !== 1) return;
      latestRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (touch) finishGesture(touch.clientX, touch.clientY);
      else if (latestRef.current) finishGesture(latestRef.current.x, latestRef.current.y);
    };
    // Android WebView may convert a rightward pan into touchcancel. Use the
    // last observed coordinate so the same deliberate gesture still works.
    const onTouchCancel = () => {
      const latest = latestRef.current;
      if (latest) finishGesture(latest.x, latest.y);
      else startRef.current = null;
    };
    // Capture is intentional: some page widgets stop bubbling touch events.
    // The global page gesture must see the sequence before those widgets,
    // while BLOCKED_TARGETS still protects every interactive control.
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true, capture: true });
    document.body.dataset.mobilePageSwipe = "enabled";
    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", onTouchCancel, true);
      delete document.body.dataset.mobilePageSwipe;
    };
  }, [isMobile, location.pathname, navigate, omerInSeason]);

  return null;
}
