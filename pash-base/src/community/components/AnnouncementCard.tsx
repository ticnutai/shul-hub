import { PartyPopper, Megaphone, Flower2 } from "lucide-react";
import type { Announcement } from "@community/lib/data";
import { InlineEdit } from "@community/components/InlineEdit";
import { useEditMode } from "@community/lib/edit-mode";

export const ANNOUNCEMENT_KINDS = [
  { id: "mazal_tov", label: "מזל טוב" },
  { id: "general", label: "הודעה כללית" },
  { id: "memorial", label: "אבל / אזכרה" },
] as const;

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const { editMode } = useEditMode();
  const Icon =
    announcement.kind === "mazal_tov"
      ? PartyPopper
      : announcement.kind === "memorial"
        ? Flower2
        : Megaphone;

  const kindLabel = ANNOUNCEMENT_KINDS.find((k) => k.id === announcement.kind)?.label ?? "הודעה";

  return (
    <article className="card-elev p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{kindLabel}</span>
        {announcement.pinned && (
          <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-gold-foreground">
            מוצמד
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-semibold">
        <InlineEdit
          table="announcements"
          id={announcement.id}
          field="title"
          value={announcement.title}
          queryKey="announcements"
        />
      </h3>
      {(announcement.body || editMode) && (
        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
          <InlineEdit
            table="announcements"
            id={announcement.id}
            field="body"
            value={announcement.body}
            as="textarea"
            queryKey="announcements"
            placeholder="לחץ להוספת תוכן"
          />
        </p>
      )}
    </article>
  );
}
