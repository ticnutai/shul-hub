import {boundsOf,normalizeElements,resizeElements,sectionOf,type BoardElement} from './elements';
import {PART_SHAPES} from './partShapes';
/** The shapes of a box and its frame, by name - the board's one list (partShapes.ts). */
export const SECTION_SHAPES=Object.fromEntries(PART_SHAPES.map(s=>[s.id,s.name])) as Record<(typeof PART_SHAPES)[number]['id'],string>;
/** Imported artwork often stores the smaller fill immediately before its larger frame. */
export function linkedSection(all:BoardElement[],id:string){
 const ids=new Set(sectionOf(all,id));
 for(const e of all.filter(e=>ids.has(e.id))){
  const name=e.name.startsWith('מילוי ')?e.name.replace(/^מילוי /,'מסגרת '):e.name.startsWith('מסגרת ')?e.name.replace(/^מסגרת /,'מילוי '):null;
  const candidates=all.filter(x=>x.name===name&&Math.abs(x.x-e.x)<e.width/2&&Math.abs(x.y-e.y)<e.height/2);
  candidates.sort((a,b)=>(Math.abs(a.x-e.x)+Math.abs(a.y-e.y))-(Math.abs(b.x-e.x)+Math.abs(b.y-e.y)));
  if(candidates[0])for(const x of sectionOf(all,candidates[0].id))ids.add(x);
 }
 return all.filter(e=>ids.has(e.id)).map(e=>e.id);
}
export function setSectionShape(all:BoardElement[],id:string,shape:NonNullable<BoardElement['shape']>){
 const ids=linkedSection(all,id),own=all.filter(e=>ids.includes(e.id));
 if(!own.length||own.some(e=>e.locked))return all;
 const b=boundsOf(all,ids),group=own[0].group??'shape_'+own[0].id.slice(0,70);
 // Coordinates use a 16:9 design surface: a circular pixel shape needs unequal percent dimensions.
 if(shape==='circle'){const width=Math.min(b.width,b.height*9/16);b.width=width;b.height=width*16/9;}
 const texts=own.filter(e=>e.kind==='text');
 const tb=texts.length?boundsOf(all,texts.map(e=>e.id)):b;
 const inset=shape==='diamond'?.29:shape==='circle'||shape==='ellipse'?.22:shape==='hexagon'||shape==='octagon'?.17:shape==='pill'?.15:.12;
 const top=shape==='arch'||shape==='onion'||shape==='lancet'?.27:shape==='dome'?.22:inset;
 return normalizeElements(all.map(e=>{
  if(!ids.includes(e.id))return e;
  if(e.kind==='text'){
   const sx=b.width*(1-2*inset)/tb.width,sy=b.height*(1-top-inset)/tb.height;
   return {...e,group,rotation:0,x:b.x+b.width*inset+(e.x-tb.x)*sx,width:e.width*sx,y:b.y+b.height*top+(e.y-tb.y)*sy,height:e.height*sy};
  }
  // A picture of one's own in the section (not a piece of a kit's painting): cut to the same shape, where it stands.
  if(e.kind==='image'&&e.image&&!e.crop&&!e.sourceMask&&!/^(מסגרת|מילוי) /.test(e.name))return {...e,group,shape};
  if(e.kind==='box'||e.kind==='frame'||(e.kind==='image'&&/^(מסגרת|מילוי) /.test(e.name))){
   const frame=e.kind==='frame'||e.name.startsWith('מסגרת');
   return {...e,...b,group,rotation:0,kind:frame?'frame':'box',shape,image:'',crop:undefined,sourceMask:undefined,imageTune:undefined,archFill:undefined,fill:frame?'transparent':e.fill==='transparent'?'#fff5dc':e.fill};
  }
  return {...e,group};
 }));
}
export function sectionGeometry(all:BoardElement[],id:string,key:'width'|'height'|'rotation',value:number){
 const ids=linkedSection(all,id),anchor=all.find(e=>e.id===id);
 if(!anchor||ids.some(id=>all.find(e=>e.id===id)?.locked))return all;
 const b=boundsOf(all,ids);
 if(key!=='rotation'){
  const ratio=value/anchor[key],circle=all.some(e=>ids.includes(e.id)&&e.shape==='circle');
  return normalizeElements(resizeElements(all,ids,'se',key==='width'||circle?b.width*(ratio-1):0,key==='height'||circle?b.height*(ratio-1):0));
 }
 const rad=(value-anchor.rotation)*Math.PI/180,cx=(b.x+b.width/2)*16/9,cy=b.y+b.height/2;
 const rotated=all.map(e=>{if(!ids.includes(e.id))return e;const x=(e.x+e.width/2)*16/9-cx,y=e.y+e.height/2-cy;return {...e,x:(cx+x*Math.cos(rad)-y*Math.sin(rad))*9/16-e.width/2,y:cy+x*Math.sin(rad)+y*Math.cos(rad)-e.height/2,rotation:((e.rotation+value-anchor.rotation+540)%360)-180};});
 // Never let normalization clamp individual members and tear the section apart.
 if(rotated.some(e=>ids.includes(e.id)&&(e.x<0||e.y<0||e.x+e.width>100||e.y+e.height>100)))return all;
 return normalizeElements(rotated);
}
export function gridDelta(start:number,delta:number,step:number){return Math.round((start+delta)/step)*step-start;}
