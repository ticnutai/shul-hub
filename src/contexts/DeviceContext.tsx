import { createContext, useContext, useMemo, ReactNode } from "react";
import { useDeviceType, DeviceType } from "@/hooks/useDeviceType";

interface DeviceContextValue {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const DeviceContext = createContext<DeviceContextValue | undefined>(undefined);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const deviceType = useDeviceType();

  const value = useMemo<DeviceContextValue>(() => ({
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
  }), [deviceType]);

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error("useDevice must be used within DeviceProvider");
  }
  return context;
}
