import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

const PAGE_ORDER = ["/", "/announcements", "/shiurim", "/chavrutot", "/contact"] as const;
const MIN_SWIPE_DISTANCE = 70;
const MAX_SWIPE_DURATION = 800;
const HORIZONTAL_DOMINANCE = 1.25;

function shouldIgnoreGesture(target: EventTarget | null) {
  if (!(target instanceof Element)) return true;

  return Boolean(
    target.closest(
      "input, textarea, select, [role='slider'], [contenteditable='true'], " +
        "[draggable='true'], [data-no-page-swipe]",
    ) || document.querySelector("[role='dialog']"),
  );
}

export function MobilePageSwipe() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const currentIndex = PAGE_ORDER.indexOf(pathname as (typeof PAGE_ORDER)[number]);
    if (currentIndex < 0) return;

    let pointerId: number | null = null;
    let gestureSource: "pointer" | "touch" | null = null;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let suppressClickUntil = 0;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.touchAction = "pan-y pinch-zoom";

    const reset = () => {
      pointerId = null;
      gestureSource = null;
    };

    const startGesture = (x: number, y: number, source: "pointer" | "touch") => {
      if (gestureSource) return;
      gestureSource = source;
      startX = x;
      startY = y;
      startTime = performance.now();
    };

    const finishGesture = (x: number, y: number, source: "pointer" | "touch") => {
      if (gestureSource !== source) return;
      const deltaX = x - startX;
      const deltaY = y - startY;
      const duration = performance.now() - startTime;
      reset();

      if (
        duration > MAX_SWIPE_DURATION ||
        Math.abs(deltaX) < MIN_SWIPE_DISTANCE ||
        Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_DOMINANCE
      ) {
        return;
      }

      // In RTL, swiping right-to-left advances through the visible navigation order.
      const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
      const nextPath = PAGE_ORDER[nextIndex];
      if (nextPath) {
        suppressClickUntil = performance.now() + 500;
        void navigate({ to: nextPath });
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (
        window.innerWidth >= 768 ||
        event.pointerType !== "touch" ||
        !event.isPrimary ||
        shouldIgnoreGesture(event.target)
      ) {
        return;
      }

      pointerId = event.pointerId;
      startGesture(event.clientX, event.clientY, "pointer");
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;

      finishGesture(event.clientX, event.clientY, "pointer");
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (
        !touch ||
        window.innerWidth >= 768 ||
        event.touches.length !== 1 ||
        shouldIgnoreGesture(event.target)
      ) {
        return;
      }
      startGesture(touch.clientX, touch.clientY, "touch");
    };

    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      finishGesture(touch.clientX, touch.clientY, "touch");
    };

    const onClick = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("pointercancel", reset, { passive: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", reset);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", reset);
      document.removeEventListener("click", onClick, true);
      document.body.style.touchAction = previousTouchAction;
    };
  }, [navigate, pathname]);

  return null;
}
