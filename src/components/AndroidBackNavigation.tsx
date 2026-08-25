import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useLocation, useNavigate } from "react-router-dom";

const DISMISSIBLE_LAYER_SELECTOR = [
  '[data-back-dismiss="true"]',
  '[role="alertdialog"]',
  '[role="dialog"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
].join(",");

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

/** Close the top-most dialog, sheet, menu or app widget before changing route. */
export function dismissTopmostUiLayer(): boolean {
  const layers = Array.from(document.querySelectorAll<HTMLElement>(DISMISSIBLE_LAYER_SELECTOR)).filter(isVisible);
  const layer = layers.at(-1);
  if (!layer) return false;

  const closeControl = layer.querySelector<HTMLElement>(
    '[data-back-dismiss-action="true"], [data-dialog-close="true"], [data-sheet-close="true"]',
  );
  if (closeControl) {
    closeControl.click();
  } else {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  }
  return true;
}

declare global {
  interface Window {
    __PASH_TEST_ANDROID_BACK__?: () => Promise<"dismissed" | "navigated" | "exit">;
  }
}

/** Central Android hardware-back policy for every app screen and overlay. */
export function AndroidBackNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleBack = async (): Promise<"dismissed" | "navigated" | "exit"> => {
      if (dismissTopmostUiLayer()) return "dismissed";

      const isCleanHome = location.pathname === "/" && !location.search && !location.hash;
      if (!isCleanHome) {
        const historyIndex = Number(window.history.state?.idx ?? 0);
        if (historyIndex > 0) navigate(-1);
        else navigate("/", { replace: true });
        return "navigated";
      }

      if (Capacitor.isNativePlatform()) await CapacitorApp.exitApp();
      return "exit";
    };

    let disposed = false;
    let removeNativeListener: (() => Promise<void>) | undefined;
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener("backButton", () => {
        void handleBack();
      }).then((handle) => {
        if (disposed) {
          void handle.remove();
          return;
        }
        removeNativeListener = () => handle.remove();
      });
    }

    if (navigator.webdriver) window.__PASH_TEST_ANDROID_BACK__ = handleBack;

    return () => {
      disposed = true;
      delete window.__PASH_TEST_ANDROID_BACK__;
      void removeNativeListener?.();
    };
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
