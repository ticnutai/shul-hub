import {it,expect} from 'vitest';
import {newElement,resizeElements,exportElementSet,importElementSet} from './elements';
import {setSectionShape,sectionGeometry,linkedSection,gridDelta,SECTION_SHAPES} from './sectionGeometry';
const all=[
 {...newElement('box'),id:'fill',name:'מילוי תפילות',x:12,y:22,width:26,height:56},
 {...newElement('image'),id:'frame',name:'מסגרת תפילות',x:10,y:20,width:30,height:60,image:'/new-shul-assets/catalog-silver-acanthus-frame.png'},
 {...newElement('text'),id:'heading',x:15,y:30,width:20,height:5,text:'תפילות'},
 {...newElement('text'),id:'body',x:15,y:40,width:20,height:25,binding:'prayers' as const},
 {...newElement('text'),id:'other',x:70,y:10,width:20,height:10},
];
it('finds frame from its inset fill and fits separate content to each shape',()=>{
 expect(linkedSection(all,'fill')).toEqual(['fill','frame','heading','body']);
 for(const shape of Object.keys(SECTION_SHAPES) as (keyof typeof SECTION_SHAPES)[]){
  const next=setSectionShape(all,'fill',shape);
  expect(next[0].shape).toBe(shape);expect(next[1].shape).toBe(shape);
  expect(next[1].kind).toBe('frame');expect(next[1].image).toBe('');
  expect(next[3].binding).toBe('prayers');expect(next[2].y+next[2].height).toBeLessThanOrEqual(next[3].y);
  expect(next[4]).toMatchObject(all[4]);
  expect(importElementSet(exportElementSet(next))[0].shape).toBe(shape);
 }
});
it('resizes and rotates the whole section from either member, preserving circle ratio',()=>{
 const circle=setSectionShape(all,'frame','circle');
 expect(circle[1].width/circle[1].height).toBeCloseTo(9/16);
 const resized=sectionGeometry(circle,'fill','width',20);
 expect(resized[1].width).toBeCloseTo(20);expect(resized[0].width).toBeCloseTo(20);
 const drag=resizeElements(resized,['fill','frame','heading','body'],'e',3,0);
 expect(drag[1].width/drag[1].height).toBeCloseTo(9/16);
 const rotated=sectionGeometry(resized,'frame','rotation',15);
 expect(rotated.slice(0,4).every(e=>e.rotation===15)).toBe(true);
 expect(rotated[4]).toMatchObject(all[4]);
 expect(setSectionShape(all.map(e=>e.id==='body'?{...e,locked:true}:e),'fill','circle')[0].shape).toBeUndefined();
 expect(gridDelta(12,1,5)).toBe(3);expect(gridDelta(12,-1,5)).toBe(-2);
});
