import { useEffect, useMemo, useState } from "react";
import { Maximize2, Smartphone, X } from "lucide-react";

const PREVIEW_QUERY_KEY = "dev-mobile-preview";
const DEVICE_WIDTH = 376;
const DEVICE_HEIGHT = 796;

const getPreviewScale = () => {
  const availableWidth = Math.max(80, window.innerWidth - 16);
  const availableHeight = Math.max(160, window.innerHeight - 118);
  return Math.min(1, availableWidth / DEVICE_WIDTH, availableHeight / DEVICE_HEIGHT);
};

export function DevMobilePreview() {
  const [open, setOpen] = useState(false);
  const [previewScale, setPreviewScale] = useState(getPreviewScale);
  const isPreviewFrame = new URLSearchParams(window.location.search).get(PREVIEW_QUERY_KEY) === "frame";

  const previewUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set(PREVIEW_QUERY_KEY, "frame");
    return `${url.pathname}${url.search}${url.hash}`;
  }, []);

  useEffect(() => {
    const updateScale = () => setPreviewScale(getPreviewScale());
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  if (isPreviewFrame) return null;

  return (
    <>
      <button
        type="button"
        data-testid="dev-galaxy-preview-trigger"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-[9000] flex h-11 items-center gap-2 rounded-full border border-amber-400/70 bg-slate-950 px-3 text-sm font-bold text-amber-300 shadow-2xl transition hover:bg-slate-900"
        title="תצוגת פיתוח של Galaxy S25"
      >
        <Smartphone className="h-4 w-4" />
        <span>Galaxy S25</span>
      </button>

      {open && (
        <div
          data-testid="dev-galaxy-preview"
          className="fixed inset-0 z-[10000] flex flex-col items-center overflow-auto bg-slate-950/95 p-3 text-white backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="תצוגת Galaxy S25"
        >
          <div className="mb-3 flex w-full max-w-[430px] items-center justify-between gap-3" dir="rtl">
            <div>
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Smartphone className="h-5 w-5" />
                Galaxy S25
              </div>
              <p className="text-xs text-slate-300">תצוגת פיתוח · ‎360 × 780 CSS pixels</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20"
              aria-label="סגור תצוגת מובייל"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            data-testid="dev-galaxy-preview-scale-slot"
            className="relative shrink-0"
            style={{ width: DEVICE_WIDTH * previewScale, height: DEVICE_HEIGHT * previewScale }}
          >
            <div
              data-testid="dev-galaxy-preview-device"
              className="absolute left-0 top-0 h-[796px] w-[376px] rounded-[34px] border-[8px] border-slate-800 bg-black p-1 shadow-2xl"
              style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}
            >
              <div className="relative h-[780px] w-[360px] overflow-hidden rounded-[24px] bg-white">
                <iframe
                  title="Galaxy S25 mobile preview"
                  src={previewUrl}
                  className="h-full w-full border-0 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400" dir="rtl">
            <Maximize2 className="h-3.5 w-3.5" />
            אפשר ללחוץ, לגלול ולבדוק את האפליקציה בתוך המסגרת
          </div>
        </div>
      )}
    </>
  );
}
