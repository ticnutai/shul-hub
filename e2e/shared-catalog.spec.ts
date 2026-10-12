import {test,expect} from '@playwright/test';
import {serveEditor} from './support/tvEditor';
import {DEFAULT_TV_CONFIG,normalizeTvConfig} from '../src/tv/config';
import {parseSharedCatalog} from '../src/tv/sharedCatalog';
import {readFileSync} from 'node:fs';
import {applyDesign,captureDesign} from '../src/tv/designs';
const raw=JSON.parse(readFileSync('public/new-shul-catalog.json','utf8'));

test('every catalogue design can be applied, edited and captured without mutating its source',()=>{
 for(const design of parseSharedCatalog(raw).designs){
  const before=JSON.stringify(design);
  const applied=applyDesign(normalizeTvConfig(DEFAULT_TV_CONFIG),design);
  const edited=normalizeTvConfig({...applied,textScale:1.2,elements:applied.elements.map((e,i)=>i===0?{...e,opacity:.7}:e)});
  const copy=captureDesign(edited,'עותק בדיקה',['background','frames','text','layout']);
  const restored=applyDesign(normalizeTvConfig(DEFAULT_TV_CONFIG),copy);
  expect(restored.textScale).toBe(1.2);
  expect(restored.elements).toEqual(edited.elements);
  expect(JSON.stringify(design)).toBe(before);
 }
});

