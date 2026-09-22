/** Every screen, and which synagogue it shows. */
import { signIn, rows } from "./lib/admin.mjs";

const headers = await signIn();
const devices = await rows(headers, "tv_devices?select=name,approved,app_version,last_seen_at,community_id&order=created_at");
const comms = await rows(headers, "communities?select=id,name,active");
const nameOf = (id) => comms.find((c) => c.id === id)?.name ?? "—";

const ago = (t) => (t ? `${Math.round((Date.now() - new Date(t)) / 1000)}s ago` : "never");
console.log("screen".padEnd(18), "paired".padEnd(7), "ver".padEnd(6), "seen".padEnd(10), "synagogue");
for (const d of devices) {
  console.log(
    String(d.name).padEnd(18),
    String(d.approved).padEnd(7),
    String(d.app_version ?? "-").padEnd(6),
    ago(d.last_seen_at).padEnd(10),
    nameOf(d.community_id),
  );
}
console.log("\nsynagogues:", comms.map((c) => `${c.name}${c.active ? "" : " (כבוי)"}`).join(", "));
