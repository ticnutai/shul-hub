import { expect, test } from "@playwright/test";
import { serveEditor } from "./support/tvEditor";
import { PREMIUM_DESIGNS } from "../src/tv/premiumDesigns";
import {readFileSync} from 'node:fs';
import {DEFAULT_TV_CONFIG,normalizeTvConfig} from '../src/tv/config';

test('arched fill has one colour picker and saves its colour and shape',async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:1600,height:1000});
 const c=JSON.parse(readFileSync('public/new-shul-catalog.json','utf8'));
 const d=c.designs.find(x=>x.id==='d_rc_walnut_vines');
 const server=await serveEditor(page,{...structuredClone(DEFAULT_TV_CONFIG),...d.values});
 await page.goto('/e2e/harness/editor.html');
 await page.getByRole('tab',{name:'עיצוב',exact:true}).click();
 await page.getByLabel('שכבות האלמנטים',{exact:true}).getByRole('button',{name:'מילוי זמני תפילות',exact:true}).click();
 await expect(page.getByLabel('מילוי בצורת קשת',{exact:true})).toBeChecked();
 const picker=page.getByRole('button',{name:'מילוי האלמנט',exact:true});await expect(picker).toHaveCount(1);await picker.click();
 await page.getByTestId('color-panel').getByLabel('קוד הצבע',{exact:true}).fill('#e8d9b0');
 await page.getByLabel('סגירת בחירת הצבע',{exact:true}).click();
 const id=d.values.elements.find(e=>e.name==='מילוי זמני תפילות').id;
 const fill=page.locator('.tv-frame [data-element-id="'+id+'"] > div').first();
 await expect(fill).toHaveCSS('background-color','rgb(232, 217, 176)');
 await page.getByRole('button',{name:/שמור ושדר/}).first().click();
 await expect.poll(()=>server.writes()).toBeGreaterThan(0);
 await page.reload();await expect(fill).toHaveCSS('background-color','rgb(232, 217, 176)');
 expect(normalizeTvConfig(server.saved()).elements.find(e=>e.id===id)).toMatchObject({archFill:true,fill:'#e8d9b0'});
});

test('image background and frame colour controls are effective, unique and persisted',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:1600,height:1000});
 const catalog=JSON.parse(readFileSync('public/new-shul-catalog.json','utf8'));
 const d=catalog.designs.find(x=>x.id==='d_rc_moon_crown_balanced');
 const server=await serveEditor(page,{...structuredClone(DEFAULT_TV_CONFIG),...d.values});
 await page.goto('/e2e/harness/editor.html');
 await page.getByRole('tab',{name:'עיצוב',exact:true}).click();
 const layers=page.getByLabel('שכבות האלמנטים',{exact:true});
 for(const name of ['רקע היכל כתר הלבנה','מסגרת זמני תפילות']){
  await layers.getByRole('button',{name,exact:true}).click();
  await expect(page.getByTestId('image-colour-tools')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'צבע האלמנט',exact:true})).toHaveCount(0);
  await page.getByLabel('גוון התמונה',{exact:true}).fill('45');
  await page.getByLabel('רוויה בתמונה',{exact:true}).fill('0.7');
  await page.getByLabel('בהירות התמונה',{exact:true}).fill('1.1');
  const id=d.values.elements.find(e=>e.name===name).id;
  await expect(page.locator('.tv-frame [data-element-id="'+id+'"]').first()).toHaveCSS('filter','hue-rotate(45deg) saturate(0.7) brightness(1.1)');
 }
 await page.getByRole('button',{name:/שמור ושדר/}).first().click();
 await expect.poll(()=>server.writes()).toBeGreaterThan(0);
 expect(normalizeTvConfig(server.saved()).elements.filter(e=>e.imageTune)).toHaveLength(2);
 await page.reload();
 const bgId=d.values.elements[0].id;
 await expect(page.locator('.tv-frame [data-element-id="'+bgId+'"]').first()).toHaveCSS('filter','hue-rotate(45deg) saturate(0.7) brightness(1.1)');
 await page.getByRole('tab',{name:'עיצוב',exact:true}).click();
 await layers.getByRole('button',{name:'רקע היכל כתר הלבנה',exact:true}).click();
 await page.getByRole('button',{name:'איפוס צבעוניות התמונה',exact:true}).click();
 await expect(page.locator('.tv-frame [data-element-id="'+bgId+'"]').first()).toHaveCSS('filter','none');
});

for (const occasion of [false, true]) {
  test(`colour of a part, ${occasion ? "on the occasion" : "on the board"}`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await serveEditor(page, structuredClone(PREMIUM_DESIGNS[0].values) as Record<string, unknown>);
    await page.goto("/e2e/harness/editor.html");
    await expect(page.locator(".tv-frame .tv-root").first()).toBeVisible({ timeout: 30_000 });
    if (occasion) {
      const bar = page.getByTestId("part-pages");
      const tab = bar.locator('[data-occasion-tab="cal:rosh_chodesh"]');
      if (await tab.count()) await tab.click();
      else await bar.getByLabel("הוספת מועד לפס").selectOption("cal:rosh_chodesh");
      await page.getByTestId("builtin-designs").locator('[data-design-id="d_premium_rc_night-moon"] button[title^="ממלא"]').click();
    }
    await page.getByRole("button", { name: /עריכה ישירה בלוח/ }).first().click();
    const board = page.locator("[data-board-preview] .tv-frame").first();
    const title = board.locator('[data-free-edit="true"] [data-element-id]').filter({ has: page.locator('[data-content-binding="title"]') }).first();
    await title.click();
    const tools = page.getByTestId("preview-text-tools");
    await expect(tools).toBeVisible();
    const before = await title.evaluate((el) => getComputedStyle(el).color);
    await tools.getByRole("button", { name: /צבע/ }).first().click();
    const panel = page.getByTestId("color-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "צבע #6e1d2f" }).click();
    await expect.poll(() => title.evaluate((el) => getComputedStyle(el).color)).not.toBe(before);
  });
}
