import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { TorahLibraryNav } from "@/features/torah-library/TorahLibraryNav";
import { loadSiddur, sanitizeTorahHtml, SIDDUR_NUSACHIM } from "@/features/torah-library/content";
import type { SiddurData } from "@/features/torah-library/types";

export const Route = createFileRoute("/torah-siddur")({
  head: () => ({
    meta: [
      { title: "סידור תפילה — בית הכנסת אושר של יהודי" },
      { name: "description", content: "סידור תפילה מלא לפי נוסח וקטגוריית תפילה." },
    ],
  }),
  component: SiddurPage,
});

function SiddurPage() {
  const [nusach, setNusach] = useState<(typeof SIDDUR_NUSACHIM)[number]["id"]>("ashkenaz");
  const [data, setData] = useState<SiddurData | null>(null);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadSiddur(nusach)
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setCategory(Object.keys(value)[0] ?? "");
      })
      .catch(() => !cancelled && setError("לא ניתן לטעון את הסידור."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [nusach]);

  const categories = useMemo(() => Object.entries(data ?? {}), [data]);
  const current = data?.[category];
  const sections = useMemo(() => {
    if (!current) return [];
    const normalized = query.trim();
    if (!normalized) return current.sections;
    return current.sections.filter((section) =>
      `${section.title} ${section.lines.join(" ")}`.includes(normalized),
    );
  }, [current, query]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
        <header className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-gold">ספרייה תורנית</p>
            <h1 className="font-display text-3xl font-bold">סידור תפילה</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              נוסחי תפילה מלאים הנשמרים במכשיר לקריאה מהירה.
            </p>
          </div>
          <TorahLibraryNav active="siddur" />
        </header>

        <section className="card-elev mt-5 space-y-4 p-3 sm:p-5" aria-label="בחירת נוסח ותפילה">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium">
              נוסח
              <select
                aria-label="בחירת נוסח"
                value={nusach}
                onChange={(event) => setNusach(event.target.value as typeof nusach)}
                className="h-11 rounded-lg border border-input bg-background px-3"
              >
                {SIDDUR_NUSACHIM.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              תפילה
              <select
                aria-label="בחירת תפילה"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 rounded-lg border border-input bg-background px-3"
              >
                {categories.map(([id, value]) => (
                  <option key={id} value={id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              חיפוש בתפילה
              <Input
                aria-label="חיפוש בסידור"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="מילה או קטע"
              />
            </label>
          </div>
        </section>

        {loading && <p className="mt-8 text-center text-muted-foreground">טוען את הסידור…</p>}
        {error && <p className="mt-8 text-center text-destructive">{error}</p>}
        {!loading && !error && (
          <section className="mt-5 space-y-4" aria-live="polite">
            <h2 className="font-display text-2xl font-bold">{current?.name ?? "סידור"}</h2>
            {sections.map((section, sectionIndex) => (
              <article key={`${section.title}-${sectionIndex}`} className="card-elev p-4 sm:p-6">
                <h3 className="font-display text-xl font-bold text-primary">{section.title}</h3>
                <div className="torah-reading-text mt-3 space-y-3 font-display text-xl leading-[2.05] sm:text-2xl">
                  {section.lines.map((line, lineIndex) => (
                    <p
                      key={lineIndex}
                      dangerouslySetInnerHTML={{ __html: sanitizeTorahHtml(line) }}
                    />
                  ))}
                </div>
              </article>
            ))}
            {sections.length === 0 && (
              <p className="rounded-xl border border-border bg-card p-5 text-muted-foreground">
                לא נמצאו קטעים מתאימים.
              </p>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
