import type { SavedDesign } from './designs';
import { newElement, type BoardElement } from './elements';

const elements:BoardElement[]=[];
const add=(id:string,kind:BoardElement['kind'],name:string,x:number,y:number,width:number,height:number,extra:Partial<BoardElement>={})=>elements.push({...newElement(kind),id:`emerald_${id}`,name,x,y,width,height,...extra});
for(const [id,x] of [['left',1.5],['right',91.5]] as const){
  add(id,'image',`עמוד ${id==='left'?'שמאל':'ימין'} עצמאי`,x,3,7,94,{image:'/new-shul-assets/emerald-independent-column.webp',crop:{x:36,y:0,width:28,height:100}});
}
const panel=(id:string,name:string,x:number,y:number,w:number,h:number)=>{
  add(`${id}_fill`,'box',`מילוי ${name}`,x+.5,y+.8,w-1,h-1.6,{fill:'#0a2923',color:'transparent'});
  add(`${id}_frame`,'frame',`מסגרת ${name}`,x,y,w,h,{image:'/new-shul-assets/emerald-modular-frame.webp'});
};
panel('prayers','תפילות',64,24,25,64);
panel('zmanim','זמני היום',11,24,25,64);
panel('lessons','שיעורים',38.5,49,23,39);
const text=(id:string,name:string,x:number,y:number,w:number,h:number,size:number,extra:Partial<BoardElement>)=>add(id,'text',name,x,y,w,h,{fontSize:size,color:'#f8edcf',...extra});
text('title','שם בית הכנסת',20,4,60,9,5.8,{binding:'title',color:'#ebcf8c'});
text('date','תאריך חי',30,14,40,4,2.5,{binding:'date'});
add('crown','ornament','עיטור כותרת',42,18,16,4,{color:'#c9a45d'});
text('prayers_heading','כותרת תפילות',67,27,19,5,3.1,{text:'זמני תפילות',color:'#ebcf8c'});
text('prayers','תפילות היום',66.5,34,20,50,2.15,{binding:'prayers',rowsPerPage:14});
text('zmanim_heading','כותרת זמנים',14,27,19,5,3.1,{text:'זמני היום',color:'#ebcf8c'});
text('zmanim','זמנים חיים',14,36,19,45,2.55,{binding:'zmanim',rowsPerPage:8});
text('clock','שעון חי',39,26,22,13,9,{binding:'clock',color:'#ebcf8c'});
text('logos','לוגואים קיימים',44,39,12,6,2,{binding:'logos'});
text('lessons_heading','כותרת שיעורים',42,52,16,5,3.1,{text:'שיעורי תורה',color:'#ebcf8c'});
text('lessons','שיעורים חיים',41,59,18,24,2.1,{binding:'lessons',rowsPerPage:4});
text('footer','פרשה ולימוד יומי',12,91,76,4.5,1.75,{binding:'footer'});
text('notices','הודעות נוכחיות',28,96,44,3,1.6,{binding:'announcements',color:'#b8c9bf'});

export const EMERALD_COMPOSITION:SavedDesign={
  id:'d_emeraldclean',name:'אמרלד · הרכבה נקייה ועצמאית',theme:'forest',parts:['background','frames','text','layout'],
  colours:{'--tv-bg-a':'#061a15','--tv-bg-b':'#14392c','--tv-bg-c':'#071d18','--tv-text':'#f8edcf','--tv-accent':'#ebcf8c'},
  values:{screenLayout:'composition',elements,backgroundImage:null,backgroundGradient:'radial-gradient(ellipse at 50% 5%, #214f3d, #071d18 70%)',backgroundOverlay:null,backgroundDim:0,
    backgroundTune:{brightness:1,saturation:1,hue:0,blur:0,tint:null,tintStrength:0},boardFrame:null,boardFrameImage:null,
    boardFrameTune:{size:1,length:1,x:0,y:0,sides:'both'},frame:{shape:'round',top:0,bottom:0},
    frameStyle:{fill:null,fillOpacity:1,line:null,lineWidth:0,depth:0,image:null,imageSlice:20,imageWidth:0},frameLooks:{},styles:{},font:'classic',titleStyle:'plain',tracking:null,textScale:1,clockStyle:'digital',spacing:{top:0,bottom:0,sides:0,gap:0}},
};
