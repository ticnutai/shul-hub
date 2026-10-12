import { useRef } from "react";
import { Copy, Download, Globe2, Smartphone, type LucideIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCommunity } from "@/community/lib/community";

/** The published site, for when this page runs where its own address is no use to a phone (the app, a computer at home). */
const PUBLIC_SITE = "https://shul-hub.lovable.app";

/**
 * This synagogue's own page: the address the site is open on now, and the
 * synagogue in it (?shul=), so a code printed for one synagogue never opens
 * another. It was one fixed address for every synagogue.
 */
export function synagogueSiteUrl(slug: string | undefined): string {
  const { protocol, hostname, origin } = window.location;
  const local = !protocol.startsWith("http") || hostname === "localhost" || hostname === "127.0.0.1";
  const base = local ? PUBLIC_SITE : origin;
  return slug ? `${base}/community?shul=${encodeURIComponent(slug)}` : `${base}/community`;
}

type QrTarget = { id: string; title: string; url: string; Icon: LucideIcon };

function QrCard({ target }: { target: QrTarget }) {
  const containerRef = useRef<HTMLDivElement>(null);

  function downloadSvg() {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    const content = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shul-hub-${target.id}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(target.url);
    toast.success("הכתובת הועתקה");
  }

  return (
    <article
      className="card-elev flex flex-col items-center gap-4 p-5 text-center"
      data-testid={`qr-${target.id}`}
    >
      <div className="flex items-center gap-2 text-lg font-semibold">
        <target.Icon className="size-5 text-primary" />
        <h3>{target.title}</h3>
      </div>
      <div ref={containerRef} className="rounded-xl bg-white p-4 shadow-soft">
        <QRCodeSVG value={target.url} size={220} level="H" marginSize={1} title={target.title} />
      </div>
      <p dir="ltr" className="max-w-full break-all text-xs text-muted-foreground">
        {target.url}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" onClick={() => void copyUrl()}>
          <Copy className="size-4" /> העתקת כתובת
        </Button>
        <Button type="button" onClick={downloadSvg}>
          <Download className="size-4" /> הורדת הקוד
        </Button>
      </div>
    </article>
  );
}

export function QrCodesAdmin() {
  const shul = useCommunity();
  const targets: QrTarget[] = [
    { id: "website", title: shul?.name ? `האתר של ${shul.name}` : "אתר בית הכנסת", url: synagogueSiteUrl(shul?.slug), Icon: Globe2 },
    {
      id: "android-app",
      title: "האפליקציה בחנות של גוגל",
      url: "https://play.google.com/store/apps/details?id=com.ticnutai.bsr3synagogue",
      Icon: Smartphone,
    },
  ];
  return (
    <section dir="rtl" className="space-y-4 text-right" data-testid="qr-codes">
      {/* No heading of its own: the section's name is on its tab or tile, as for every section. */}
      <p className="text-sm text-muted-foreground">
        קודים להדפסה ולתלייה: סריקה מהטלפון תפתח ישירות את האתר של בית הכנסת, או את דף האפליקציה בחנות של גוגל.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {targets.map((target) => (
          <QrCard key={target.id} target={target} />
        ))}
      </div>
    </section>
  );
}
