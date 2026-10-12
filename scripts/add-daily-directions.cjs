const fs=require('node:fs'),file='public/new-shul-catalog.json';
const c=JSON.parse(fs.readFileSync(file,'utf8'));
const base=c.designs.find(d=>d.id==='d_rc_moon_crown_balanced');
const keys=base.values.elements.find(e=>e.binding==='zmanim').zmanKeys;
const specs=[
 {id:'d_daily_air',name:'לוח היום · אור וקו',bg:'#f3f5f1',ink:'#163a3b',accent:'#538378',fill:'#ffffff',font:'heebo',positions:[[4,25,29,65],[36,25,27,65],[66,25,30,30],[66,60,30,30]]},
 {id:'d_daily_noir',name:'לוח היום · דקו חצות',bg:'#101923',ink:'#f5e7c7',accent:'#c6a669',fill:'#172637',font:'frank',frame:'catalog-artdeco-frame.png',positions:[[66,25,30,65],[4,25,28,65],[35,25,28,30],[35,60,28,30]]},
 {id:'d_daily_stone',name:'לוח היום · אבן ואור',bg:'#eee5d6',ink:'#443b2b',accent:'#a78b54',fill:'#fffaf0',font:'david',background:'catalog-hall-stone-background.png',positions:[[4,25,30,65],[66,25,30,65],[37,25,26,30],[37,60,26,30]]},
];
for(const s of specs){
 const d=structuredClone(base);d.id=s.id;d.name=s.name;
 d.colours={'--tv-text':s.ink,'--tv-accent':s.accent};
 const es=[];
 const add=(name,kind,x,y,width,height,extra={})=>es.push({id:s.id+'_part_'+es.length,name,kind,x,y,width,height,color:s.accent,fill:'transparent',text:'',image:'',fontSize:2.4,font:s.font,opacity:1,rotation:0,locked:false,hidden:false,group:null,...extra});
 add('רקע '+s.name.split(' · ')[1],s.background?'image':'box',0,0,100,100,{fill:s.bg,color:s.bg,...(s.background?{image:'/new-shul-assets/'+s.background,crop:{x:0,y:0,width:100,height:100}}:{})});
 add('שם בית הכנסת','text',40,4,55,7,{color:s.ink,binding:'title',fontSize:3.8});
 add('שעון חי','text',4,4,25,8,{color:s.ink,binding:'clock',fontSize:6});
 add('תאריך עברי','text',52,13,43,4,{color:s.ink,binding:'date',fontSize:2});
 add('פרשת השבוע','text',4,14,29,4,{color:s.ink,binding:'parasha',fontSize:2});
 add('ברכת היום','text',34,18,32,5,{color:s.ink,text:'תורה • תפילה • קהילה',fontSize:2.3});
 for(const [i,binding,title] of [[0,'zmanim','זמני היום'],[1,'prayers','זמני תפילות'],[2,'announcements','הודעות'],[3,'lessons','שיעורי תורה']]){
  const [x,y,w,h]=s.positions[i];
  const inset=s.frame?2:1;
  add('מילוי '+title,'box',x+inset,y+inset,w-inset*2,h-inset*2,{color:s.fill,fill:s.fill});
  add('מסגרת '+title,s.frame?'image':'frame',x,y,w,h,s.frame?{image:'/new-shul-assets/'+s.frame,crop:{x:0,y:0,width:100,height:100}}:{});
  const tallArt=s.frame&&h>40;
  add('כותרת '+title,'text',x+3,y+(tallArt?7:4),w-6,5,{color:s.ink,text:title,fontSize:2.6});
  add('תוכן '+title,'text',x+3,y+(tallArt?17:12),w-6,h-(tallArt?26:17),{color:s.ink,binding,fontSize:binding==='zmanim'?1.8:2.3,rowsPerPage:binding==='zmanim'?13:binding==='prayers'?6:2,...(binding==='zmanim'?{zmanKeys:keys}:{})});
 }
 add('פרשה ולימוד יומי','text',5,94,90,4,{binding:'footer',color:s.ink,fontSize:1.6});
 add('קו כותרת שמאל','box',4,21,26,.6,{color:s.accent,fill:s.accent});
 add('קו כותרת ימין','box',70,21,26,.6,{color:s.accent,fill:s.accent});
 // Minimum persisted element height is 1%; use it explicitly.
 es.slice(-2).forEach(e=>e.height=1);
 d.values.elements=es;c.designs=c.designs.filter(x=>x.id!==d.id);c.designs.push(d);
 c.parts=c.parts.filter(p=>p.designId!==d.id);
 for(const e of es)c.parts.push({id:'catalog_'+e.id,name:e.name,designId:d.id,elements:[structuredClone(e)],note:e.kind==='image'?'תמונה נפרדת — כוונון גוון, רוויה ובהירות':'חלק עצמאי — מיקום, גודל וצבע ניתנים לעריכה'});
}
fs.writeFileSync(file,JSON.stringify(c,null,2)+'\n');console.log({designs:c.designs.length,parts:c.parts.length});
