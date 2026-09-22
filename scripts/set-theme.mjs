/**
 * Changes the board's theme, from here.
 *
 * One field, read-modify-write, so nothing else in the config is touched -
 * the saved themes, the gradients, the wording and the hidden elements all
 * stay exactly as they were. Prints what it changed from, so putting it
 * back is a matter of running it again with the old value.
 */
import { url, signIn, rows } from "./lib/admin.mjs";

const theme = process.argv[2];
if (!theme) {
  console.error('usage: node scripts/set-theme.mjs <theme-id>   (navy, stone, shabbat, gold, ...)');
  process.exit(2);
}

const headers = await signIn({ json: true });

const configs = await rows(headers, "tv_config?select=community_id,config");
const live = configs.find((r) => Object.keys(r.config ?? {}).length > 3) ?? configs[0];
const was = live.config.theme;
if (was === theme) { console.log(`already "${theme}" - nothing to do`); process.exit(0); }

const res = await fetch(`${url}/rest/v1/tv_config?community_id=eq.${live.community_id}`, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ config: { ...live.config, theme }, updated_at: new Date().toISOString() }),
});
if (!res.ok) { console.error("update failed:", await res.text()); process.exit(1); }

const [after] = await res.json();
console.log(`theme: "${was}" -> "${after.config.theme}"`);
console.log(`to put it back:  node scripts/set-theme.mjs ${was}`);
console.log("the screens pick it up on their own within a minute.");
