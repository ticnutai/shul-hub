import { ArrowRight, CalendarDays, Check, Clock3, ExternalLink, MapPin, MessageCircle, Phone, ShieldAlert, Sparkles, Ticket, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import { YAMIM_NORAIM_EVENT, type EventScheduleDay } from "@/data/yamimNoraimEvent";
import { cn } from "@/lib/utils";

function ScheduleDayCard({ day }: { day: EventScheduleDay }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#dec57b]/45 bg-white/90 shadow-[0_8px_28px_rgba(16,44,87,0.08)]">
      <div className="flex items-start justify-between gap-3 border-b border-[#dec57b]/30 bg-[#fffaf0] px-4 py-3">
        <div>
          <h3 className="font-black text-[#102c57]">{day.title}</h3>
          <p className="mt-0.5 text-xs font-semibold text-[#667085]">{day.hebrewDate}</p>
        </div>
        <span className="shrink-0 rounded-full border border-[#d4aa49]/40 bg-white px-2.5 py-1 text-xs font-black text-[#9b6c0b]">{day.date}</span>
      </div>
      <div className="divide-y divide-[#102c57]/[0.07] px-4 py-1">
        {day.items.map((item) => (
          <div key={`${day.date}-${item.label}`} className={cn("flex items-center justify-between gap-4 py-2.5", item.emphasis && "text-[#9b6c0b]") }>
            <span className={cn("text-sm font-bold", item.emphasis ? "text-[#9b6c0b]" : "text-[#24395c]")}>{item.label}</span>
            <span className={cn("flex shrink-0 items-center gap-1.5 font-mono text-sm font-black tabular-nums", item.emphasis ? "text-[#b57e0e]" : "text-[#116295]") }>
              <Clock3 className="h-3.5 w-3.5" />{item.time}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
export default function YamimNoraimEvent() {
  const event = YAMIM_NORAIM_EVENT;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.address}`)}`;
  const whatsappUrl = `https://wa.me/972${event.contactPhoneRaw.slice(1)}?text=${encodeURIComponent(`שלום, אשמח לקבל פרטים על ${event.title} באולמי קונקורד`)}`;

  return (
    <main data-testid="yamim-noraim-event-page" className="min-h-screen bg-[#f7f3e8] text-[#102c57]" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b2348]/95 px-3 py-2 text-white shadow-lg backdrop-blur" style={{ paddingTop: "max(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)), 10px)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link to="/" className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4bd35]">
            <ArrowRight className="h-4 w-4" />חזרה
          </Link>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-black text-[#ffd263]">{event.title}</p>
            <p className="truncate text-[10px] text-white/60">{event.venue}</p>
          </div>
          <a href={`tel:${event.contactPhoneRaw}`} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4bd35] text-[#102c57]" aria-label={`התקשר אל ${event.contactName}`}>
            <Phone className="h-4 w-4" />
          </a>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#081d3d] via-[#123564] to-[#0b2348] px-4 pb-12 pt-10 text-white">
        <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full border-[44px] border-[#f4bd35]/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[#f4bd35]/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[#f4bd35]/35 bg-[#f4bd35]/10 px-3 py-1.5 text-xs font-bold text-[#ffe3a0]">
            <Sparkles className="h-4 w-4" />אירועי הימים הנוראים תשפ״ז
          </div>
          <h1 className="text-3xl font-black leading-tight sm:text-5xl">{event.title}</h1>
          <p className="mt-2 text-lg font-bold text-[#ffd263] sm:text-2xl">{event.subtitle}</p>
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2"><MapPin className="h-4 w-4 text-[#f4bd35]" />{event.venue} · {event.address}</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2"><CalendarDays className="h-4 w-4 text-[#f4bd35]" />{event.dateRange}</span>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-6 max-w-6xl space-y-8 px-3 pb-24 sm:px-5">
        <section className="grid gap-3 rounded-3xl border border-[#dec57b]/45 bg-white p-4 shadow-[0_18px_55px_rgba(16,44,87,0.12)] sm:grid-cols-2 sm:p-6 lg:grid-cols-4" aria-label="עיקרי האירוע">
          {event.highlights.map((highlight) => (
            <div key={highlight} className="flex items-center gap-2.5 rounded-2xl bg-[#fffaf0] p-3 text-sm font-bold text-[#24395c]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4bd35]/20 text-[#9b6c0b]"><Check className="h-4 w-4" /></span>
              {highlight}
            </div>
          ))}
        </section>

        <section aria-labelledby="rosh-hashana-heading">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#102c57] text-[#ffd263] shadow-lg"><Volume2 className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold text-[#a37415]">לוח תפילות מלא</p><h2 id="rosh-hashana-heading" className="text-2xl font-black">ראש השנה</h2></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">{event.roshHashana.map((day) => <ScheduleDayCard key={day.date} day={day} />)}</div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#d4aa49]/45 bg-[#102c57] text-white shadow-xl">
          <div className="grid items-center gap-5 p-5 sm:p-7 md:grid-cols-[1fr_auto]">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#f4bd35]/15 px-3 py-1 text-xs font-black text-[#ffd263]"><Sparkles className="h-3.5 w-3.5" />אירוע מיוחד</div>
              <h2 className="text-xl font-black sm:text-2xl">{event.selichot.title}</h2>
              <p className="mt-2 text-sm text-white/70">{event.selichot.hebrewDate} · {event.selichot.date} · {event.selichot.venue}</p>
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-[#f4bd35]/35 bg-[#f4bd35] px-6 py-4 text-2xl font-black text-[#102c57] shadow-lg"><Clock3 className="ml-2 h-6 w-6" />{event.selichot.time}</div>
          </div>
        </section>

        <section aria-labelledby="yom-kippur-heading">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#102c57] text-[#ffd263] shadow-lg"><CalendarDays className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold text-[#a37415]">כל נדרי · נעילה · צאת הצום</p><h2 id="yom-kippur-heading" className="text-2xl font-black">יום כיפור</h2></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">{event.yomKippur.map((day) => <ScheduleDayCard key={day.date} day={day} />)}</div>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-[#dec57b]/45 bg-white p-5 shadow-lg sm:p-6">
            <div className="flex items-center gap-3"><Ticket className="h-7 w-7 text-[#b57e0e]" /><div><p className="text-xs font-bold text-[#667085]">עלות מקום</p><h2 className="text-2xl font-black">כיסא ב־{event.seatPrice}</h2></div></div>
            <div className="my-5 h-px bg-gradient-to-l from-transparent via-[#d4aa49]/60 to-transparent" />
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">חשוב לדעת</p><p className="text-sm font-semibold">{event.notice}</p></div></div>
          </div>
          <div className="rounded-3xl border border-[#dec57b]/45 bg-white p-5 shadow-lg sm:p-6">
            <p className="text-xs font-bold text-[#a37415]">לפרטים ולכל נושא ביהדות</p>
            <h2 className="mt-1 text-2xl font-black">{event.contactName}</h2>
            <a href={`tel:${event.contactPhoneRaw}`} className="mt-2 block text-xl font-black text-[#116295]" dir="ltr">{event.contactPhone}</a>
            <div className="mt-5 flex items-center gap-2">
              <a href={`tel:${event.contactPhoneRaw}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#102c57] px-3 py-3 text-sm font-black text-white"><Phone className="h-4 w-4" />התקשרו</a>
              <a
                data-testid="yamim-noraim-event-whatsapp"
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[#d4aa49]/55 bg-[#f4bd35] text-[#102c57] shadow-sm transition hover:bg-[#ffd263] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4aa49]"
                aria-label={`פתח WhatsApp אל ${event.contactName} עם הודעה מוכנה`}
                title="פתיחת WhatsApp"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#dec57b]/50 bg-white shadow-xl" aria-labelledby="poster-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dec57b]/35 bg-[#fffaf0] px-4 py-4 sm:px-6">
            <div><p className="text-xs font-bold text-[#a37415]">המודעה המקורית</p><h2 id="poster-heading" className="text-xl font-black">כל המידע במקום אחד</h2></div>
            <a href={event.poster} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#d4aa49]/40 bg-white px-3 py-2 text-xs font-black text-[#102c57]"><ExternalLink className="h-4 w-4" />פתחו בגודל מלא</a>
          </div>
          <div className="bg-[#f0eadc] p-2 sm:p-5"><img src={event.poster} alt="המודעה המקורית של תפילות הימים הנוראים באולמי קונקורד" className="mx-auto h-auto w-full max-w-[720px] rounded-2xl shadow-lg" loading="lazy" /></div>
        </section>

        <section className="rounded-3xl bg-gradient-to-l from-[#102c57] to-[#0b2348] p-5 text-center text-white shadow-xl sm:p-8">
          <MapPin className="mx-auto h-8 w-8 text-[#ffd263]" />
          <h2 className="mt-2 text-2xl font-black">מחכים לכם באולמי קונקורד</h2>
          <p className="mt-1 text-sm text-white/70">{event.address}</p>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl bg-[#f4bd35] px-5 py-3 text-sm font-black text-[#102c57]"><MapPin className="h-4 w-4" />ניווט למקום</a>
        </section>
      </div>
    </main>
  );
}
