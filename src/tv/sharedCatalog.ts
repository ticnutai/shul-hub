import {normalizeTvConfig} from './config';
import {normalizeDesigns,type SavedDesign} from './designs';
import {normalizeElements,type BoardElement} from './elements';

export const SHARED_CATALOG_URL='/new-shul-catalog.json';
export interface CatalogPart {id:string;name:string;designId:string;note:string;elements:BoardElement[]}
export interface SharedCatalog {designs:SavedDesign[];parts:CatalogPart[]}
export function parseSharedCatalog(raw:unknown):SharedCatalog {
 const r=raw as Record<string,unknown>;
 if(!r||r.format!=='new-shul-shared-catalog'||r.version!==1||!Array.isArray(r.designs)||!Array.isArray(r.parts)||r.designs.length>200||r.parts.length>1500)throw new Error('קטלוג לא נתמך');
 // The shared read-only catalogue is not the board's 40 personal saved designs.
 const designs=r.designs.flatMap(d=>{
  if(!d||typeof d.id!=='string'||!/^d_[a-z0-9_-]{1,80}$/.test(d.id))return [];
  // Built-in IDs may contain hyphens, unlike generated personal-save IDs.
  return normalizeDesigns([{...d,id:'d_catalog'}],normalizeTvConfig).map(checked=>({...checked,id:d.id}));
 });
 if(designs.length!==r.designs.length||new Set(designs.map(d=>d.id)).size!==designs.length)throw new Error('ערכות לא תקינות בקטלוג');
 const parts:CatalogPart[]=r.parts.map(p=>{
  if(!p||typeof p.id!=='string'||typeof p.name!=='string'||typeof p.designId!=='string'||(p.designId!=='standalone'&&!designs.some(d=>d.id===p.designId)))throw new Error('חלק לא תקין בקטלוג');
  const elements=normalizeElements(p.elements);
  if(!elements.length||elements.length!==p.elements.length)throw new Error('אלמנטים לא תקינים בקטלוג');
  return {id:p.id,name:p.name.slice(0,80),designId:p.designId,note:typeof p.note==='string'?p.note.slice(0,160):'',elements};
 });
 if(new Set(parts.map(p=>p.id)).size!==parts.length)throw new Error('חלקים כפולים בקטלוג');
 return {designs,parts};
}
let pending:Promise<SharedCatalog>|undefined;
export function loadSharedCatalog(retry=false){
 if(retry)pending=undefined;
 return pending??=fetch(SHARED_CATALOG_URL,{credentials:'omit',signal:AbortSignal.timeout(15000)})
  .then(async r=>{if(!r.ok)throw new Error('הקטלוג אינו זמין כרגע');const text=await r.text();if(text.length>4_000_000)throw new Error('קטלוג גדול מדי');return parseSharedCatalog(JSON.parse(text));})
  .catch(e=>{pending=undefined;throw e;});
}
