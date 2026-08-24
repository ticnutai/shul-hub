import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [
        line.slice(0, separator).trim(),
        line
          .slice(separator + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      ];
    }),
);

const response = await fetch(
  `${env.VITE_SUPABASE_URL}/rest/v1/minyan_categories?select=name,subcategories&order=sort_order`,
  { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY } },
);
if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}`);
const categories = await response.json();
if (!Array.isArray(categories) || categories.length === 0) {
  throw new Error("No minyan categories were returned");
}
for (const category of categories) {
  if (!Array.isArray(category.subcategories)) {
    throw new Error(`Category ${category.name} has no subcategories array`);
  }
}
console.log(
  categories
    .map(
      (category) =>
        `${category.name}: ${category.subcategories.map((item) => item.label).join(", ") || "ללא תתי-קטגוריות"}`,
    )
    .join("\n"),
);
