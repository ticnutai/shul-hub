import { createContext, useContext, type ReactNode } from 'react';
import { AutoScroll } from './AutoScroll';
import { OverflowContext } from './overflowContext';
import { turnOf, type BoardElement, type ElementScroll } from './elements';
import {useDeadlines, DeadlineCard} from './DeadlineContext';
import { useFitLine } from './useFitLine';
import { useFitText } from './useFitText';

import type { ElementData } from './elementContent';
export type { ElementData } from './elementContent';
const Context = createContext<ElementData | undefined>(undefined);
export const ElementDataProvider = Context.Provider;
export function BoundElement({ element }: { element: BoardElement }) {
  const data = useContext(Context);
  // A frame that takes turns shows the content whose turn it is.
  const turns = element.binding && element.alternates?.length ? [element.binding, ...element.alternates] : null;
  const e = turns && data ? { ...element, binding: turns[turnOf(turns.length, element.alternateSeconds, data.now)] } : element;
  const deadlines=useDeadlines();
  const countdown=deadlines[0];
  const style = { width: '100%', height: '100%', fontSize: `${e.fontSize}cqh`, fontWeight: 700 };
  if (!data) {
    const labels = {clock:'12:00',analog:'◷',prayers:'זמני תפילות',lessons:'שיעורי תורה',title:'שם בית הכנסת',date:'תאריך עברי',zmanim:'זמני היום',footer:'פרשה ולימוד יומי',logos:'לוגואים',announcements:'הודעות',parasha:'פרשת השבוע',dafYomi:'דף יומי',amudYomi:'עמוד יומי',seasonal:'תוספות לתפילה'};
    return <div style={{ ...style, display: 'grid', placeItems: 'center' }}>{e.binding ? labels[e.binding] : e.text}</div>;
  }
  if(e.binding==='prayers' && countdown?.stage==='panel') return <DeadlineCard alert={countdown}/>;
  if(e.binding==='logos') return <div data-content-binding="logos" style={{...style,display:'flex',justifyContent:'center',gap:'1cqw'}}>{data.logos?.map(l=><img key={l.url} src={l.url} alt={l.name} style={{maxWidth:'100%',height:'100%',objectFit:'contain'}} />)}</div>;
  // One line that shrinks to fit (a name, a date, the parasha); paragraphs wrap.
  if(e.binding==='title'||e.binding==='date'||e.binding==='parasha'||e.binding==='dafYomi'||e.binding==='amudYomi'||e.binding==='seasonal') return <FitLine binding={e.binding} text={data[e.binding] ?? ''} fontSize={e.fontSize} />;
  if((e.binding==='footer'||e.binding==='announcements') && e.scroll) return <Scrolling mode={e.scroll}><div data-content-binding={e.binding} dir="rtl" style={{ display: 'grid', placeItems: 'center', textAlign: 'center', whiteSpace: 'pre-wrap', lineHeight: 1.4, fontWeight: 700, fontSize: `${e.fontSize}cqh` }}>{data[e.binding]}</div></Scrolling>;
  if(e.binding==='footer'||e.binding==='announcements') return <FitBlock binding={e.binding} text={data[e.binding] ?? ''} fontSize={e.fontSize} />;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(data.now);
  if (e.binding === 'clock') return <div data-content-binding="clock" dir="ltr" style={{ ...style, display: 'grid', placeItems: 'center' }}>{parts}</div>;
  if (e.binding === 'analog') {
    const [h, m] = parts.split(':').map(Number);
    return <svg data-content-binding="analog" viewBox="0 0 100 100" width="100%" height="100%" style={{ color: e.color }} aria-label={`שעון ${parts}`}>
      {Array.from({ length: 12 }, (_, i) => <text key={i} x={50 + 38 * Math.sin((i + 1) * Math.PI / 6)} y={53 + 38 * -Math.cos((i + 1) * Math.PI / 6)} fill="currentColor" textAnchor="middle" fontSize="8">{i + 1}</text>)}
      <path d="M50 52V25" stroke="currentColor" strokeWidth="2.4" transform={`rotate(${h * 30 + m / 2} 50 50)`} />
      <path d="M50 53V15" stroke="currentColor" strokeWidth="1.3" transform={`rotate(${m * 6} 50 50)`} /><circle cx="50" cy="50" r="2" fill="currentColor" />
    </svg>;
  }
  const rows = e.binding === 'prayers' ? data.prayers : e.binding==='zmanim' ? (data.zmanim??[]).filter((_,i)=>e.zmanKeys?e.zmanKeys.includes(data.zmanKeys?.[i] as NonNullable<BoardElement['zmanKeys']>[number]):!data.hiddenZmanKeys?.includes(data.zmanKeys?.[i]??'')) : data.lessons;
  const count=e.rowsPerPage??3;
  // Scrolling, every row is on the track, each the height a page would give it; paging, a page at a time.
  const scrolling = Boolean(e.scroll) && rows.length > count;
  // Pages as even as they can be: 13 times on pages of 6 were 6, 6 and a lone 1.
  const pages = Math.max(1, Math.ceil(rows.length / count));
  const per = Math.ceil(rows.length / pages);
  const page = scrolling ? 0 : Math.floor(data.now.getTime() / 15000) % pages;
  const list = <div data-content-binding={e.binding} dir="rtl" style={{ ...style, display: 'flex', flexDirection: 'column', ...(scrolling ? { height: 'auto' } : {}) }}>
    {(scrolling ? rows : rows.slice(page * per, page * per + per)).map((row, i) => { const [label,time]=row; const key=e.binding==='zmanim'?data.zmanKeys?.[data.zmanim!.indexOf(row)]:undefined; return <div key={key??i} data-zman={key} className={deadlines.some(a=>a.event===key)?'tv-zman-warning':undefined} style={{ flex: scrolling ? `0 0 ${e.height / count}cqh` : `0 0 ${100/count}%`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1cqw', lineHeight: 1.2 }}>
      {e.binding==='lessons' ? <><span style={{minWidth:0}}>{label.split(' · ')[0]}<small style={{display:'block',fontSize:'.72em',fontWeight:400,marginTop:'.4cqh'}}>{label.split(' · ').slice(1).join(' · ')}</small></span><span style={{flexShrink:0,textAlign:'left'}}><b dir="ltr">{time.split(' · ')[0]}</b><small style={{display:'block',fontSize:'.65em',fontWeight:400}}>{time.split(' · ').slice(1).join(' · ')}</small></span></> : <><FitLabel text={label} /><b dir="ltr" style={{ whiteSpace: 'nowrap' }}>{time}</b></>}
    </div>;})}
    {!rows.length && <span style={{ margin: 'auto', fontSize: '.65em' }}>{e.binding==='zmanim'?'לא נבחרו זמני יום':`לא הוגדרו ${e.binding === 'prayers' ? 'תפילות להיום' : 'שיעורים להיום'}`}</span>}
  </div>;
  return scrolling ? <Scrolling mode={e.scroll!}>{list}</Scrolling> : list;
}

/**
 * The board's own scrolling (AutoScroll), in the way this frame asked for -
 * whatever the board's "כשהתוכן לא נכנס" says, at the board's speed. It
 * moves only what does not fit; content that fits stands still.
 */
function Scrolling({ mode, children }: { mode: ElementScroll; children: ReactNode }) {
  const ctx = useContext(OverflowContext);
  return (
    <OverflowContext.Provider value={{ ...ctx, mode }}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <AutoScroll>{children}</AutoScroll>
      </div>
    </OverflowContext.Provider>
  );
}

function FitLine({ binding, text, fontSize }: { binding: string; text: string; fontSize: number }) {
  const ref = useFitLine<HTMLDivElement>(text);
  return (
    <div
      ref={ref}
      data-content-binding={binding}
      dir="rtl"
      style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2, fontWeight: 700, fontSize: `calc(${fontSize}cqh * var(--fit, 1))` }}
    >
      {text}
    </div>
  );
}

