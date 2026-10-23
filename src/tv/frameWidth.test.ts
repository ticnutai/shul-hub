import { describe, expect, it } from 'vitest';
import { newElement, normalizeElements, setFrameWidth } from './elements';
const f = { ...newElement('frame'), id: 'f1' }, b = { ...newElement('box'), id: 'b1' };
describe('frame thickness', () => {
  it('sets only frames, clamped 0.25–4', () => {
    const out = setFrameWidth([f, b], ['f1', 'b1'], 9);
    expect(out[0].frameWidth).toBe(4); expect(out[1].frameWidth).toBeUndefined();
    expect(setFrameWidth([f], ['f1'], 0)[0].frameWidth).toBe(.25);
  });
  it('natural thickness (1) is stored as absent and survives normalizing', () => {
    expect(setFrameWidth([{ ...f, frameWidth: 2 }], ['f1'], 1)[0].frameWidth).toBeUndefined();
    expect(normalizeElements([{ ...f, frameWidth: 1.6 }])[0].frameWidth).toBe(1.6);
  });
});
