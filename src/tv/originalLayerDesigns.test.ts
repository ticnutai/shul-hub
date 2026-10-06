import {describe,it,expect} from 'vitest';
import {ORIGINAL_LAYER_DESIGNS} from './originalLayerDesigns';
import {normalizeElements,newElement} from './elements';
import {normalizeTvConfig} from './config';
import {workspaceDocument,parseWorkspace,applyAppearance} from './workspaceTransfer';

describe('Original artwork masks',()=>{
  it('preserves every mask, cutout and live binding through a versioned transfer',async()=>{
    for(const d of ORIGINAL_LAYER_DESIGNS){
      const doc=workspaceDocument(applyAppearance(normalizeTvConfig({}),normalizeTvConfig(d.values)));
      expect(doc.version).toBe(3);
      const result=await parseWorkspace(JSON.stringify(doc),async()=>'');
      expect(result.elements).toEqual(d.values.elements);
      expect(result.elements.filter(e=>e.sourceMask).length).toBeGreaterThan(15);
      const frame=result.elements.find(e=>e.id.endsWith('_left_frame'))!;
      const fill=result.elements.find(e=>e.id.endsWith('_left_fill'))!;
      expect(frame.sourceMask!.holes).toContain(fill.sourceMask!.path);
      expect(result.elements.find(e=>e.id.endsWith('_wall'))!.sourceMask!.holes).toContain(frame.sourceMask!.path);
    }
  });
  it('rejects non-path markup, oversized paths and invalid source bounds',()=>{
    const base={...newElement('image'),sourceMask:{width:1672,height:941,path:'M0 0H100V100Z',holes:[]}};
    expect(normalizeElements([base])[0].sourceMask).toEqual(base.sourceMask);
    for(const patch of [{path:'<script>alert(1)</script>'},{path:'M'.repeat(20001)},{width:Infinity},{height:-1},{holes:['url(https://example.com)']}])
      expect(normalizeElements([{...base,sourceMask:{...base.sourceMask,...patch}}])[0].sourceMask).toBeUndefined();
  });
});
