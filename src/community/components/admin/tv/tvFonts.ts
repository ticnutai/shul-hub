import { useEffect } from "react";
import { TV_FONTS_HREF } from "@/tv/themes";

/** The TV bundles its fonts; in the site they come from Google once. */
export function useTvFonts() {
  useEffect(() => {
    if (document.querySelector("link[data-tv-fonts]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TV_FONTS_HREF;
    link.dataset.tvFonts = "true";
    document.head.appendChild(link);
  }, []);
}
