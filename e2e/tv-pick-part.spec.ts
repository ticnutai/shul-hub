import { expect, test } from '@playwright/test';
import { serveEditor, settled } from './support/tvEditor';
import { DEFAULT_TV_CONFIG, normalizeTvConfig } from '../src/tv/config';
import { newElement, type BoardElement } from '../src/tv/elements';

/*
 * A moon picture over a box, the box in a frame - one section (one group), as
 * imported artwork stands. Pressing the moon must choose the moon, pressing
 * again the box under it, a right click lists all three, and Alt + click
 * takes the moon alone, to drag without its frame.
 */
const part = (id: string, kind: BoardElement['kind'], name: string, x: number, y: number, width: number, height: number, more: Partial<BoardElement> = {}): BoardElement =>
  ({ ...newElement(kind), id, name, x, y, width, height, group: 'moon_section', ...more });
const ELEMENTS = [
  part('pick_frame', 'frame', 'קנט עליון', 20, 20, 40, 50),
  part('pick_box', 'box', 'תיבת רקע', 25, 25, 30, 40),
  part('pick_moon', 'image', 'תמונת ירח', 35, 35, 10, 15, { image: '/new-shul-assets/catalog-antique-natural-moon.svg' }),
];

test('a part under another is chosen: on top, one down, from the list, alone', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const server = await serveEditor(page, { ...structuredClone(DEFAULT_TV_CONFIG), elements: ELEMENTS });
  await page.goto('/e2e/harness/editor.html');
  await page.getByRole('tab', { name: 'עיצוב', exact: true }).click();
  const board = page.getByTestId('elements-canvas');
  await board.scrollIntoViewIfNeeded();
  await settled(board);
  // The middle of the moon, on the screen. Measured anew each time: choosing a part
  // opens its measurements above the board, and the board then stands lower.
  const moon = async () => { const b = (await board.boundingBox())!; return { x: b.x + b.width * .40, y: b.y + b.height * .425, width: b.width }; };
  let at = await moon();
  const name = page.getByLabel('שם החלק', { exact: true });
  const ticked = (n: string) => page.getByLabel('שכבות החלקים', { exact: true }).getByRole('checkbox', { name: `בחירת ${n}`, exact: true });

  // A press: the moon, on top - with its section, but the moon is the part shown.
  await page.mouse.click(at.x, at.y);
  await expect(name).toHaveValue('תמונת ירח');
  // Again at the same place, a moment later (within the second and a half): the box under it, alone.
  at = await moon();
  await page.waitForTimeout(700);
  await page.mouse.click(at.x, at.y);
  // Parts over one another: once, how to reach the ones under.
  await expect(page.getByText('לחיצה נוספת באותו מקום בוחרת את החלק שמתחת', { exact: false })).toBeVisible();
  await expect(name).toHaveValue('תיבת רקע');
  await expect(ticked('תיבת רקע')).toBeChecked();
  await expect(ticked('תמונת ירח')).not.toBeChecked();
  await expect(ticked('קנט עליון')).not.toBeChecked();

  // A right click: every part there, top to bottom; the frame chosen from it.
  await page.mouse.click(at.x, at.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'בחירת חלק' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['תמונת ירח', /^תיבת רקע/, 'קנט עליון']);
  await menu.getByRole('menuitem', { name: 'קנט עליון', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(name).toHaveValue('קנט עליון');
  await expect(ticked('קנט עליון')).toBeChecked();
  await expect(ticked('תיבת רקע')).not.toBeChecked();

  // The list closes with Esc as well.
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  // Alt + click: the moon alone, and dragging it moves only the moon.
  await page.waitForTimeout(1600);
  at = await moon();
  await page.keyboard.down('Alt');
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await expect(name).toHaveValue('תמונת ירח');
  await expect(ticked('תמונת ירח')).toBeChecked();
  await expect(ticked('תיבת רקע')).not.toBeChecked();
  await expect(ticked('קנט עליון')).not.toBeChecked();
  await page.mouse.move(at.x + at.width * .1, at.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Alt');

  await page.getByRole('button', { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved()).elements;
  const of = (id: string) => saved.find(e => e.id === id)!;
  expect(of('pick_moon').x).toBeGreaterThan(40);
  expect(of('pick_box').x).toBe(25);
  expect(of('pick_frame').x).toBe(20);
  expect(errors).toEqual([]);
});

test('a part chosen alone stays alone under the mouse, until clicked again or Esc', async ({ page }) => {
  // As asked: chosen from the right click's list, the arrows moved it alone - and the mouse
  // must as well, not take its frame and box with it again. Also a part under another.
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const server = await serveEditor(page, { ...structuredClone(DEFAULT_TV_CONFIG), elements: ELEMENTS });
  await page.goto('/e2e/harness/editor.html');
  await page.getByRole('tab', { name: 'עיצוב', exact: true }).click();
  const board = page.getByTestId('elements-canvas');
  await board.scrollIntoViewIfNeeded();
  await settled(board);
  const moon = async () => { const b = (await board.boundingBox())!; return { x: b.x + b.width * .40, y: b.y + b.height * .425, width: b.width }; };
  const ticked = (n: string) => page.getByLabel('שכבות החלקים', { exact: true }).getByRole('checkbox', { name: `בחירת ${n}`, exact: true });
  const menu = page.getByRole('menu', { name: 'בחירת חלק' });
  const drag = async (by: number, from = 0) => {
    const at = await moon();
    at.x += at.width * from;
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + at.width * by, at.y, { steps: 6 });
    await page.mouse.up();
  };

  // The moon from the list, then dragged by the mouse alone: it stays the only one chosen.
  let at = await moon();
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await menu.getByRole('menuitem', { name: 'תמונת ירח', exact: true }).click();
  await drag(.1);
  await expect(ticked('תמונת ירח')).toBeChecked();
  await expect(ticked('תיבת רקע')).not.toBeChecked();
  await expect(ticked('קנט עליון')).not.toBeChecked();
  // And again, where it now stands: still alone.
  await page.waitForTimeout(1600);
  await drag(.05, .1);
  await expect(ticked('תיבת רקע')).not.toBeChecked();

  // The box, under the moon, from the list: pressing where the moon stands drags the box alone.
  await page.waitForTimeout(1600);
  at = await moon();
  await page.mouse.click(at.x - at.width * .06, at.y, { button: 'right' });
  await menu.getByRole('menuitem', { name: /^תיבת רקע/ }).click();
  await page.waitForTimeout(1600);
  const b = (await board.boundingBox())!;
  const boxAt = { x: b.x + b.width * .27, y: b.y + b.height * .3 };
  await page.mouse.move(boxAt.x, boxAt.y);
  await page.mouse.down();
  await page.mouse.move(boxAt.x, boxAt.y + b.height * .05, { steps: 6 });
  await page.mouse.up();
  await expect(ticked('תיבת רקע')).toBeChecked();
  await expect(ticked('קנט עליון')).not.toBeChecked();

  // A click on it, without dragging: its whole section again.
  await page.waitForTimeout(1600);
  await page.mouse.click(boxAt.x, boxAt.y + b.height * .05);
  await expect(ticked('תיבת רקע')).toBeChecked();
  await expect(ticked('קנט עליון')).toBeChecked();
  await expect(ticked('תמונת ירח')).toBeChecked();
  // Esc lets go of everything.
  await board.focus();
  await page.keyboard.press('Escape');
  await expect(ticked('תיבת רקע')).not.toBeChecked();

  await page.getByRole('button', { name: /שמור ושדר/ }).first().click();
  await expect.poll(() => server.writes()).toBeGreaterThan(0);
  const saved = normalizeTvConfig(server.saved()).elements;
  const of = (id: string) => saved.find(e => e.id === id)!;
  expect(of('pick_moon').x).toBeGreaterThan(44);
  expect(of('pick_box').x).toBe(25);
  expect(of('pick_box').y).toBeGreaterThan(28);
  expect(of('pick_frame').x).toBe(20);
  expect(of('pick_frame').y).toBe(20);
  expect(errors).toEqual([]);
});
