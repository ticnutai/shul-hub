import { toast } from 'sonner';
import type { ElementSide, PlaceResult } from '@/tv/elements';

/**
 * What became of a part sent to a side, said to the gabbai. True when there
 * is a change to keep (moved, swapped, or moved over another part). A part
 * that now stands over another offers to replace it - to hide the one below -
 * in one click, from the message itself.
 */
export function announcePlace(r: PlaceResult, name: string, side: ElementSide, onReplace?: (ids: string[]) => void): boolean {
  const where = { right: 'לצד ימין', left: 'לצד שמאל', center: 'לאמצע' }[side];
  const at = { right: 'בצד ימין', left: 'בצד שמאל', center: 'באמצע' }[side];
  if (r.result === 'missing') return false;
  if (r.result === 'locked') {
    toast.error(r.other ? `"${r.other}" נעול, ולכן אי אפשר להחליף איתו מקום. שחררו אותו קודם.` : `"${name}" או חלק שזז איתו נעול. שחררו אותו קודם.`);
    return false;
  }
  if (r.result === 'already') { toast(`"${name}" כבר נמצא ${at}.`); return false; }
  if (r.result === 'covers') {
    const ids = r.otherIds;
    toast.warning(`"${name}" עבר ${where}, ועומד עכשיו מעל "${r.other}".`, {
      duration: 10_000,
      ...(onReplace && ids?.length
        ? { action: { label: `להחליף את "${r.other}"`, onClick: () => { onReplace(ids); toast.success(`"${r.other}" הוסתר. אפשר להחזיר אותו מרשימת המוסתרות.`); } } }
        : { description: `אפשר להסתיר את "${r.other}", או להעביר אותו לצד אחר.` }),
    });
  } else toast.success(r.result === 'swapped' ? `"${name}" עבר ${where}, ו"${r.other}" עבר למקום שהתפנה.` : `"${name}" עבר ${where}.`);
  return true;
}
