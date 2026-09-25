import { Download, Smartphone, Tv } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

/**
 * "אפליקציות": the installers, one tap away.
 *
 * The files live in the repository's GitHub release (made by
 * .github/workflows/release-apps.yml), and the links point at
 * releases/latest, so a new release shows up here without touching this page.
 * GitHub on purpose, not this site: a phone with the site installed as an app
 * opens anything on this domain in the app, and never downloaded the file.
 */

const REPO = "https://github.com/ticnutai/shul-hub";
const latest = (file: string) => `${REPO}/releases/latest/download/${file}`;

const APPS = [
  {
    key: "phone",
    icon: Smartphone,
    title: "אפליקציה לטלפון (אנדרואיד)",
    file: "shul-hub-phone.apk",
    short: "",
    steps: [
      "לוחצים על \"הורדה\" בטלפון, או סורקים את הקוד מהמחשב.",
      "כשההורדה מסתיימת, פותחים את הקובץ ומאשרים התקנה.",
      "אם הטלפון שואל - מאשרים לדפדפן להתקין אפליקציות ממקור לא ידוע.",
      "מותקנת בשם \"אושר של יהודי - גרסה חדשה\", לצד הגרסה מ-Play.",
    ],
  },
  {
    key: "tv",
    icon: Tv,
    title: "לוח תצוגה לטלוויזיה (Android TV)",
    file: "shul-hub-tv.apk",
    short: "shul-hub.lovable.app/tv.apk",
    steps: [
      "בטלוויזיה: מתקינים את Downloader מחנות Google Play.",
      "ב-Downloader מקלידים את הכתובת הקצרה שלמטה, ומתקינים.",
      "אם מותקנת גרסה ישנה של הלוח - מסירים אותה קודם.",
      "פותחים את הלוח ומצמדים אותו בלשונית \"תצוגות\" עם הקוד שעל המסך.",
    ],
  },
] as const;

export function AppDownloadsAdmin() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        קבצי ההתקנה העדכניים. ההורדה היא מ-GitHub, כדי שהטלפון יוריד את הקובץ ולא יפתח את האתר.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {APPS.map((app) => {
          const url = latest(app.file);
          const Icon = app.icon;
          return (
            <section key={app.key} className="card-elev space-y-3 p-5" aria-label={app.title}>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <Icon className="size-5 text-primary" /> {app.title}
              </h3>
              <div className="flex flex-wrap items-start gap-4">
                <div className="rounded-lg bg-white p-2">
                  <QRCodeSVG value={url} size={132} level="M" marginSize={1} title={`הורדה: ${app.title}`} />
                </div>
                <ol className="min-w-0 flex-1 list-decimal space-y-1 pr-4 text-sm">
                  {app.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild>
                  <a href={url} rel="noopener" data-testid={`download-${app.key}`}>
                    <Download className="size-4" /> הורדה
                  </a>
                </Button>
                {app.short && (
                  <span className="text-sm">
                    כתובת קצרה: <bdi className="font-mono">{app.short}</bdi>
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
