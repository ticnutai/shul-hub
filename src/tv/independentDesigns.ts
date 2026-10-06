import type {SavedDesign} from './designs';
import {newElement,type BoardElement} from './elements';
import {EMERALD_COMPOSITION} from './emeraldComposition';
import {ZMAN_DISPLAY_KEYS} from '@/community/lib/zmanim';

const choices=[
  {id:'copperhall',name:'היכל נחושת · חלקים עצמאיים',ink:'#452d25',accent:'#a8663c',fill:'#fff7e9',bg:'linear-gradient(135deg, #eee0c9, #fffaf0 45%, #ddc4a5)',frame:'',modern:false,
    prayers:[64,25,27,62],lessons:[9,25,27,62],notices:[39,49,22,38],clock:[39,26,22,18]},
  {id:'platinumnight',name:'לילה ופלטינה · חלקים עצמאיים',ink:'#e4f0ff',accent:'#bacfe6',fill:'#101f35',bg:'radial-gradient(ellipse at 50% 0%, #284d6a, #07121f 75%)',frame:'/new-shul-assets/sapphire-modular-panel-frame.webp',modern:false,
    prayers:[65,25,27,63],lessons:[8,25,27,37],notices:[8,65,27,23],clock:[39,30,22,23]},
  {id:'lightminimal',name:'אור מינימלי · חלקים עצמאיים',ink:'#183a3d',accent:'#287d78',fill:'#ffffff',bg:'linear-gradient(120deg, #dcece6, #f7faf5 55%, #e8e3d7)',frame:'',modern:true,
    prayers:[54,25,41,64],lessons:[5,25,45,32],notices:[5,61,45,28],clock:[5,7,22,12]},
] as const;

export const INDEPENDENT_DESIGNS:SavedDesign[]=choices.map(p=>{
  const elements:BoardElement[]=[];
  const add=(key:string,kind:BoardElement['kind'],name:string,rect:readonly number[],extra:Partial<BoardElement>={})=>{
    const [x,y,width,height]=rect;
    elements.push({...newElement(kind),id:`${p.id}_${key}`,kind,name,x,y,width,height,color:p.accent,fill:'transparent',...extra});
  };
  const text=(key:string,name:string,rect:readonly number[],fontSize:number,extra:Partial<BoardElement>)=>add(key,'text',name,rect,{color:p.ink,fontSize,...extra});
  const panel=(key:string,name:string,r:readonly number[],binding:BoardElement['binding'],rows:number)=>{
    const [x,y,w,h]=r;
    add(key+'_fill','box','מילוי '+name,[x+.5,y+.8,w-1,h-1.6],{fill:p.fill,color:'transparent'});
    add(key+'_frame','frame','מסגרת '+name,r,{image:p.frame});
    text(key+'_heading','כותרת '+name,[x+2,y+2,w-4,5],3.2,{text:name,color:p.accent});
    if(!p.modern)add(key+'_ornament','ornament','עיטור '+name,[x+w*.3,y+8,w*.4,3]);
    text(key+'_content','תוכן '+name,[x+2.5,y+(p.modern?10:13),w-5,h-(p.modern?13:17)],binding==='announcements'?2.1:2.6,{binding,rowsPerPage:rows});
  };
  if(!p.modern){
    add('column_left','column','עמוד שמאל',[1.2,4,5,91]);
    add('column_right','column','עמוד ימין',[93.8,4,5,91]);
    add('crown','ornament','עיטור כותרת',[40,18,20,5]);
  }else{
    add('header_fill','box','פס כותרת',[30,5,65,15],{fill:'#edf5ef',color:'transparent'});
  }
  text('title','שם בית הכנסת',p.modern?[32,7,60,7]:[16,5,68,8],4.7,{binding:'title'});
  text('date','תאריך עברי',p.modern?[40,15,44,4]:[30,14,40,4],2.3,{binding:'date'});
  panel('prayers','זמני תפילות',p.prayers,'prayers',p.modern?7:6);
  panel('zmanim','זמני היום',p.modern?[5,25,23,64]:[8,25,27,63],'zmanim',13);
  const z=elements.at(-1)!;z.zmanKeys=[...ZMAN_DISPLAY_KEYS];z.fontSize=1.75;
  panel('lessons','שיעורי תורה',p.modern?[31,25,20,32]:[38,49,24,22],'lessons',2);
  panel('notices','הודעות',p.modern?[31,61,20,28]:[38,73,24,15],'announcements',3);
  // Compact panels reserve room for real content rather than an extra ornament.
  for(const kind of ['lessons','notices']){
    const content=elements.find(e=>e.id===`${p.id}_${kind}_content`)!;
    const frame=elements.find(e=>e.id===`${p.id}_${kind}_frame`)!;
    content.y=frame.y+8;content.height=frame.height-10;content.fontSize=kind==='notices'?1.6:1.8;
    elements.splice(elements.findIndex(e=>e.id===`${p.id}_${kind}_ornament`),elements.some(e=>e.id===`${p.id}_${kind}_ornament`)?1:0);
  }
  text('clock','שעון חי',p.clock,p.id==='platinumnight'?9:8,{binding:p.id==='platinumnight'?'analog':'clock',color:p.accent});
  if(p.id==='platinumnight'){
    const clock=elements.find(e=>e.id===`${p.id}_clock`)!;clock.y=26;clock.height=19;
  }
  text('parasha','פרשת השבוע',p.modern?[31,20,20,4]:[38,45,24,4],1.9,{binding:'parasha',color:p.accent});
  text('footer','פרשה ולימוד יומי',[9,92,82,5],1.8,{binding:'footer'});
  return {id:`d_${p.id}`,name:p.name,theme:p.id==='platinumnight'?'navy':'stone',parts:['background','frames','text','layout'],
    colours:{'--tv-text':p.ink,'--tv-accent':p.accent},
    values:{...structuredClone(EMERALD_COMPOSITION.values),elements,backgroundGradient:p.bg,backgroundImage:null,font:p.modern?'classic':'traditional'}};
});