/**
 * Paragraphs - the notices, the day's line - shrunk until they fit the box,
 * as the notice cards of the ordinary board are. A long notice used to run
 * out of its frame and over the part below it.
 */
function FitBlock({ binding, text, fontSize }: { binding: string; text: string; fontSize: number }) {
  const ref = useFitText<HTMLDivElement>(text);
  return (
    <div
      ref={ref}
      data-content-binding={binding}
      dir="rtl"
      style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', whiteSpace: 'pre-wrap', overflow: 'hidden', lineHeight: 1.4, fontWeight: 700, fontSize: `calc(${fontSize}cqh * var(--fit, 1))` }}
    >
      {text}
    </div>
  );
}

/**
 * A row's name on one line: "סוף זמן קריאת שמע מגן אברהם" broke in two in a
 * narrow arch, and the rows stood uneven. A long one is made smaller - that
 * row alone - down to the floor of useFitLine, and only then ended with "...".
 */
function FitLabel({ text }: { text: string }) {
  const ref = useFitLine<HTMLSpanElement>(text, 0);
  return (
    <span ref={ref} style={{ flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'calc(1em * var(--fit, 1))' }}>
      {text}
    </span>
  );
}

/** A heading taking the same turns as the content of its frame. */
export function TurningText({ texts, seconds }: { texts: string[]; seconds?: number }) {
  const data = useContext(Context);
  return <>{texts[data ? turnOf(texts.length, seconds, data.now) : 0]}</>;
}
