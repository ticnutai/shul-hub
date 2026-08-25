/**
 * MetaSyncInitializer — runs once on login and syncs cloud user_metadata
 * (dev feature flags) to localStorage so all pages can read the correct
 * value immediately, without waiting for Settings to open.
 */
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const DEV_CHAT_ENABLED_KEY = "dev-chat-widget-enabled";
const DEV_SCREENSHOT_ENABLED_KEY = "dev-screenshot-tool-enabled";
const DEV_FLOATING_ENABLED_KEY = "dev-floating-buttons-enabled";

export const DEV_FEATURES_EVENT = "dev-features:changed";

export function MetaSyncInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
      if (!freshUser) return;
      const meta = freshUser.user_metadata ?? {};

      let devChanged = false;

      const syncDevFlag = (metaKey: string, lsKey: string) => {
        const cloudVal = meta[metaKey];
        const cloudTs = Number(meta[metaKey + "_ts"]) || 0;
        const localTs = Number(localStorage.getItem(lsKey + "-ts")) || 0;
        if (cloudVal !== true && cloudVal !== false) return;
        if (cloudTs >= localTs) {
          localStorage.setItem(lsKey, String(cloudVal));
          localStorage.setItem(lsKey + "-ts", String(cloudTs));
          devChanged = true;
        }
      };

      syncDevFlag("dev_floating_enabled", DEV_FLOATING_ENABLED_KEY);
      syncDevFlag("dev_chat_enabled", DEV_CHAT_ENABLED_KEY);
      syncDevFlag("dev_screenshot_enabled", DEV_SCREENSHOT_ENABLED_KEY);

      if (devChanged) {
        window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
      }

      // Sync FAB position (JSON object, latest-wins)
      const fabCloudTs = Number(meta["fab_position_ts"]) || 0;
      const fabLocalTs = Number(localStorage.getItem("fab_position_ts")) || 0;
      if (fabCloudTs > fabLocalTs && meta["fab_position"]) {
        try {
          const pos = typeof meta["fab_position"] === "string"
            ? JSON.parse(meta["fab_position"])
            : meta["fab_position"];
          if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
            localStorage.setItem("fab_position", JSON.stringify(pos));
            localStorage.setItem("fab_position_ts", String(fabCloudTs));
          }
        } catch { /* ignore */ }
      }

      // Sync DevChatWidget open state (boolean, latest-wins)
      const chatOpenCloudTs = Number(meta["dev_chat_open_ts"]) || 0;
      const chatOpenLocalTs = Number(localStorage.getItem("dev-chat-open-ts")) || 0;
      if (chatOpenCloudTs > chatOpenLocalTs && (meta["dev_chat_open"] === true || meta["dev_chat_open"] === false)) {
        localStorage.setItem("dev-chat-open", String(meta["dev_chat_open"]));
        localStorage.setItem("dev-chat-open-ts", String(chatOpenCloudTs));
      }

      // Sync Siddur custom theme (JSON object, latest-wins)
      const customThemeCloudTs = Number(meta["siddur_custom_theme_ts"]) || 0;
      const customThemeLocalTs = Number(localStorage.getItem("siddur-custom-theme__ts")) || 0;
      if (customThemeCloudTs > customThemeLocalTs && meta["siddur_custom_theme"]) {
        try {
          const ct = typeof meta["siddur_custom_theme"] === "string"
            ? JSON.parse(meta["siddur_custom_theme"])
            : meta["siddur_custom_theme"];
          if (ct && ct.id === "custom") {
            localStorage.setItem("siddur-custom-theme", JSON.stringify(ct));
            localStorage.setItem("siddur-custom-theme__ts", String(customThemeCloudTs));
          }
        } catch { /* ignore */ }
      }

      // Sync Siddur active theme id (latest-wins)
      const activeThemeCloudTs = Number(meta["siddur_active_theme_ts"]) || 0;
      const activeThemeLocalTs = Number(localStorage.getItem("siddur-active-theme__ts")) || 0;
      if (activeThemeCloudTs > activeThemeLocalTs && meta["siddur_active_theme_id"]) {
        localStorage.setItem("siddur-active-theme", String(meta["siddur_active_theme_id"]));
        localStorage.setItem("siddur-active-theme__ts", String(activeThemeCloudTs));
      }
    }).catch(() => {});
  }, [user?.id]);

  return null;
}
