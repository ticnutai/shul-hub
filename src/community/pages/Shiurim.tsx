import { BookOpen, Clock, MapPin, User } from "lucide-react";
import { CommunityHeader } from "@community/components/CommunityChrome";
import { CommunityFooter } from "@community/components/CommunityChrome";
import { DAYS_HE, useShiurCategories, useShiurim } from "@community/lib/data";
import { InlineEdit } from "@community/components/InlineEdit";
import { useEditMode } from "@community/lib/edit-mode";

export function ShiurimPage() {
  const { editMode } = useEditMode();
  const { data = [], isLoading } = useShiurim();
  const { data: categories = [] } = useShiurCategories();
  const active = data.filter((s) => s.active);
  const groups = [
    ...categories
      .filter((category) => category.active)
      .map((category) => ({
        ...category,
        lessons: active.filter((lesson) => lesson.category_id === category.id),
      }))
      .filter((category) => category.lessons.length > 0),
    {
      id: "uncategorized",
      name: "שיעורים נוספים",
      description: "",
      lessons: active.filter((lesson) => !lesson.category_id),
    },
  ].filter((group) => group.lessons.length > 0);

  return (
    <div className="min-h-screen">
      <CommunityHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold">שיעורי תורה</h1>
        <p className="mt-2 text-muted-foreground">שיעורים קבועים לכלל הציבור.</p>
        <div className="gold-rule mt-6 h-px w-full" />

        {isLoading && <p className="mt-8 text-muted-foreground">טוען…</p>}
        {!isLoading && active.length === 0 && (
          <p className="mt-8 text-muted-foreground">עדיין לא הוגדרו שיעורים.</p>
        )}

        <div className="mt-6 space-y-8">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`category-${group.id}`}>
              <h2 id={`category-${group.id}`} className="text-xl font-bold">
                {group.name}
              </h2>
              {group.description && (
                <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {group.lessons.map((s) => (
                  <article key={s.id} className="card-elev p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <BookOpen className="size-4" />
                      {s.schedule_type === "daily"
                        ? "בכל יום"
                        : `יום ${DAYS_HE[s.day_of_week] ?? ""}`}
                    </div>
                    <h2 className="mt-2 text-lg font-semibold">
                      <InlineEdit
                        table="shiurim"
                        id={s.id}
                        field="title"
                        value={s.title}
                        queryKey="shiurim"
                      />
                    </h2>
                    <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {(s.teacher || editMode) && (
                        <div className="flex items-center gap-2">
                          <User className="size-4" />
                          <InlineEdit
                            table="shiurim"
                            id={s.id}
                            field="teacher"
                            value={s.teacher}
                            queryKey="shiurim"
                            placeholder="שם המגיד"
                          />
                        </div>
                      )}
                      {(s.time_text || editMode) && (
                        <div className="flex items-center gap-2">
                          <Clock className="size-4" />
                          <InlineEdit
                            table="shiurim"
                            id={s.id}
                            field="time_text"
                            value={s.time_text}
                            queryKey="shiurim"
                            placeholder="שעה"
                          />
                        </div>
                      )}
                      {(s.location || editMode) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4" />
                          <InlineEdit
                            table="shiurim"
                            id={s.id}
                            field="location"
                            value={s.location}
                            queryKey="shiurim"
                            placeholder="מיקום"
                          />
                        </div>
                      )}
                    </dl>
                    {(s.description || editMode) && (
                      <p className="mt-3 text-sm">
                        <InlineEdit
                          table="shiurim"
                          id={s.id}
                          field="description"
                          value={s.description}
                          as="textarea"
                          queryKey="shiurim"
                          placeholder="תיאור"
                        />
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <CommunityFooter />
    </div>
  );
}
