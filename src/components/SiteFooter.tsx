import { useSettings } from "@/lib/data";

export function SiteFooter() {
  const { data: settings } = useSettings();
  return (
    <footer className="mt-16 border-t border-border bg-muted/40">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{settings?.name ?? "בית הכנסת"}</p>
        <p className="mt-1">{settings?.address}</p>
        {settings?.phone ? <p className="mt-1">טלפון: {settings.phone}</p> : null}
        <p className="mt-4 text-xs">
          הזמנים מחושבים אוטומטית לפי מיקום בית הכנסת. יש לוודא מול לוח הזמנים המקומי.
        </p>
      </div>
    </footer>
  );
}
