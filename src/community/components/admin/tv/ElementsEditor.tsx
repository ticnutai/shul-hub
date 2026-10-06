import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { TvConfig } from '@/tv/config';
import { ELEMENT_KINDS, ELEMENT_NAMES, MAX_ELEMENTS, alignElements, elementId, moveElements, newElement, normalizeElements, type BoardElement } from '@/tv/elements';
import { BoardElements } from '@/tv/BoardElements';
import { useElementEditing } from '@/tv/elementEditing';
import { ElementLibrary } from './ElementLibrary';
import { exportElementSet, importElementSet } from '@/tv/elements';
import { downloadFile } from '@/tv/workspaceTransfer';
import { uploadImages } from './uploadImages';
import {ZMAN_DISPLAY_KEYS,ZMAN_DISPLAY_LABELS} from '@/community/lib/zmanim';

type Props = { config: TvConfig; onEdit: (key: string, update: (c: TvConfig) => TvConfig) => void };
export function ElementsEditor({ config, onEdit }: Props) {
  const elements = config.elements;
  const { selected, select, snap, setSnap } = useElementEditing()!;
  const first = elements.find(e => e.id === selected[0]);
  const commit = (next: BoardElement[], key = `elements:${crypto.randomUUID()}`) => onEdit(key, c => ({ ...c, elements: normalizeElements(next) }));
  const patch = (p: Partial<BoardElement>) => {
    if (first && ('x' in p || 'y' in p)) { commit(moveElements(elements, selected, (p.x ?? first.x) - first.x, (p.y ?? first.y) - first.y)); return; }
    commit(elements.map(e => selected.includes(e.id) && !e.locked ? { ...e, ...p } : e), `element-property:${selected.join(',')}:${Object.keys(p).join(',')}`);
  };
  const choose = (e: BoardElement, multi: boolean) => {
    const ids = e.group ? elements.filter(x => x.group === e.group).map(x => x.id) : [e.id];
    const next = multi ? [...new Set([...selected, ...ids])] : ids; select(next); return next;
  };
  const duplicate = () => {
    const copies = elements.filter(e => selected.includes(e.id));
    if (copies.length + elements.length > MAX_ELEMENTS) return toast.error('עד 80 אלמנטים בלוח');
    const groups = new Map<string, string>();
    const added = copies.map(e => {
      if (e.group && !groups.has(e.group)) groups.set(e.group, elementId());
      return { ...e, id: elementId(), name: `${e.name} (עותק)`, x: Math.min(100 - e.width, e.x + 2), y: Math.min(100 - e.height, e.y + 2), locked: false, group: e.group ? groups.get(e.group)! : null };
    }); commit([...elements, ...added]); select(added.map(e => e.id));
  };
  const addLiveBox=(binding:'zmanim'|'parasha'|'title',label:string)=>{
    if(elements.length+4>MAX_ELEMENTS)return toast.error('עד 80 אלמנטים בלוח');
    const base={x:34,y:22,width:32,height:binding==='zmanim'?66:24};
    const fill={...newElement('box'),...base,name:`מילוי ${label}`,fill:'#122333',color:'transparent'};
    const frame={...newElement('frame'),...base,name:`מסגרת ${label}`,color:'#d5b675'};
    const heading={...newElement('text'),x:36,y:24,width:28,height:5,name:`כותרת ${label}`,text:label,fontSize:3,color:'#f5dfad'};
    const content={...newElement('text'),x:36,y:31,width:28,height:base.height-12,name:`תוכן ${label}`,binding,text:'',color:'#fff5de',fontSize:binding==='zmanim'?1.8:3,rowsPerPage:13,...(binding==='zmanim'?{zmanKeys:[...ZMAN_DISPLAY_KEYS]}:{})};
    commit([...elements,fill,frame,heading,content]);select([content.id]);
  };
  return <div className="space-y-3" data-testid="elements-editor">
    <div className="flex flex-wrap gap-2" aria-label="תוכן חי בתוך מסגרת">
      <Button size="sm" variant="outline" onClick={()=>addLiveBox('zmanim','זמני היום')}>הוספת תיבת זמני היום</Button>
      <Button size="sm" variant="outline" onClick={()=>addLiveBox('title','שם בית הכנסת')}>הוספת שם בית הכנסת</Button>
      <Button size="sm" variant="outline" onClick={()=>addLiveBox('parasha','פרשת השבוע')}>הוספת פרשת השבוע</Button>
    </div>
    {elements.some(e=>e.sourceMask) ? <p className="rounded border p-3 text-sm" data-testid="artwork-mask-disclosure">פרטי הציור המקורי מופרדים במסכות: מסגרות, מילויים, עמודים וקישוטים. אפשר להזיז ולהסתיר כל שכבה בנפרד; הטקסט והשעון חיים. הקישוט של הפמוטים, הספר והענף נשמר כקבוצה אחת. רקע משלים ייחשף כאשר תזיזו חלק.</p> : elements.some(e => e.crop) && <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950" data-testid="artwork-layer-disclosure">בערכה זו יש תמונות חתוכות. חיתוך מלבני לבדו אינו מפריד מסגרת מהרקע שסביבה; בערכות הציור הוותיקות הם נשארים יחד. הטקסט והשעון נפרדים.</p>}
    <p className="text-sm text-muted-foreground">{config.screenLayout === 'composition' ? 'גררו חלק למקומו. Shift + לחיצה לבחירה משותפת. המסגרות, המילויים והתוכן החי של הערכה נמצאים ברשימת האלמנטים.' : 'גררו חלק למקומו. Shift + לחיצה לבחירה משותפת. סדר השכבות כאן הוא מעל תוכן הלוח; הרקע והתיבות החיים נשארים בכלים הקיימים.'}</p>
    <div className="flex flex-wrap gap-2">{ELEMENT_KINDS.filter(k => k !== 'image').map(kind => <Button size="sm" variant="outline" key={kind} disabled={elements.length >= MAX_ELEMENTS} onClick={() => { const e = newElement(kind); commit([...elements, e]); select([e.id]); }}>הוספת {ELEMENT_NAMES[kind]}</Button>)}
      <label className="cursor-pointer rounded border px-3 py-2 text-sm">הוספת תמונה<input className="sr-only" aria-label="הוספת תמונה כאלמנט" type="file" accept="image/png,image/jpeg,image/webp" onChange={async ev => {
        const f = ev.target.files?.[0]; ev.target.value = ''; if (!f) return;
        if (elements.length >= MAX_ELEMENTS || f.size > 15_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return toast.error('בחרו תמונה (PNG, JPEG או WebP), ועד 80 חלקים');
        // Into the synagogue's picture storage, transparency kept: the board keeps only its address.
        const [image] = await uploadImages([f]).catch((e) => { toast.error(e instanceof Error ? e.message : 'העלאת התמונה נכשלה'); return [] as string[]; });
        if (!image) return;
        const e = { ...newElement('image'), image, name: f.name }; commit([...elements, e]); select([e.id]);
      }} /></label>
    </div>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />הצמדה לרשת</label>
    <div data-testid="elements-canvas" dir="ltr" className="relative aspect-video w-full overflow-hidden rounded-lg border border-amber-700/50 bg-slate-900" style={{ containerType: 'size', backgroundImage: snap ? 'linear-gradient(#ffffff0d 1px, transparent 1px), linear-gradient(90deg, #ffffff0d 1px, transparent 1px)' : undefined, backgroundSize: '5% 5%' }}>
      <BoardElements elements={elements} surface />
    </div>
    <p className="text-xs text-muted-foreground">בעריכה ישירה בלוח אפשר לגרור גם על התצוגה האמיתית. כשהלוח ממוקד: חצים להזזה עדינה, Shift לתזוזה גדולה, Delete למחיקה, Ctrl+D לשכפול ו־Esc לביטול בחירה. Alt + לחיצה משאיר את פעולת הלוח הרגילה.</p>
    <div className="flex flex-wrap gap-2" aria-label="יישור הבחירה">
      {([['left', 'לשמאל'], ['center-x', 'מרכוז אופקי'], ['right', 'לימין'], ['top', 'למעלה'], ['center-y', 'מרכוז אנכי'], ['bottom', 'למטה']] as const).map(([alignment, label]) => <Button key={alignment} size="sm" variant="outline" disabled={!first || elements.some(e => selected.includes(e.id) && e.locked)} onClick={() => commit(alignElements(elements, selected, alignment))}>{label}</Button>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!first} onClick={() => downloadFile(new Blob([exportElementSet(elements.filter(e => selected.includes(e.id)))], { type: 'application/json' }), 'new-shul-elements.json')}>ייצוא הבחירה</Button>
      <label className="cursor-pointer rounded border px-3 py-2 text-sm">ייבוא אלמנטים<input className="sr-only" type="file" aria-label="ייבוא אלמנטים מקובץ" accept=".json" onChange={async ev => {
        const f = ev.target.files?.[0]; ev.target.value = ''; if (!f) return;
        try {
          if (f.size > 15_000_000) throw new Error('הקובץ גדול מדי');
          const added = importElementSet(await f.text());
          if (elements.length + added.length > MAX_ELEMENTS) throw new Error('עד 80 אלמנטים בלוח');
          commit([...elements, ...added]); select(added.map(e => e.id));
        } catch (e) { toast.error(e instanceof Error ? e.message : 'ייבוא האלמנטים נכשל'); }
      }} /></label>
      <Button size="sm" variant="outline" disabled={!first} onClick={duplicate}>שכפול אלמנט</Button>
      <Button size="sm" variant="outline" disabled={selected.length < 2 || elements.some(e => selected.includes(e.id) && e.locked)} onClick={() => patch({ group: elementId() })}>קיבוץ</Button>
      <Button size="sm" variant="outline" disabled={!first?.group} onClick={() => patch({ group: null })}>פירוק קבוצה</Button>
      <Button size="sm" variant="outline" disabled={!first || elements.some(e => selected.includes(e.id) && e.locked)} onClick={() => { commit(elements.filter(e => !selected.includes(e.id))); select([]); }}>מחיקת הבחירה</Button>
      <Button size="sm" variant="outline" disabled={!first} onClick={() => commit([...elements.filter(e => !selected.includes(e.id)), ...elements.filter(e => selected.includes(e.id))])}>קדימה</Button>
      <Button size="sm" variant="outline" disabled={!first} onClick={() => commit([...elements.filter(e => selected.includes(e.id)), ...elements.filter(e => !selected.includes(e.id))])}>אחורה</Button>
    </div>
    {first && <fieldset disabled={first.locked} className="grid grid-cols-2 gap-2 rounded border p-3 sm:grid-cols-3">
      <p className="col-span-2 text-xs" data-testid="selected-layer-type">סוג החלק: {first.sourceMask ? 'חלק מהציור עם מסכה שקופה' : first.crop ? 'אזור מתוך תמונה' : first.binding ? 'תוכן חי נפרד' : ELEMENT_NAMES[first.kind]}</p>
      {['prayers','lessons','zmanim'].includes(first.binding ?? '') && <label className="text-xs">שורות בכל עמוד<input type="number" className="block w-full rounded border p-2" aria-label="שורות בכל עמוד באלמנט" min={1} max={30} value={first.rowsPerPage ?? 3} onChange={ev => { if(ev.target.value !== '') patch({rowsPerPage:Math.max(1,Math.min(30,Number(ev.target.value)))}); }} /></label>}
      {first.binding==='zmanim' && <div className="col-span-2 space-y-2" data-testid="element-zmanim-picker">
        <p>מג״א מחושב לפי 72 דקות קבועות לפני הנץ ואחרי השקיעה. הגר״א מחושב מהנץ לשקיעה.</p>
        <Button type="button" size="sm" variant="outline" onClick={()=>patch({zmanKeys:[...ZMAN_DISPLAY_KEYS],rowsPerPage:ZMAN_DISPLAY_KEYS.length,fontSize:Math.min(first.fontSize,first.height/(ZMAN_DISPLAY_KEYS.length*2.2))})}>הצגת כל זמני היום יחד</Button>
        <div className="grid gap-2 sm:grid-cols-2">{ZMAN_DISPLAY_KEYS.map(key=><label key={key} className="flex gap-2 text-xs"><input type="checkbox" checked={(first.zmanKeys??ZMAN_DISPLAY_KEYS.filter(k=>!config.hidden.includes(`zman.${k}`))).includes(key)} onChange={ev=>{const keys=first.zmanKeys??ZMAN_DISPLAY_KEYS.filter(k=>!config.hidden.includes(`zman.${k}`));patch({zmanKeys:ev.target.checked?[...keys,key]:keys.filter(k=>k!==key)});}}/>{ZMAN_DISPLAY_LABELS[key]}</label>)}</div>
      </div>}
      <label className="text-xs">שם<input className="block w-full rounded border p-2" aria-label="שם האלמנט" value={first.name} onChange={e => patch({ name: e.target.value })} /></label>
      {([['x','מיקום אופקי',0,100],['y','מיקום אנכי',0,100],['width','רוחב האלמנט',1,100],['height','גובה האלמנט',1,100],['rotation','סיבוב',-180,180],['fontSize','גודל טקסט',.5,20],['opacity','אטימות',0,1]] as const).map(([key,label,min,max]) => <label className="text-xs" key={key}>{label}<input type="number" className="block w-full rounded border p-2" aria-label={label} min={min} max={max} step={key === 'opacity' ? .1 : .5} value={Number(first[key].toFixed(2))} onChange={ev => { if (ev.target.value !== '') patch({ [key]: Number(ev.target.value) }); }} /></label>)}
      <label className="text-xs">צבע<input type="color" aria-label="צבע האלמנט" value={first.color} onChange={e => patch({ color: e.target.value })} /></label>
      {first.kind === 'text' && <><label className="text-xs">מקור התוכן<select className="block w-full rounded border p-2" aria-label="מקור תוכן האלמנט" value={first.binding ?? ''} onChange={e => patch({ binding: (e.target.value || undefined) as BoardElement['binding'] })}><option value="">טקסט חופשי</option><option value="clock">שעון דיגיטלי חי</option><option value="analog">שעון מחוגים חי</option><option value="prayers">תפילות היום</option><option value="lessons">שיעורי היום</option><option value="title">שם בית הכנסת</option><option value="date">תאריך עברי</option><option value="zmanim">זמני היום</option><option value="footer">פרשה ולימוד יומי</option><option value="parasha">פרשת השבוע בלבד</option><option value="dafYomi">דף יומי</option><option value="amudYomi">עמוד יומי</option><option value="seasonal">תוספות בתפילה</option><option value="logos">לוגואים קיימים</option><option value="announcements">הודעות נוכחיות</option></select></label>{!first.binding && <label className="col-span-2 text-xs">תוכן הטקסט<textarea className="block w-full rounded border p-2" aria-label="תוכן האלמנט" value={first.text} onChange={e => patch({ text: e.target.value })} /></label>}</>}
      {['box','frame'].includes(first.kind) && <label className="text-xs">מילוי<input type="color" aria-label="מילוי האלמנט" value={first.fill === 'transparent' ? '#ffffff' : first.fill} onChange={e => patch({ fill: e.target.value })} /><button type="button" onClick={() => patch({ fill: 'transparent' })}>ללא מילוי</button></label>}
    </fieldset>}
    <div className="space-y-1" aria-label="שכבות האלמנטים">{[...elements].reverse().map(e => <div key={e.id} className={`flex items-center gap-2 rounded border px-2 py-1 ${selected.includes(e.id) ? 'border-sky-500 bg-sky-50' : ''}`}>
      <button type="button" className="flex-1 text-right text-sm" onClick={ev => choose(e, ev.shiftKey)}>{e.name}{e.group ? ' · קבוצה' : ''}</button>
      <button type="button" className="text-xs" aria-label={`${e.hidden ? 'הצגת' : 'הסתרת'} ${e.name}`} onClick={() => commit(elements.map(x => x.id === e.id ? { ...x, hidden: !x.hidden } : x))}>{e.hidden ? 'הצג' : 'הסתר'}</button>
      <button type="button" className="text-xs" aria-label={`${e.locked ? 'שחרור' : 'נעילת'} ${e.name}`} onClick={() => commit(elements.map(x => x.id === e.id ? { ...x, locked: !x.locked } : x))}>{e.locked ? 'שחרר' : 'נעל'}</button>
    </div>)}</div>
    <ElementLibrary config={config} selected={selected} onEdit={onEdit} onSelect={select} />
    <p className="text-xs text-muted-foreground">השינויים מופיעים גם בתצוגת הלוח. שמירה וביטול משתמשים בכפתורי העורך הראשיים.</p>
  </div>;
}
