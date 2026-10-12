import {useEffect,useState} from 'react';
import type {TvConfig} from '@/tv/config';
import {applyDesign} from '@/tv/designs';
import {importElementSet,exportElementSet,MAX_ELEMENTS} from '@/tv/elements';
import {BoardElements} from '@/tv/BoardElements';
import {findBackdrop} from '@/tv/backdrops';
import {loadSharedCatalog,type SharedCatalog} from '@/tv/sharedCatalog';
import {CATALOG_CATEGORIES,catalogCategory,type CatalogCategory} from '@/tv/catalogCategories';

/** Global read-only choices. Never saves or changes a board merely by opening it. */
export function SharedCatalogLibrary({mode,config,onEdit,onSelect,includeStandalone=true}:{
 mode:'designs'|'parts';config:TvConfig;includeStandalone?:boolean;
 onEdit:(key:string,update:(c:TvConfig)=>TvConfig)=>void;onSelect?:(ids:string[])=>void;
}){
 const [catalog,setCatalog]=useState<SharedCatalog>();
 const [error,setError]=useState('');const [search,setSearch]=useState('');
 const [source,setSource]=useState('standalone');const [limit,setLimit]=useState(12);
 const [attempt,setAttempt]=useState(0);
 const [category,setCategory]=useState<CatalogCategory>('הכול');
 useEffect(()=>{let active=true;setError('');loadSharedCatalog(attempt>0).then(c=>{if(active){setCatalog(c);if(!includeStandalone)setSource(c.designs.find(d=>c.parts.some(p=>p.designId===d.id))?.id??'');}}).catch(()=>{if(active)setError('לא ניתן לטעון את הקטלוג המשותף. העיצוב השמור בלוח לא השתנה.');});return()=>{active=false;};},[attempt,includeStandalone]);
 const categoryDesigns=catalog?.designs.filter(d=>category==='הכול'||catalogCategory(d)===category)??[];
 const designs=categoryDesigns.filter(d=>d.name.includes(search.trim()));
 const parts=catalog?.parts.filter(p=>p.designId===source&&p.name.includes(search.trim()))??[];
 const total=mode==='designs'?designs.length:parts.length;
 return <section className="space-y-3 rounded-lg border p-3" data-testid={`shared-catalog-${mode}`} dir="rtl">
  <h3 className="font-semibold">{mode==='designs'?'ערכות משותפות לכל בתי הכנסת':'חלקים משותפים מכל הערכות'}</h3>
  <p className="text-xs">זמין בכל לוח, גם חדש. בחירה משנה טיוטה בלבד; הפרסום משתמש בשמירה הרגילה של הלוח.</p>
  <p className="text-xs">הנושאים מיועדים לחיפוש בלבד. אפשר לבחור כל ערכה בכל יום; העריכה נעשית בעותק בלוח ואינה משנה את המקור המשותף.</p>
  {!catalog&&!error&&<p role="status">טוען קטלוג משותף…</p>}
  {error&&<div role="alert">{error}<button type="button" onClick={()=>setAttempt(a=>a+1)}>ניסיון נוסף</button></div>}
  {catalog&&<>
   <label>נושא הערכות<select aria-label="נושא הערכות" className="rounded border p-2" value={category} onChange={e=>{
    const next=e.target.value as CatalogCategory;setCategory(next);setSearch('');setLimit(12);
    setSource(next==='הכול'&&includeStandalone?'standalone':catalog.designs.find(d=>(next==='הכול'||catalogCategory(d)===next)&&catalog.parts.some(p=>p.designId===d.id))?.id??'');
   }}>{CATALOG_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   <label>חיפוש בקטלוג המשותף<input className="rounded border p-2" value={search} onChange={e=>{setSearch(e.target.value);setLimit(12);}}/></label>
   {mode==='parts'&&<label>חלקים מאיזו ערכה<select className="rounded border p-2" value={source} onChange={e=>{setSource(e.target.value);setSearch('');setLimit(12);}}>
    {includeStandalone&&(category==='הכול'||source==='standalone')&&<option value="standalone">פריטים עצמאיים מהספרייה</option>}
    {categoryDesigns.filter(d=>catalog.parts.some(p=>p.designId===d.id)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
   </select></label>}
   <p data-testid="shared-count" className="text-xs">{total} {mode==='designs'?'ערכות':'חלקים'} זמינים</p>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {mode==='designs'?designs.slice(0,limit).map(d=><article key={d.id} className="rounded border p-2">
     <img loading="lazy" alt="" className="aspect-video w-full object-cover" src={d.values.elements?.find(e=>e.image)?.image||findBackdrop(d.values.backgroundImage??null)?.thumb||d.values.backgroundImage||undefined}/>
     <p>{d.name}</p>
     {d.id.startsWith('d_premium_')&&<p className="text-xs">אזורי ציור עם רקע מחובר; הטקסט והשעון נפרדים</p>}
     <button type="button" className="underline" onClick={()=>onEdit(`shared-design:${d.id}`,c=>applyDesign(c,d))} aria-label={`החלת ערכה משותפת ${d.name}`}>בחירת הערכה</button>
    </article>):parts.slice(0,limit).map(p=><article key={p.id} className="rounded border p-2">
     <div className="relative isolate aspect-video overflow-hidden bg-slate-900" style={{containerType:'size'}}><BoardElements elements={p.elements}/></div>
     <p>{p.name}</p><p className="text-xs">{p.note}</p>
     <button type="button" className="underline disabled:opacity-40" disabled={config.elements.length+p.elements.length>MAX_ELEMENTS} aria-label={`הוספת חלק משותף ${p.name}`} onClick={()=>{
      const added=importElementSet(exportElementSet(p.elements)).map(e=>({...e,hidden:false,locked:false}));
      onEdit(`shared-part:${p.id}`,c=>c.elements.length+added.length>MAX_ELEMENTS?c:{...c,elements:[...c.elements,...added]});onSelect?.(added.map(e=>e.id));
     }}>הוספת חלק</button>
    </article>)}
   </div>
   {limit<total&&<button type="button" className="underline" onClick={()=>setLimit(n=>n+12)}>הצגת עוד</button>}
   {!total&&<p>לא נמצאו תוצאות</p>}
  </>}
 </section>;
}
