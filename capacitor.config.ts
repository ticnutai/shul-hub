import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ticnutai.bsr3synagogue",
  appName: "בית כנסת בסר 3",
  webDir: ".output/public",
  server: {
    url: "https://shul-hub.lovable.app",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#14294f",
  },
};

export default config;
