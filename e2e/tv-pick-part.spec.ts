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
  await expect(ticked('תמונת ירח')).toBeChecked();
  // Parts over one another: once, how to reach the ones under.
  await expect(page.getByText('לחיצה נוספת באותו מקום בוחרת את החלק שמתחת', { exact: false })).toBeVisible();

  // Again at the same place, a moment later: the box under it, alone.
  await page.waitForTimeout(700);
  at = await moon();
  await page.mouse.click(at.x, at.y);
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
