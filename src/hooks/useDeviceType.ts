import { useState, useEffect } from "react";

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
} as const;

/**
 * Hook for automatic device type detection based on viewport width
 * - Mobile: < 640px
 * - Tablet: 640px - 1024px
 * - Desktop: > 1024px
 */
export function useDeviceType(): DeviceType {
  // Immediate initial detection (no FOUC)
  const getDeviceType = (): DeviceType => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < BREAKPOINTS.mobile) return 'mobile';
    if (width < BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  };

  const [deviceType, setDeviceType] = useState<DeviceType>(getDeviceType);

  useEffect(() => {
    // Use matchMedia for more efficient media query watching
    const mobileQuery = window.matchMedia(`(max-width: ${BREAKPOINTS.mobile - 1}px)`);
    const tabletQuery = window.matchMedia(`(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet - 1}px)`);

    const updateDeviceType = () => {
      setDeviceType(getDeviceType());
    };

    // Listen to both media queries
    mobileQuery.addEventListener("change", updateDeviceType);
    tabletQuery.addEventListener("change", updateDeviceType);

    // Ensure correct state on mount
    updateDeviceType();

    return () => {
      mobileQuery.removeEventListener("change", updateDeviceType);
      tabletQuery.removeEventListener("change", updateDeviceType);
    };
  }, []);

  return deviceType;
}

/**
 * Helper hooks for specific device checks
 */
export function useIsMobileDevice() {
  const deviceType = useDeviceType();
  return deviceType === 'mobile';
}

export function useIsTabletDevice() {
  const deviceType = useDeviceType();
  return deviceType === 'tablet';
}

export function useIsDesktopDevice() {
  const deviceType = useDeviceType();
  return deviceType === 'desktop';
}
