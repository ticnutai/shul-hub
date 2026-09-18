import { useEffect, useRef } from "react";
import type { TvConfig } from "@/tv/config";

/**
 * Carries the editor's unsaved draft to /admin/tv-board?draft=1 open in
 * another tab or window of the same browser (e.g. dragged to a second
 * monitor, or a TV connected to the laptop by HDMI). Same-origin only;
 * nothing leaves the browser and nothing is saved.
 */
export const TV_DRAFT_CHANNEL = "shul-tv-draft";

export type DraftMessage = { type: "hello" } | { type: "draft"; config: TvConfig };

/** Editor side: broadcast every change, and answer a window that just opened. */
export function useBroadcastDraft(draft: TvConfig) {
  const latest = useRef(draft);
  latest.current = draft;
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(TV_DRAFT_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (e: MessageEvent<DraftMessage>) => {
      if (e.data?.type === "hello") channel.postMessage({ type: "draft", config: latest.current } satisfies DraftMessage);
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    channelRef.current?.postMessage({ type: "draft", config: draft } satisfies DraftMessage);
  }, [draft]);
}
