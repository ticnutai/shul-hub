import type { SavedDesign } from './designs';
import { newElement, type BoardElement } from './elements';
import { PREMIUM_DESIGNS } from './premiumDesigns';
import { EMERALD_COMPOSITION } from './emeraldComposition';

// Coordinates are traced against the unchanged 1672 x 941 source paintings.
// Masks separate source pixels; no painted copy of a removed part remains below it.
const W=1672,H=941;
type Bounds=[number,number,number,number];
type Piece={id:string;name:string;bounds:Bounds;path:string;holes:string[]};
const rect=(x:number,y:number,w:number,h:number)=>`M${x} ${y}h${w}v${h}h${-w}Z`;
const round=(x:number,y:number,w:number,h:number,r:number)=>`M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
const ellipse=(x:number,y:number,rx:number,ry:number)=>`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0Z`;
const polygon=(points:number[][],mirror=false)=>points.map(([x,y],i)=>`${i?'L':'M'}${mirror?W-x:x} ${y}`).join('')+'Z';
function make(id:'luminous-ivory'|'royal-sapphire',name:string):SavedDesign {
  const ivory=id==='luminous-ivory';
  const pieces:Piece[]=[];
  const add=(id:string,name:string,bounds:Bounds,path:string,holes:string[]=[])=>pieces.push({id,name,bounds,path,holes});
  const column=ivory ? [[0,0],[159,0],[192,34],[180,72],[168,98],[155,139],[151,695],[161,731],[174,747],[172,781],[167,889],[184,904],[184,926],[0,926],[0,891],[15,875],[15,787],[6,781],[6,756],[22,743],[37,710],[45,139],[23,120],[12,73],[0,52]] : [[0,0],[121,0],[123,20],[111,30],[110,63],[96,118],[95,686],[105,696],[105,718],[117,730],[119,900],[124,906],[124,941],[0,941]];
  const leftColumn=polygon(column),rightColumn=polygon(column,true);
  const clockOuter=ivory?ellipse(835,105,107,106):ellipse(836,210,142,130);
  const clockInner=ivory?ellipse(835,105,87,88):ellipse(836,210,119,106);
  const crown=ivory?'M0 0H1672V176H1202Q1080 5 835 0Q593 5 470 176H222V250H0Z':'M0 0H1672V332L1536 312Q1480 167 1170 175Q1120 130 974 111Q836 65 693 113Q533 126 490 175Q282 171 156 323L0 332Z';
  add('crown',ivory?'קשת עליונה ותאורה':'כתר עליון ווילונות',[0,0,W,ivory?250:332],crown,[leftColumn,rightColumn,clockOuter]);
  if(!ivory){
    add('innerleft','עמוד פנימי שמאל',[484,157,79,632], 'M490 157H560V182L548 199L545 681L555 707L561 787H486V735L496 685L500 205L489 186Z');
    add('innerright','עמוד פנימי ימין',[1110,157,79,632], 'M1110 157H1184V186L1172 205L1177 685L1187 735V787H1111L1117 707L1127 681L1124 199L1112 182Z');
  }
  const sideOut=(right:boolean)=>{
    const x=ivory?(right?1166:170):(right?1173:128);
    if(ivory)return `M${x-8} 751V299Q${x-8} 258 ${x+34} 237Q${x+59} 169 ${x+167} 169Q${x+273} 169 ${x+306} 237Q${x+344} 256 ${x+344} 299V751Q${x+344} 778 ${x+310} 778H${x+26}Q${x-8} 778 ${x-8} 751Z`;
    return `M${x-8} 729V321Q${x+18} 314 ${x+22} 294H${x+49}Q${x+99} 228 ${x+185} 228Q${x+280} 228 ${x+334} 294H${x+354}Q${x+362} 314 ${x+379} 321V732Q${x+358} 746 ${x+350} 769H${x+20}Q${x+11} 743 ${x-8} 729Z`;
  };
  for(const right of [false,true]){
    const tag=right?'right':'left',label=right?'שיעורים':'תפילות';
    const x=ivory?(right?1166:170):(right?1173:128), width=ivory?336:371;
    const outside=sideOut(right);
    const inside=ivory?round(x+25,295,286,447,38):`M${x+23} 344Q${x+43} 340 ${x+47} 326H${x+320}Q${x+327} 339 ${x+346} 344V712Q${x+329} 723 ${x+324} 736H${x+44}Q${x+39} 722 ${x+23} 712Z`;
    const lines=ivory?rect(x+42,396,249,38)+rect(x+42,523,254,6)+rect(x+42,610,254,6):rect(x+51,389,269,31)+rect(x+35,439,301,7)+rect(x+30,546,306,7)+rect(x+35,622,305,7)+rect(x+35,711,302,7);
    add(`${tag}_fill`,`מילוי ${label}`,[x,ivory?177:237,width,ivory?593:523],inside,[lines]);
    add(`${tag}_rules`,`עיטורי שורות ${label}`,[x,389,width,329],lines);
    add(`${tag}_frame`,`מסגרת ${label} מהמקור`,[x-8,ivory?169:228,width+16,ivory?609:541],outside,[inside]);
    // Top architecture must not retain a duplicate of the arched panel.
    pieces[0].holes.push(outside);
  }
  const mainOuter=ivory?round(512,297,645,517,54):'M550 266Q575 260 579 237H1090Q1097 259 1120 265V787H549Z';
  const mainInner=ivory?round(530,314,610,482,37):'M565 280Q588 274 592 256H1077Q1083 273 1106 280V779H565Z';
  const still=ivory?polygon([[565,797],[566,759],[578,721],[594,684],[598,636],[590,624],[595,607],[600,565],[606,535],[616,535],[626,558],[631,606],[642,615],[636,638],[632,676],[645,720],[647,683],[646,637],[640,625],[648,609],[649,563],[658,536],[669,535],[678,559],[679,609],[690,618],[682,640],[681,679],[695,722],[698,690],[711,661],[724,663],[725,682],[740,670],[744,681],[769,665],[777,675],[812,668],[832,660],[840,665],[866,659],[861,676],[843,694],[1026,711],[1022,785],[1002,799]]) : polygon([[570,778],[574,739],[584,699],[600,662],[602,623],[588,607],[594,589],[600,547],[605,514],[617,511],[628,533],[629,589],[640,604],[628,623],[629,658],[648,701],[649,643],[640,625],[649,603],[651,571],[659,535],[669,535],[679,560],[681,603],[697,619],[685,640],[683,674],[697,688],[700,649],[715,629],[725,634],[730,654],[752,633],[759,641],[778,628],[784,640],[807,636],[815,632],[827,644],[854,643],[865,653],[825,669],[1077,672],[1077,689],[1065,731],[1084,754],[1106,779]]);
  const divider=ivory?rect(671,468,346,47):rect(675,460,324,35);
  add('main_fill','מילוי התיבה המרכזית',[ivory?512:549,ivory?297:237,ivory?645:571,ivory?517:550],mainInner,[still,divider,clockOuter]);
  add('main_rule','עיטור מרכזי נפרד',[671,460,346,55],divider);
  add('still','פמוטים ספר וענף — קבוצת קישוט',[565,ivory?535:511,ivory?463:542,ivory?264:268],still);
  add('main_frame','מסגרת מרכזית מהמקור',[ivory?512:549,ivory?297:237,ivory?645:571,ivory?517:550],mainOuter,[mainInner,clockOuter]);
  if(ivory){
    const outer=round(518,189,637,106,46),inner=round(539,205,593,76,26);
    add('title_fill','מילוי כותרת',[518,189,637,106],inner,[clockOuter]);
    add('title_frame','מסגרת כותרת',[518,189,637,106],outer,[inner,clockOuter]);
  }
  const clockOrnaments=ivory?'':rect(812,117,51,48)+rect(806,253,59,45);
  add('clock_fill','פני שעון',[ivory?728:694,ivory?0:80,ivory?214:284,ivory?211:260],clockInner,clockOrnaments?[clockOrnaments]:[]);
  if(clockOrnaments)add('clock_details','עיטורי פני השעון',[806,117,59,181],clockOrnaments);
  add('clock_rim','מסגרת שעון',[ivory?728:694,ivory?0:80,ivory?214:284,ivory?211:260],clockOuter,[clockInner]);
  add('base','בסיס תחתון',[0,ivory?811:784,W,ivory?130:157],rect(0,ivory?811:784,W,ivory?130:157),[leftColumn,rightColumn,mainOuter]);
  add('column_left','עמוד שמאל מהמקור',[0,0,ivory?192:124,H],leftColumn);
  add('column_right','עמוד ימין מהמקור',[W-(ivory?192:124),0,ivory?192:124,H],rightColumn);
  const background:Piece={id:'wall',name:'רקע המקור ללא חלקי העיצוב',bounds:[0,0,W,H],path:rect(0,0,W,H),holes:pieces.map(p=>p.path)};
  const elements:BoardElement[]=[background,...pieces].map(p=>({
    ...newElement('image'),id:`original_${ivory?'ivory':'sapphire'}_${p.id}`,name:p.name,
    x:p.bounds[0]/W*100,y:p.bounds[1]/H*100,width:p.bounds[2]/W*100,height:p.bounds[3]/H*100,
    image:`/new-shul-assets/${id}.webp`,crop:{x:p.bounds[0]/W*100,y:p.bounds[1]/H*100,width:p.bounds[2]/W*100,height:p.bounds[3]/H*100},
    sourceMask:{width:W,height:H,path:p.path,holes:p.holes},
  }));
  const original=PREMIUM_DESIGNS.find(d=>d.id===`d_premium_${id}`)!;
  elements.push(...original.values.elements!.filter(e=>e.kind==='text').map(e=>({...structuredClone(e),id:`original_${ivory?'ivory':'sapphire'}_${e.id.split('_').at(-1)}`,...(e.name==='שם בית הכנסת'?{binding:'title' as const,fontSize:ivory?3.3:2.6}:{}),...(e.binding==='prayers'?{rowsPerPage:3,fontSize:ivory?2.5:2.7}:{}),...(e.binding==='lessons'?{rowsPerPage:3,fontSize:ivory?2.8:2.9}:{}),...(e.name==='שורת תחתית'?{binding:'footer' as const,fontSize:2.1}: {})})));
  return {id:ivory?'d_ivorylayers':'d_sapphirelayers',name,parts:['background','frames','text','layout'],theme:original.theme,colours:original.colours,
    values:{...structuredClone(EMERALD_COMPOSITION.values),elements,font:'traditional',backgroundImage:`/new-shul-assets/${id}-repair.webp`,backgroundGradient:null}};
}
export const ORIGINAL_LAYER_DESIGNS=[make('luminous-ivory','שיש מואר · המקור בשכבות'),make('royal-sapphire','ספיר מלכותי · המקור בשכבות')];
