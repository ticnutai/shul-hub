import { PartyPopper, Megaphone, Flower2 } from "lucide-react";
import type { Announcement } from "@community/lib/data";
import { InlineEdit } from "@community/components/InlineEdit";
import { useEditMode } from "@community/lib/edit-mode";
import { announcementCardStyle, normalizeAnnouncementStyle } from "@community/lib/announcement-style";
import { ANNOUNCEMENT_KINDS } from "@community/lib/announcement-kinds";

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const { editMode } = useEditMode();
  const presentation = normalizeAnnouncementStyle(announcement.style);
  const Icon =
    announcement.kind === "mazal_tov"
      ? PartyPopper
      : announcement.kind === "memorial"
        ? Flower2
        : Megaphone;

  const kindLabel = ANNOUNCEMENT_KINDS.find((k) => k.id === announcement.kind)?.label ?? "הודעה";

  return (
    <article
      className="card-elev h-full overflow-hidden border transition-shadow"
      style={announcementCardStyle(announcement.style)}
      data-announcement-preset={presentation.preset}
    >
      {announcement.image_url && (
        <img
          src={announcement.image_url}
          alt={`תמונה עבור ${announcement.title}`}
          className="aspect-[16/9] w-full object-cover"
          loading="lazy"
          data-testid="announcement-image"
        />
      )}
      <div className="p-4">
      <div className={`flex items-center gap-2 ${presentation.align === "center" ? "justify-center" : ""}`}>
        <span
          className="grid size-8 place-items-center rounded-full"
          style={{ backgroundColor: `${presentation.accent}22`, color: presentation.accent }}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-xs font-medium opacity-70">{kindLabel}</span>
        {announcement.pinned && (
          <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-medium text-gold-foreground">
            מוצמד
          </span>
        )}
      </div>
      <h3 className="mt-3 font-semibold" style={{ fontSize: presentation.titleSize }}>
        <InlineEdit
          table="announcements"
          id={announcement.id}
          field="title"
          value={announcement.title}
          queryKey="announcements"
        />
      </h3>
      {(announcement.body || editMode) && (
        <p className="mt-1 whitespace-pre-line opacity-75" style={{ fontSize: presentation.bodySize }}>
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
      </div>
    </article>
  );
}
