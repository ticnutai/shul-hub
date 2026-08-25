import { useEffect, useCallback } from "react";

interface KeyboardShortcutsConfig {
  onSearch?: () => void;
  onNextParsha?: () => void;
  onPrevParsha?: () => void;
  onNextPasuk?: () => void;
  onPrevPasuk?: () => void;
  enabled?: boolean;
}

/**
 * Hook for global keyboard shortcuts.
 * - Ctrl+K / Cmd+K: Open search
 * - Alt+Right: Previous parsha (RTL)
 * - Alt+Left: Next parsha (RTL)
 * - ArrowDown / J: Next pasuk
 * - ArrowUp / K: Previous pasuk
 */
export function useKeyboardShortcuts({
  onSearch,
  onNextParsha,
  onPrevParsha,
  onNextPasuk,
  onPrevPasuk,
  enabled = true,
}: KeyboardShortcutsConfig) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Ctrl+K even in inputs
        if (!(e.key === "k" && (e.ctrlKey || e.metaKey))) return;
      }

      // Ctrl+K / Cmd+K: Search
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSearch?.();
        return;
      }

      // Alt+ArrowRight: Previous parsha (RTL - right is previous)
      if (e.key === "ArrowRight" && e.altKey) {
        e.preventDefault();
        onPrevParsha?.();
        return;
      }

      // Alt+ArrowLeft: Next parsha (RTL - left is next)
      if (e.key === "ArrowLeft" && e.altKey) {
        e.preventDefault();
        onNextParsha?.();
        return;
      }

      // ArrowDown or J: Next pasuk
      if (e.key === "ArrowDown" || e.key === "j") {
        if (!e.altKey && !e.ctrlKey && !e.metaKey) {
          onNextPasuk?.();
          return;
        }
      }

      // ArrowUp or K: Previous pasuk
      if (e.key === "ArrowUp" || e.key === "k") {
        if (!e.altKey && !e.ctrlKey && !e.metaKey) {
          onPrevPasuk?.();
          return;
        }
      }
    },
    [enabled, onSearch, onNextParsha, onPrevParsha, onNextPasuk, onPrevPasuk]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
