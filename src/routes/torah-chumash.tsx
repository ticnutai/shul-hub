import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { TorahLibraryNav } from "@/features/torah-library/TorahLibraryNav";
import {
  chaptersOf,
  hebrewNumber,
  loadTorahBook,
  TORAH_BOOKS,
} from "@/features/torah-library/content";
import type { TorahBook, TorahVerse } from "@/features/torah-library/types";

export const Route = createFileRoute("/torah-chumash")({
  head: () => ({
    meta: [
      { title: "חומש ומפרשים — בית הכנסת אושר של יהודי" },
      { name: "description", content: "חמשת חומשי תורה, פסוקים, נושאים ומפרשים לקריאה." },
    ],
  }),
  component: ChumashPage,
});

function ChumashPage() {
  const [bookId, setBookId] = useState<(typeof TORAH_BOOKS)[number]["id"]>("bereishit");
  const [book, setBook] = useState<TorahBook | null>(null);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadTorahBook(bookId)
      .then((value) => {
        if (cancelled) return;
        setBook(value);
        setChapterNumber(chaptersOf(value)[0]?.perek_num ?? 1);
      })
      .catch(() => !cancelled && setError("לא ניתן לטעון את ספר התורה."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const chapters = useMemo(() => (book ? chaptersOf(book) : []), [book]);
  const verses = useMemo(() => {
    if (!book) return [];
    const normalized = query.trim();
    if (normalized) {
      const matches: Array<TorahVerse & { chapter: number }> = [];
      for (const chapter of chapters) {
        for (const verse of chapter.pesukim) {
          const commentary = (verse.content ?? [])
            .flatMap((topic) => [
              topic.title,
              ...topic.questions.flatMap((question) => [
                question.text,
                ...question.perushim.flatMap((answer) => [answer.mefaresh, answer.text]),
              ]),
            ])
            .join(" ");
          if (`${verse.text} ${commentary}`.includes(normalized)) {
            matches.push({ ...verse, chapter: chapter.perek_num });
            if (matches.length >= 150) return matches;
          }
        }
      }
      return matches;
    }
    return (chapters.find((chapter) => chapter.perek_num === chapterNumber)?.pesukim ?? []).map(
      (verse) => ({ ...verse, chapter: chapterNumber }),
    );
  }, [book, chapterNumber, chapters, query]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
        <header className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-gold">ספרייה תורנית</p>
            <h1 className="font-display text-3xl font-bold">חומש ומפרשים</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              תוכן מקומי לקריאה, מיובא בצורה מבודדת מפרויקט התורה.
            </p>
          </div>
          <TorahLibraryNav active="chumash" />
        </header>

        <section className="card-elev mt-5 space-y-4 p-3 sm:p-5" aria-label="בחירת ספר ופרק">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
            <label className="grid gap-1 text-sm font-medium">
              ספר
              <select
                aria-label="בחירת ספר"
                value={bookId}
                onChange={(event) => setBookId(event.target.value as typeof bookId)}
                className="h-11 rounded-lg border border-input bg-background px-3"
              >
                {TORAH_BOOKS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              פרק
              <select
                aria-label="בחירת פרק"
                value={chapterNumber}
                onChange={(event) => setChapterNumber(Number(event.target.value))}
                className="h-11 rounded-lg border border-input bg-background px-3"
                disabled={loading || Boolean(query)}
              >
                {chapters.map((chapter) => (
                  <option key={chapter.perek_num} value={chapter.perek_num}>
                    פרק {hebrewNumber(chapter.perek_num)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              חיפוש בספר
              <span className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="חיפוש בחומש ובמפרשים"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pr-9"
                  placeholder="פסוק, נושא או מפרש"
                />
              </span>
            </label>
          </div>
        </section>

        {loading && <p className="mt-8 text-center text-muted-foreground">טוען את הספר…</p>}
        {error && <p className="mt-8 text-center text-destructive">{error}</p>}
        {!loading && !error && (
          <section className="mt-5 space-y-3" aria-live="polite">
            <h2 className="font-display text-2xl font-bold">
              {book?.sefer_name} ·{" "}
              {query ? `תוצאות חיפוש (${verses.length})` : `פרק ${hebrewNumber(chapterNumber)}`}
            </h2>
            {verses.map((verse) => (
              <article key={`${verse.chapter}-${verse.id}`} className="card-elev p-4 sm:p-5">
                <p className="font-display text-xl leading-[2] sm:text-2xl">
                  <span className="ml-2 text-sm font-bold text-gold">
                    {query && `פרק ${hebrewNumber(verse.chapter)} · `}
                    {hebrewNumber(verse.pasuk_num)}
                  </span>
                  {verse.text}
                </p>
                {(verse.content ?? []).map((topic) => (
                  <details
                    key={topic.id}
                    className="mt-3 rounded-xl border border-border bg-muted/35 p-3"
                  >
                    <summary className="cursor-pointer font-semibold">{topic.title}</summary>
                    <div className="mt-3 space-y-3">
                      {topic.questions.map((question) => (
                        <section key={question.id} className="rounded-lg bg-card p-3">
                          <h3 className="font-semibold">{question.text}</h3>
                          <div className="mt-2 space-y-2">
                            {question.perushim.map((answer) => (
                              <div key={answer.id} className="border-r-2 border-gold pr-3">
                                <p className="font-bold">{answer.mefaresh}</p>
                                <p className="mt-1 leading-7">{answer.text}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </details>
                ))}
              </article>
            ))}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
