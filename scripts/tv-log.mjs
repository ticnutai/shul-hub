/** The last events every screen reported, newest first. */
import { signIn, rows } from "./lib/admin.mjs";

const headers = await signIn();

const limit = Number(process.argv[2] ?? 30);
const [events, devices] = await Promise.all([
  rows(headers, `tv_events?select=occurred_at,level,kind,message,device_id&order=occurred_at.desc&limit=${limit}`),
  rows(headers, "tv_devices?select=id,name"),
]);
const nameOf = (id) => devices.find((d) => d.id === id)?.name ?? "?";
for (const e of events) {
  const when = new Date(e.occurred_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  console.log(`${when}  ${String(nameOf(e.device_id)).padEnd(14)} ${e.level.padEnd(5)} ${e.kind.padEnd(10)} ${String(e.message).slice(0, 70)}`);
}
