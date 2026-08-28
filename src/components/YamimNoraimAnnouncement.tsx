import { ArrowLeft, CalendarDays, MapPin, MessageCircle, Phone, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { YAMIM_NORAIM_EVENT } from "@/data/yamimNoraimEvent";

export function YamimNoraimAnnouncement() {
  const event = YAMIM_NORAIM_EVENT;
  const whatsappMessage = `שלום ${event.contactName}, אשמח לקבל פרטים ולהירשם ל${event.title} באולמי קונקורד.`;
  const whatsappUrl = `https://wa.me/972${event.contactPhoneRaw.slice(1)}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <aside
      data-testid="yamim-noraim-announcement"
      className="relative isolate overflow-hidden rounded-2xl border border-[#d4aa49]/45 bg-gradient-to-l from-[#102c57] via-[#153967] to-[#0b2348] px-3.5 py-3 text-white shadow-[0_12px_35px_rgba(11,35,72,0.18)] sm:px-5"
      dir="rtl"
      aria-label="הודעה על תפילות הימים הנוראים"
    >
      <div className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-[#f4bd35]/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 right-1/3 h-24 w-40 rounded-full bg-white/10 blur-3xl" />
      <Link
        to={`/events/${event.slug}`}
        className="relative flex min-h-[76px] items-center gap-3 rounded-xl outline-none ring-offset-2 ring-offset-background transition-transform active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[#f4bd35]"
        aria-label="פתח את כל פרטי תפילות הימים הנוראים"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#f4bd35]/45 bg-[#f4bd35]/15 text-[#ffd263] shadow-inner">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#f4bd35] px-2 py-0.5 text-[10px] font-black tracking-wide text-[#102c57]">אירוע מיוחד</span>
            <span className="text-[11px] font-semibold text-[#ffe3a0]">ראש השנה ויום כיפור</span>
          </div>
          <h2 className="truncate text-sm font-black sm:text-base">{event.title} באולמי קונקורד</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/75 sm:text-xs">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-[#f4bd35]" />{event.dateRange}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-[#f4bd35]" />{event.address}</span>
          </div>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[#ffd263]" aria-hidden="true">
          <ArrowLeft className="h-4 w-4" />
        </span>
      </Link>
      <div className="relative mt-2 flex items-center justify-between gap-2 border-t border-white/15 pt-2">
        <a
          href={`tel:${event.contactPhoneRaw}`}
          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-bold text-white/85 transition-colors hover:text-white focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4bd35]"
          aria-label={`התקשר אל ${event.contactName} במספר ${event.contactPhone}`}
        >
          <Phone className="h-3.5 w-3.5 shrink-0 text-[#f4bd35]" aria-hidden="true" />
          <span>{event.contactName}</span>
          <bdi className="whitespace-nowrap" dir="ltr">{event.contactPhone}</bdi>
        </a>
        <a
          data-testid="yamim-noraim-whatsapp"
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#63d596]/50 bg-[#168c55] px-3 text-xs font-black text-white shadow-sm transition hover:bg-[#117747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9af0bf]"
          aria-label={`פתח WhatsApp אל ${event.contactName} עם הודעה מוכנה`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          WhatsApp
        </a>
      </div>
    </aside>
  );
}
