/** Any screenshots the screens have stored, and when. */
import fs from "node:fs";

import { signIn, rows } from "./lib/admin.mjs";

const headers = await signIn();
const shots = await rows(headers, "tv_snapshots?select=device_id,captured_at,image");
if (shots.length === 0) { console.log("no stored screenshots"); process.exit(0); }
for (const r of shots) {
  const when = new Date(r.captured_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  const bytes = (r.image ?? "").length;
  console.log(`${when}  ${bytes} chars`);
  if (r.image?.startsWith("data:image")) {
    const f = `snap-${r.device_id.slice(0, 8)}.png`;
    fs.writeFileSync(f, Buffer.from(r.image.split(",")[1], "base64"));
    console.log(`  saved ${f}`);
  }
}
