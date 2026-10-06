import { useState } from 'react';
import { getFontEmbedCSS, toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { TvConfig } from '@/tv/config';
import { downloadFile, exportWorkspace, importWorkspace, exportAppearance, applyAppearance, type StoreImage } from '@/tv/workspaceTransfer';
import { uploadTvImage } from './tvAdminData';

/** A picture from a package, into the synagogue's picture storage (transparency kept). */
const storeImage: StoreImage = async (blob, type) => {
  const ext = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1];
  return (await uploadTvImage(new File([blob], `imported.${ext}`, { type }))).url;
};

/**
 * Moving a board, or only its look, between synagogues and back: one file
 * (ZIP) with the settings, the parts and every picture in it. An import is a
 * draft first - the look alone over this board's content, or the whole board -
 * and is broadcast only when saved. A picture of the board, for print or
 * WhatsApp, is a separate export.
 */
export function WorkspaceTransfer({ config, onImport }: { config: TvConfig; onImport: (c: TvConfig) => void }) {
  const [busy, setBusy] = useState(false);
  const [incoming, setIncoming] = useState<TvConfig | null>(null);
  const [resolution, setResolution] = useState(1920);
  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'הפעולה נכשלה');
    } finally {
      setBusy(false);
    }
  };
  const picture = async () => {
    const board = [...document.querySelectorAll<HTMLElement>('.tv-frame .tv-root')].find((e) => e.getBoundingClientRect().width > 0);
    if (!board) throw new Error('פתחו את התצוגה המקדימה לפני הייצוא');
    await document.fonts.ready;
    const fontEmbedCSS = await getFontEmbedCSS(board);
    return toPng(board, {
      pixelRatio: 1,
      canvasWidth: resolution,
      canvasHeight: Math.round((resolution * board.offsetHeight) / board.offsetWidth),
      fontEmbedCSS,
      style: { transform: 'none' },
      filter: (node) => !(node instanceof HTMLElement && node.matches('.tv-bf-handle, [data-edit-ui], .tv-paused')),
    });
  };

  return (
    <div data-testid="workspace-transfer" className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">העברת לוח בקובץ</h3>
      <p className="text-sm text-muted-foreground">
        קובץ אחד עם ההגדרות, החלקים וכל התמונות - לגיבוי, או להעברה לבית כנסת אחר. זמני התפילות והמודעות עצמם לא בקובץ:
        הם של כל בית כנסת.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onClick={() => run(async () => { downloadFile(await exportAppearance(config), 'עיצוב-הלוח.zip'); toast.success('קובץ העיצוב מוכן'); })}>
          ייצוא העיצוב בלבד
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run(async () => { downloadFile(await exportWorkspace(config), 'הלוח-כולו.zip'); toast.success('קובץ הלוח מוכן'); })}>
          ייצוא הלוח כולו
        </Button>
        <label className="cursor-pointer rounded border px-3 py-2 text-sm">
          {busy ? 'טוען…' : 'ייבוא מקובץ'}
          <input
            type="file"
            aria-label="ייבוא חבילת לוח"
            disabled={busy}
            className="sr-only"
            accept=".zip,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void run(async () => setIncoming(await importWorkspace(f, storeImage)));
            }}
          />
        </label>
      </div>

      {incoming && (
        <div className="space-y-2 rounded border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950" role="alert" data-testid="workspace-incoming">
          <p>
            בקובץ {incoming.elements.length} חלקים ו־{incoming.screens?.length ?? 0} מסכים. הוא נטען כטיוטה: אפשר לחזור בצעד אחורה, והלוחות
            מתעדכנים רק בשמירה.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { onImport(applyAppearance(config, incoming)); setIncoming(null); toast.success('העיצוב נטען לטיוטה; תוכן הלוח נשאר'); }}>
              העיצוב בלבד - התוכן של הלוח נשאר
            </Button>
            <Button variant="outline" onClick={() => { onImport(incoming); setIncoming(null); toast.success('הלוח נטען כטיוטה'); }}>
              הלוח כולו
            </Button>
            <Button variant="ghost" onClick={() => setIncoming(null)}>ביטול</Button>
          </div>
        </div>
      )}

      <h3 className="pt-2 font-semibold">תמונה של הלוח</h3>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="איכות התמונה" className="rounded border p-2 text-sm" value={resolution} onChange={(e) => setResolution(Number(e.target.value))}>
          <option value={1920}>רגילה (1920)</option>
          <option value={3840}>גבוהה מאוד (3840)</option>
        </select>
        <Button variant="outline" disabled={busy} onClick={() => run(async () => { const data = await picture(); downloadFile(await (await fetch(data)).blob(), 'הלוח.png'); })}>
          הורדת תמונה
        </Button>
      </div>
    </div>
  );
}
