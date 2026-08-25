import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Improved mobile detection hook with immediate initial state
 * Returns true for mobile devices (< 768px)
 * 
 * For more granular device detection (mobile/tablet/desktop), use useDeviceType instead
 */
export function useIsMobile() {
  // Immediate detection - no FOUC (Flash of Unstyled Content)
  const getIsMobile = () => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  };

  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
