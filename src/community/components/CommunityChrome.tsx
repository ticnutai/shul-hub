import { Link, NavLink } from "react-router-dom";
import { BookOpen, House, LogIn, Megaphone, MessageCircle, ShieldCheck, UserRound, Users } from "lucide-react";
import { useSettings } from "@community/lib/data";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@community/components/NotificationCenter";
import { ReminderEngine } from "@community/components/ReminderEngine";
import { PrimaryDestinationNav } from "@/components/PrimaryDestinationNav";
import { AdminAiShortcut } from "./AdminAiShortcut";
import { readLogos } from "@community/lib/logos";
import { useAccount } from "@community/lib/use-account";

function boundedDimension(value: number | null | undefined, fallback: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? Number(value) : fallback));
}

const communityLinks = [
  { to: "/community/shiurim", label: "שיעורים", icon: BookOpen },
  { to: "/community/chavrutot", label: "חברותות", icon: Users },
  { to: "/community/announcements", label: "מודעות", icon: Megaphone },
];

const navItemClass = (isActive: boolean) =>
  cn(
    "community-nav-item flex min-w-0 items-center justify-center gap-1 rounded-lg text-center font-semibold leading-tight transition sm:gap-1.5 sm:px-3",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-primary/80"
      : "text-sidebar-primary hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  );

export function GlobalAppHeader() {
  const { data: settings } = useSettings();
  const showKarovimLogo = settings?.home_header_variant === "karovim_logo";
  // One of the synagogue's own logos when it chose one (SiteHeaderAdmin),
  // otherwise the built-in קרובים logo - which is what logo mode always was.
  const withLogos = settings as { logos?: unknown; header_logo?: string | null } | null | undefined;
  const ownLogo = readLogos(withLogos?.logos).find((l) => l.id === withLogos?.header_logo) ?? null;
  const karovimLogoDimensions = {
    "--karovim-logo-mobile-width": `${boundedDimension(settings?.karovim_logo_mobile_width, 230, 140, 360)}px`,
    "--karovim-logo-mobile-height": `${boundedDimension(settings?.karovim_logo_mobile_height, 130, 70, 240)}px`,
    "--karovim-logo-mobile-offset-x": `${boundedDimension(settings?.karovim_logo_mobile_offset_x, 0, -120, 120)}px`,
    "--karovim-logo-mobile-offset-y": `${boundedDimension(settings?.karovim_logo_mobile_offset_y, 0, -80, 80)}px`,
    "--karovim-logo-desktop-width": `${boundedDimension(settings?.karovim_logo_desktop_width, 480, 240, 720)}px`,
    "--karovim-logo-desktop-height": `${boundedDimension(settings?.karovim_logo_desktop_height, 270, 120, 420)}px`,
    "--karovim-logo-desktop-offset-x": `${boundedDimension(settings?.karovim_logo_desktop_offset_x, 0, -240, 240)}px`,
    "--karovim-logo-desktop-offset-y": `${boundedDimension(settings?.karovim_logo_desktop_offset_y, 0, -120, 120)}px`,
  } as React.CSSProperties;
  return (
    <header
      data-testid="global-app-header"
      data-theme-header
      dir="rtl"
      className="community-header sticky top-0 z-50 border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg"
      style={{ paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))" }}
    >
      <div
        className={cn(
          "mx-auto max-w-7xl items-center px-3 py-3 sm:px-5",
          showKarovimLogo
            ? "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-y-2 sm:gap-y-0"
            // Three columns on a phone, the outer two equal, so the name sits
            // on the middle of the line itself. A centred flex child is only
            // centred within what is left over, and what is left over is not
            // symmetrical - "ב״ה" on one side and an icon on the other are
            // never the same width, so the name always sat slightly off.
            : "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-2 sm:flex sm:gap-3",
        )}
      >
        <span
          data-testid="community-header-blessing"
          className="col-start-1 row-start-1 shrink-0 justify-self-start text-sm font-bold text-sidebar-primary"
        >
          ב״ה
        </span>
        <Link
          to="/community"
          className={cn(
            "min-w-0 text-center",
            showKarovimLogo
              ? "col-span-3 col-start-1 row-start-2 justify-self-center sm:col-span-1 sm:col-start-2 sm:row-start-1"
              // On a phone the side columns hold "ב״ה" and two round buttons; the
              // name and address never run under them.
              : "col-start-2 row-start-1 max-w-[calc(100vw-9.5rem)] justify-self-center sm:max-w-none sm:flex-1 sm:text-right",
          )}
        >
          {showKarovimLogo ? (
            <img
              data-testid="community-karovim-logo"
              src={ownLogo?.url ?? "/karovim-logo-v2.png"}
              alt={ownLogo ? settings?.name ?? ownLogo.name : "קרובים – להיות קרוב זה יהודי"}
              className="community-karovim-logo mx-auto object-contain"
              style={karovimLogoDimensions}
            />
          ) : (
            <>
              {/* Until the settings arrive: a neutral name and an empty address line
                  that keeps its height. The defaults were one synagogue's own name
                  and address - shown for a moment on every synagogue's site, and
                  long enough to wrap on a narrow phone, so the bar jumped. */}
              <strong data-testid="community-site-title" className="block whitespace-normal text-base font-bold leading-tight sm:text-xl">{settings?.name ?? "בית הכנסת"}</strong>
              <span data-testid="community-site-address" className="block truncate text-xs text-sidebar-foreground/65 sm:text-sm">{settings ? (settings.address ?? "") || " " : " "}</span>
            </>
          )}
        </Link>
        <div
          data-testid="community-header-actions"
          /* The account, by name, and the bell. The account stood in the
             corner at the foot of the page as a nameless icon; nobody found
             it, and nobody could tell from it who was signed in. */
          className="col-start-3 row-start-1 flex shrink-0 items-center justify-self-end gap-1"
        >
          <AccountChip />
          <NotificationCenter />
          <ReminderEngine />
        </div>
      </div>
      <PrimaryDestinationNav className="mx-auto mb-2 mt-2 max-w-md px-2 sm:mb-2.5 sm:mt-2.5" />
    </header>
  );
}

/**
 * One door, with a name on it. A signed-in member sees their own name and
 * what they are here ("חבר רשום" / "גבאי"), and a click opens their place: a
 * member's area with everything they sent the gabbai, or the admin with
 * everything in it. A guest sees "כניסה".
 */
function AccountChip() {
  const account = useAccount();
  const gabbai = account.role === "gabbai";
  return (
    <Link
      to={account.href}
      data-testid="account-entry"
      data-role={account.role}
      title={account.signedIn ? `${account.name} · ${account.roleLabel}` : "כניסה או הרשמה"}
      aria-label={!account.signedIn ? "כניסה או הרשמה למערכת" : gabbai ? `${account.name}, גבאי - ניהול בית הכנסת` : `${account.name} - האזור האישי`}
      className={cn(
        // On a phone, a round badge with the first letter: the name and the
        // address of the shul take the line, and the full name is a tap away.
        "relative flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-full border text-xs leading-none transition sm:size-auto sm:max-w-[13rem] sm:px-2 sm:py-1 sm:text-sm",
        account.signedIn
          ? "border-sidebar-primary/50 bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent"
          : "border-white/15 text-white/70 hover:bg-white/10 hover:text-amber-300",
      )}
    >
      {!account.signedIn ? (
        <>
          <LogIn className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">כניסה</span>
        </>
      ) : (
        <>
          <span aria-hidden="true" className="text-sm font-bold sm:hidden">
            {account.name.slice(0, 1).toUpperCase()}
          </span>
          {gabbai && (
            <ShieldCheck
              className="absolute -bottom-1 -left-1 size-3.5 rounded-full bg-sidebar text-sidebar-primary sm:static sm:size-4 sm:bg-transparent"
              aria-hidden="true"
            />
          )}
          {!gabbai && <UserRound className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />}
          <span className="sr-only sm:not-sr-only sm:flex sm:min-w-0 sm:flex-col sm:items-start sm:text-right">
            <span data-testid="account-name" className="max-w-full truncate font-semibold">
              {account.name}
            </span>
            <span data-testid="account-role" className="text-[10px] text-sidebar-foreground/70">
              {account.roleLabel}
            </span>
          </span>
        </>
      )}
    </Link>
  );
}

/** Contextual navigation shown only inside the synagogue section. */
export function CommunityHeader() {
  return (
    <div dir="rtl" className="community-secondary-shell bg-sidebar text-sidebar-foreground">
      <nav className="community-nav-shell community-secondary-nav mx-auto grid grid-cols-3 gap-1" aria-label="ניווט קהילתי">
        {communityLinks.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => navItemClass(isActive)}>
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function CommunityFooter() {
  const { data: settings } = useSettings();
  const contactPhone = settings?.phone ?? "054-647-3461";
  const contactPhoneDigits = contactPhone.replace(/\D/g, "");
  const whatsappPhone = contactPhoneDigits.startsWith("0")
    ? `972${contactPhoneDigits.slice(1)}`
    : contactPhoneDigits;
  const whatsappMessage = "שלום הרב חיים אושרי, אשמח ליצור קשר בנושא יהדות.";
  return (
    <footer dir="rtl" className="mt-16 border-t border-amber-400/20 bg-[#172c57] text-white/70">
      <div
        className="relative mx-auto max-w-5xl px-4 pt-8 text-center text-sm"
        style={{ paddingBottom: "calc(3.75rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" }}
      >
        <p className="font-semibold text-white">{settings?.name ?? "בית הכנסת"}</p>
        {settings?.address && <p className="mt-1">{settings.address}</p>}
        <div
          data-testid="community-rabbi-contact"
          className="mx-auto mt-4 w-fit min-w-56 rounded-xl border border-amber-400/25 bg-white/5 px-6 py-3 shadow-sm"
        >
          <p data-testid="community-contact-topic" className="text-sm font-medium text-amber-400">לכל נושא של יהדות</p>
          <p data-testid="community-rabbi-name" className="mt-1 text-base font-semibold text-white">הרב חיים אושרי</p>
          <div className="mt-1.5 flex items-center justify-center gap-2" dir="ltr">
            <a
              data-testid="community-phone"
              className="text-sm tracking-wide text-white/80 transition hover:text-amber-300"
              href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`}
            >
              {contactPhone}
            </a>
            <a
              data-testid="community-whatsapp"
              href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMessage)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="פתיחת WhatsApp אל הרב חיים אושרי"
              title="פתיחת WhatsApp"
              className="inline-flex size-8 items-center justify-center rounded-full border border-amber-400/45 bg-amber-400/10 text-amber-300 transition hover:bg-amber-400/20 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
        <Link to="/community" className="mt-4 inline-flex items-center gap-1 text-amber-400"><House className="size-4" />חזרה לדף הקהילה</Link>
      </div>
      <AdminAiShortcut />
    </footer>
  );
}
