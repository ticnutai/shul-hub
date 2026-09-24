// Builds docs/theme-packs/לוח-ערכות-נושא-חבילה-1.json: 16 themes and 12
// gradients for the TV board, in the portable design-tokens format (see
// docs/THEMES_IMPORT_EXPORT_GUIDE.md). Import it from Admin > TV > Tools.
//
// Change colours here, then run both:
//   node scripts/build-theme-pack.mjs
//   node scripts/check-theme-contrast.mjs docs/theme-packs/לוח-ערכות-נושא-חבילה-1.json
import { writeFileSync } from "node:fs";
const R = ["background","backgroundGlowTop","backgroundGlowBottom","surface","text","textMuted","accent","accentAlt","onAccent","highlight"];
const T = (name, mode, description, v) => ({ name, description, mode, roles: Object.fromEntries(R.map((r, i) => [r, v[i]])) });
export const themes = [
  T("ירושלים של זהב","dark","לילה חם וזהב - עם אבני ירושלים או היכל שיש",["#1a1510","#2b2217","#221a12","rgba(255, 236, 200, 0.05)","#f7efe1","#c9b79a","#e8b85a","#a9803a","#1a1510","#e07a4f"]),
  T("תכלת","dark","כחול עמוק ותכלת - עם נקי או מודרני",["#0a1a2f","#12305a","#0e2645","rgba(170, 210, 255, 0.06)","#eef5ff","#9db6d6","#7cc4ff","#3f86c6","#0a1a2f","#ffd166"]),
  T("שבת מלכתא","dark","בורדו וזהב לשבת - עם קטיפה מלכותית או מדליונים",["#1e0b12","#3a1522","#2a0f19","rgba(255, 220, 230, 0.05)","#fbeff2","#d4a9b5","#f2c46d","#b88a3a","#1e0b12","#ff9a6b"]),
  T("ימים נוראים","light","לבן וכסף, כחול מלכותי - עם שיש מוזהב או נקי",["#f4f5f7","#ffffff","#e6e9ee","rgba(20, 33, 61, 0.05)","#14213d","#56627a","#1f4e8c","#8a96a8","#ffffff","#9a6b00"]),
  T("סוכות","dark","ירוק לולב וזהב אתרוג - עם עץ אגוז או היכל עמודים",["#0f1f14","#1d3a24","#16301d","rgba(220, 255, 220, 0.05)","#f1f8ef","#a9c4a6","#e9c46a","#8fb86b","#0f1f14","#f4a261"]),
  T("חנוכה","dark","כחול לילה ואור נרות - עם מסגרת זהב או כיפות זהב",["#0b1030","#1b2366","#141a4d","rgba(200, 210, 255, 0.06)","#f3f5ff","#a7b0de","#ffc94d","#7c8cff","#0b1030","#ff8a3d"]),
  T("פורים","dark","סגול חגיגי וזהב - עם מדליונים",["#1a0f2e","#33205a","#261845","rgba(235, 220, 255, 0.06)","#f8f3ff","#c3b2e0","#ffd24c","#e45fb0","#1a0f2e","#4fd1c5"]),
  T("פסח","light","לבן אביבי וזהב - עם קלף או שיש מוזהב",["#fbf8f0","#ffffff","#efe8d6","rgba(60, 50, 20, 0.05)","#2b2413","#655b46","#835a0c","#4f7a3a","#ffffff","#a63a1c"]),
  T("שבועות","light","ירוק פרחוני בהיר - עם תכלת או נקי",["#f3f8f1","#ffffff","#e2eedd","rgba(20, 60, 30, 0.05)","#16301f","#4a6552","#276a35","#a8761f","#ffffff","#a8401c"]),
  T("בין המצרים","dark","אפור שקט ומאופק לימי אבל - עם נקי",["#16181b","#202328","#1b1e22","rgba(255, 255, 255, 0.04)","#e6e7e9","#9a9ea6","#c9ccd2","#7d828b","#16181b","#b8a47a"]),
  T("לילה עמוק OLED","dark","כמעט שחור, נמוך בצריבה - למסכי OLED שדולקים ימים",["#05070b","#0b1220","#080d17","rgba(255, 255, 255, 0.035)","#d9e1ec","#8a97aa","#d6a84a","#8a6d33","#05070b","#d9774a"]),
  T("אבן ירושלים בהירה","light","אבן גזית בהירה - עם אבני ירושלים או לוחות אבן",["#efe7d8","#f8f2e6","#e2d6c0","rgba(70, 50, 20, 0.06)","#2d2416","#5f523c","#7a4f10","#4d6878","#ffffff","#9a2e1c"]),
  T("ים וטורקיז","dark","טורקיז עמוק וזהב - עם מודרני או נקי",["#062126","#0c3a40","#093036","rgba(200, 255, 250, 0.05)","#eafbf9","#9cc9c4","#f4c95d","#3fb8aa","#062126","#ff8c61"]),
  T("כסף מודרני","dark","אפור גרפיט ותכלת קרה - עם מודרני",["#121417","#1c2026","#171a1f","rgba(255, 255, 255, 0.05)","#f2f4f7","#9aa3ae","#7dd3fc","#94a3b8","#0b1220","#fbbf24"]),
  T("פרוכת אדומה","dark","קטיפה אדומה וזהב - עם פרוכת או אולם קטיפה",["#2a0a0e","#4a1219","#380d13","rgba(255, 215, 160, 0.06)","#fdf2e6","#d9b8a0","#e7b75f","#b0843c","#2a0a0e","#ff8f70"]),
  T("ראש חודש","dark","כחול לילה וכסף ירח - עם עמודי שיש",["#0d1b2a","#1b263b","#152235","rgba(224, 225, 221, 0.05)","#f0f2f5","#a8b2c1","#e0e1dd","#778da9","#0d1b2a","#f2c14e"]),
];
export const gradients = [
  { name: "שקיעה ירושלמית", value: "linear-gradient(170deg, #2b2217, #1a1510 55%, #0f0b07)" },
  { name: "זהב עולה", value: "radial-gradient(circle at 50% 0%, #6b4f1d, #1a1510 65%)" },
  { name: "לילה כחול עמוק", value: "linear-gradient(160deg, #12305a, #0a1a2f 60%, #050d18)" },
  { name: "קטיפה בורדו", value: "radial-gradient(ellipse at 50% 20%, #4a1522, #1e0b12 70%)" },
  { name: "אור נרות", value: "radial-gradient(circle at 50% 100%, #5a3a10, #0b1030 60%)" },
  { name: "סוכה", value: "linear-gradient(180deg, #1d3a24, #0f1f14 70%)" },
  { name: "פורים", value: "linear-gradient(135deg, #33205a, #1a0f2e 55%, #3a1440)" },
  { name: "תכלת", value: "linear-gradient(180deg, #12305a, #0a1a2f)" },
  { name: "אבן בהירה", value: "linear-gradient(180deg, #f8f2e6, #e2d6c0)" },
  { name: "בוקר לבן", value: "radial-gradient(circle at 50% 0%, #ffffff, #e6e9ee 70%)" },
  { name: "OLED שקט", value: "linear-gradient(180deg, #0b1220, #05070b 40%)" },
  { name: "ים", value: "linear-gradient(160deg, #0c3a40, #062126 65%)" },
];
const out = process.argv[2] ?? new URL("../docs/theme-packs/לוח-ערכות-נושא-חבילה-1.json", import.meta.url);
writeFileSync(out, JSON.stringify({ format: "design-tokens", version: 1, app: "shul-hub-tv", exportedAt: "2026-09-24T12:00:00.000Z", themes, gradients }, null, 2) + "\n");
