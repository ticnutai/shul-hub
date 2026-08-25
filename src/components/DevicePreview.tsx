import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";

type DeviceType = "desktop" | "mobile" | "tablet";

export const DevicePreview = () => {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all device classes
    root.classList.remove("device-desktop", "device-mobile", "device-tablet");
    
    // Add current device class
    root.classList.add(`device-${deviceType}`);
    
    // Set CSS custom properties for width
    switch (deviceType) {
      case "mobile":
        root.style.setProperty("--preview-max-width", "375px");
        break;
      case "tablet":
        root.style.setProperty("--preview-max-width", "768px");
        break;
      case "desktop":
        root.style.setProperty("--preview-max-width", "100%");
        break;
    }
  }, [deviceType]);

  const devices = [
    { type: "desktop" as DeviceType, label: "דסקטופ", icon: Monitor, width: "100%" },
    { type: "tablet" as DeviceType, label: "טאבלט", icon: Tablet, width: "768px" },
    { type: "mobile" as DeviceType, label: "נייד", icon: Smartphone, width: "375px" },
  ];

  const currentDevice = devices.find(d => d.type === deviceType) || devices[0];
  const CurrentIcon = currentDevice.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="תצוגת מכשירים"
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-right">תצוגת מכשירים</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {devices.map((device) => {
          const Icon = device.icon;
          return (
            <DropdownMenuItem
              key={device.type}
              onClick={() => setDeviceType(device.type)}
              className={`text-right cursor-pointer ${
                deviceType === device.type ? "bg-accent" : ""
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs text-muted-foreground">{device.width}</span>
                <div className="flex items-center gap-2">
                  <span>{device.label}</span>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
