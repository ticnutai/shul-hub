import { useRef } from "react";
import { Copy, Download, Globe2, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const QR_TARGETS = [
  {
    id: "website",
    title: "אתר בית הכנסת",
    url: "https://shul-hub.lovable.app",
    Icon: Globe2,
  },
  {
    id: "android-app",
    title: "האפליקציה ב־Google Play",
    url: "https://play.google.com/store/apps/details?id=com.ticnutai.bsr3synagogue",
    Icon: Smartphone,
  },
] as const;

function QrCard({ target }: { target: (typeof QR_TARGETS)[number] }) {
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
          <Download className="size-4" /> הורדת QR
        </Button>
      </div>
    </article>
  );
}

export function QrCodesAdmin() {
  return (
    <section dir="rtl" className="space-y-4 text-right">
      <div>
        <h2 className="text-2xl font-semibold">קודי QR</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          סריקה מהטלפון תפתח ישירות את האתר או את דף האפליקציה ב־Google Play.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {QR_TARGETS.map((target) => (
          <QrCard key={target.id} target={target} />
        ))}
      </div>
    </section>
  );
}
