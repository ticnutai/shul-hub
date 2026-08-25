type DebugDetails = Record<string, unknown>;

function nowStamp() {
  const date = new Date();
  const time = date.toLocaleTimeString("he-IL", { hour12: false });
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${time}.${ms}`;
}

export function logInteraction(scope: string, event: string, details?: DebugDetails) {
  if (typeof window === "undefined") return;
  if (import.meta.env.PROD) return;

  const payload = {
    t: nowStamp(),
    scope,
    event,
    ...(details ?? {}),
  };

  console.log(`[UI-DEBUG] ${JSON.stringify(payload)}`);
}
