import { useEffect, useRef } from "react";
import type { TvConfig } from "@/tv/config";

/**
 * Keeps the editor's unsaved draft in step between the tabs and windows of
 * one browser: the editor on the admin page and the live editor window
 * (/admin/tv-board?draft=1), which may sit on a second monitor or on a TV
 * connected to the laptop by HDMI. Same-origin only; nothing leaves the
 * browser and nothing is saved.
 *
 * Every editor both sends and receives. `editedAt` is the time of the last
 * edit the draft carries (0 = untouched since load), and a draft is adopted
 * only when it is newer than one's own - so a window that just opened, with
 * the saved design, never overwrites unsaved work in the other one, while
 * each edit made anywhere shows everywhere.
 */
export const TV_DRAFT_CHANNEL = "shul-tv-draft";

export type DraftMessage =
  | { type: "hello" }
  | { type: "draft"; config: TvConfig; editedAt: number }
  /** A window saved: the others refresh their "saved" copy. */
  | { type: "saved" };

export function useDraftSync(
  draft: TvConfig,
  editedAt: number,
  handlers: {
    onRemoteDraft?: (config: TvConfig, editedAt: number) => void;
    onSaved?: () => void;
  } = {},
) {
  const latest = useRef({ draft, editedAt });
  latest.current = { draft, editedAt };
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(TV_DRAFT_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (e: MessageEvent<DraftMessage>) => {
      const msg = e.data;
      if (msg?.type === "hello") {
        channel.postMessage({
          type: "draft",
          config: latest.current.draft,
          editedAt: latest.current.editedAt,
        } satisfies DraftMessage);
      } else if (msg?.type === "draft") {
        const at = typeof msg.editedAt === "number" ? msg.editedAt : 0;
        if (at > latest.current.editedAt) handlersRef.current.onRemoteDraft?.(msg.config, at);
      } else if (msg?.type === "saved") {
        handlersRef.current.onSaved?.();
      }
    };
    channel.postMessage({ type: "hello" } satisfies DraftMessage);
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    channelRef.current?.postMessage({
      type: "draft",
      config: draft,
      editedAt,
    } satisfies DraftMessage);
  }, [draft, editedAt]);

  return {
    announceSaved: () => channelRef.current?.postMessage({ type: "saved" } satisfies DraftMessage),
  };
}
