const fs=require('node:fs');
const file='public/new-shul-catalog.json';
const c=JSON.parse(fs.readFileSync(file,'utf8'));
const source=c.designs.find(d=>d.id==='d_rc_ivory_moon');
const stars=c.designs.find(d=>d.id==='d_rc_antique').values.elements.filter(e=>e.name.startsWith('נקודת אור'));
for(const [suffix,label,smallSide] of [['balanced','סימטרית','center'],['right','הודעות מימין','right'],['left','הודעות משמאל','left']]){
 const d=JSON.parse(JSON.stringify(source));d.id='d_rc_moon_crown_'+suffix;d.name='ראש חודש · כתר הלבנה — '+label;
 const es=d.values.elements;
 es[0].image='/new-shul-assets/catalog-rc-sapphire-hall.png';es[0].name='רקע היכל כתר הלבנה';
 for(const e of es){
  e.locked=false;e.hidden=false;e.group=null;
  if(['title','date','clock','parasha','footer'].includes(e.binding)||e.name==='ברכת ראש חודש')e.color='#fff0c8';
  if(smallSide==='right'){
   if(/זמני תפילות/.test(e.name))e.x-=32;
   if(/הודעות|שיעורי תורה/.test(e.name))e.x+=32;
  }
  if(smallSide==='left'){
   if(/זמני היום/.test(e.name))e.x+=32;
   if(/הודעות|שיעורי תורה/.test(e.name))e.x-=32;
  }
  if(e.name.startsWith('ירח טבעי'))e.x=smallSide==='right'?79.2:smallSide==='left'?15.2:47.2;
  if(e.name==='ברכת ראש חודש')e.x=smallSide==='right'?66:smallSide==='left'?2:34;
 }
 for(const star of stars){const e=JSON.parse(JSON.stringify(star));e.y=20;e.x=[8,28,72,92][es.filter(x=>x.name.startsWith('נקודת אור')).length];e.opacity=.4;es.push(e);}
 es.forEach((e,i)=>e.id=d.id+'_part_'+i);
 c.designs=c.designs.filter(x=>x.id!==d.id);c.designs.push(d);
 c.parts=c.parts.filter(p=>p.designId!==d.id);
 for(const e of es)c.parts.push({id:'catalog_'+e.id,name:e.name,designId:d.id,elements:[structuredClone(e)],note:e.kind==='image'?'תמונה עצמאית; גילופים בתוך התמונה אינם נפרדים':'חלק עצמאי לעריכה'});
}
fs.writeFileSync(file,JSON.stringify(c,null,2)+'\n');
console.log({designs:c.designs.length,parts:c.parts.length});