for(const id of ['d_rc_sapphire_hall','d_rc_ivory_moon','d_rc_lunar_library','d_rc_moon_crown_balanced','d_rc_moon_crown_right','d_rc_moon_crown_left','d_rc_silver_leaves','d_rc_walnut_vines','d_daily_air','d_daily_noir','d_daily_stone']){
 test('layer editing and persistence: '+id,async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width:1600,height:1000});
  const greeting=id.startsWith('d_daily_')?'ברכת היום':'ברכת ראש חודש';
  const category=id.startsWith('d_daily_')?'כללי':'ראש חודש';
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const server=await serveEditor(page,JSON.parse(JSON.stringify(DEFAULT_TV_CONFIG)));
  await page.goto('/e2e/harness/editor.html');
  await page.getByRole('tab',{name:'עיצוב',exact:true}).click();
  const library=page.getByTestId('design-library');
  await library.getByLabel('נושא הערכות',{exact:true}).selectOption(category);
  const d=raw.designs.find(x=>x.id===id);
  const card=library.locator(`[data-design-id="${id}"]`);
  await card.getByRole('button',{name:'שכפול לעריכה',exact:true}).click();
  await card.getByRole('button',{name:'החלת ערכה '+d.name,exact:true}).click();
  const parts=page.getByTestId('shared-catalog-parts');
  await parts.getByLabel('נושא החלקים',{exact:true}).selectOption(category);
  await parts.getByLabel('חלקים מאיזו ערכה').selectOption(id);
  await expect(parts.getByTestId('shared-count')).toHaveText(d.values.elements.length+' חלקים זמינים');
  const board=page.locator('.tv-frame .tv-root').first();
  await expect(board.locator('[data-element-id]')).toHaveCount(d.values.elements.length);
  await expect.poll(()=>board.locator('img').evaluateAll(imgs=>imgs.every(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0))).toBe(true);
  await board.screenshot({path:'../outputs/'+id+'-board.png'});
  const layers=page.getByLabel('שכבות החלקים',{exact:true});
  await layers.getByRole('button',{name:greeting,exact:true}).click();
  await page.getByLabel('מיקום אופקי',{exact:true}).fill('32');
  await page.getByLabel('מה כתוב בטקסט',{exact:true}).fill('חודש טוב ומבורך');
  await page.getByRole('button',{name:'שכפול החלק',exact:true}).click();
  await expect(board.locator('[data-element-id]')).toHaveCount(d.values.elements.length+1);
  await page.getByRole('button',{name:'מחיקת הבחירה',exact:true}).click();
  await page.getByTestId('confirm-dialog').getByRole('button',{name:'מחיקה'}).click();
  await expect(board.locator('[data-element-id]')).toHaveCount(d.values.elements.length);
  await page.getByRole('button',{name:/שמור ושדר/}).first().click();
  await expect.poll(()=>server.writes()).toBeGreaterThan(0);
  const saved=normalizeTvConfig(server.saved());
  expect(saved.elements.find(e=>e.name===greeting)).toMatchObject({x:32,text:'חודש טוב ומבורך'});
  expect(saved.designs).toHaveLength(1);
  await page.reload();await expect(board.locator('[data-element-id]')).toHaveCount(d.values.elements.length);
  expect(errors).toEqual([]);
 });
}
test('catalog preserves images, masks and bindings through central normalizer',()=>{
 const parsed=parseSharedCatalog(raw);
 expect(parsed.designs).toHaveLength(88);expect(parsed.parts).toHaveLength(1138);
 for(const d of parsed.designs){
  const source=raw.designs.find(x=>x.id===d.id);
  expect(d.values.elements?.length??0).toBe(source.values.elements?.length??0);
  for(const e of d.values.elements??[]){
   const s=source.values.elements.find(x=>x.id===e.id);
   expect(e.image).toBe(s.image);expect(e.binding).toBe(s.binding);expect(e.sourceMask).toEqual(s.sourceMask);
  }
 }
});
test('central editor shares categorized themes and parts without changing a board on open',async({page})=>{
 test.setTimeout(60000);page.setDefaultTimeout(15000);await page.setViewportSize({width:1600,height:1000});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const original=JSON.parse(JSON.stringify(DEFAULT_TV_CONFIG));
 const server=await serveEditor(page,original);
 await page.goto('/e2e/harness/editor.html');
 await expect(page.locator('.tv-frame .tv-root').first()).toBeVisible({timeout:30000});
 await page.getByRole('tab',{name:'עיצוב',exact:true}).click();
 const library=page.getByTestId('design-library');
 await library.getByLabel('נושא הערכות',{exact:true}).selectOption('ראש חודש');
 await expect(library.locator('[data-design-id^="d_rc_"]')).toHaveCount(15);
 expect(server.writes()).toBe(0);expect(server.saved()).toEqual(original);
 await library.getByLabel('נושא הערכות',{exact:true}).selectOption('הכול');
 const ids=await library.locator('[data-design-id]').evaluateAll(els=>els.map(e=>e.getAttribute('data-design-id')));
 expect(new Set(ids).size).toBe(ids.length);
 await library.getByLabel('נושא הערכות',{exact:true}).selectOption('ראש חודש');
 const card=library.locator('[data-design-id="d_rc_antique"]');
 await card.getByRole('button',{name:'שכפול לעריכה',exact:true}).click();
 await card.getByRole('button',{name:'החלת ערכה ראש חודש · שערי הלבנה',exact:true}).click();
 await expect(page.locator('.tv-frame [data-element-id]')).toHaveCount(26);
 const parts=page.getByTestId('shared-catalog-parts');
 await parts.getByLabel('נושא החלקים',{exact:true}).selectOption('ראש חודש');
 await parts.getByLabel('חלקים מאיזו ערכה').selectOption('d_rc_antique');
 await expect(parts.getByTestId('shared-count')).toHaveText('26 חלקים זמינים');
 const addedPart=raw.parts.filter(p=>p.designId==='d_rc_antique')[21];
 await parts.getByLabel('חיפוש בקטלוג המשותף').fill(addedPart.name);
 await parts.getByRole('button',{name:'הוספת חלק משותף '+addedPart.name,exact:true}).click();
 await page.getByRole('button',{name:/שמור ושדר/}).first().click();
 await expect.poll(()=>server.writes()).toBeGreaterThan(0);
 const saved=normalizeTvConfig(server.saved());
 expect(saved.elements).toHaveLength(27);expect(saved.designs).toHaveLength(1);
 expect(new Set(saved.elements.map(e=>e.id)).size).toBe(27);
 await page.reload();await expect(page.locator('.tv-frame [data-element-id]')).toHaveCount(27);
 await page.screenshot({path:'../outputs/central-global-catalog-editor.png'});
 expect(errors).toEqual([]);
});
