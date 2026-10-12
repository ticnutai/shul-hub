// Idempotent catalogue extension. Every new composition also exports every layer.
const fs=require('node:fs');
const path='public/new-shul-catalog.json';
const catalog=JSON.parse(fs.readFileSync(path,'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const antique=catalog.designs.find(d=>d.id==='d_rc_antique');
const specs=[
 ['d_rc_sapphire_hall','ראש חודש · ארמון הספיר','d_rc_antique','catalog-rc-sapphire-hall.png'],
 ['d_rc_ivory_moon','ראש חודש · פנינת הלילה','d_hall_ivory','catalog-hall-ivory-background.png'],
 ['d_rc_lunar_library','ראש חודש · ספריית אור הלבנה','d_hall_ivory','catalog-salonwalnut-background.png'],
];
for(const [id,name,base,bg] of specs){
 const d=clone(catalog.designs.find(d=>d.id===base));d.id=id;d.name=name;
 d.values.elements.forEach((e,i)=>{e.id=id+'_layer_'+i;e.locked=false;e.hidden=false;e.group=null;});
 const elements=d.values.elements;
 elements[0].image='/new-shul-assets/'+bg;
 elements[0].name='רקע '+name.split(' · ')[1];
 if(base!=='d_rc_antique'){
  const moon=clone(antique.values.elements.find(e=>e.id==='rc_antique_moon'));
  Object.assign(moon,{id:id+'_moon',x:47.2,y:16,width:5.6,height:10,opacity:1});elements.push(moon);
  const greeting=clone(antique.values.elements.find(e=>e.id==='rc_antique_greeting'));
  Object.assign(greeting,{id:id+'_greeting',x:34,y:26.5,width:32,height:4,fontSize:2.5,color:base==='d_hall_ivory'?'#6b4a20':'#fff0c8'});elements.push(greeting);
 }
 if(id==='d_rc_lunar_library'){
  // Put the tall panels on the left and centre, and stack smaller panels on the right.
  for(const e of elements){
   if(/זמני תפילות/.test(e.name))e.x-=32;
   if(/הודעות|שיעורי תורה/.test(e.name))e.x+=32;
   if(['title','clock','date','parasha','footer'].includes(e.binding))e.color='#fff0c8';
  }
  const moon=elements.find(e=>e.id===id+'_moon');moon.x=79.2;
  const greeting=elements.find(e=>e.id===id+'_greeting');greeting.x=66;greeting.color='#fff0c8';
 }
 for(const e of elements)if(e.name.startsWith('ירח טבעי'))e.image='/new-shul-assets/catalog-rc-real-moon.png';
 catalog.designs=catalog.designs.filter(x=>x.id!==id);catalog.designs.push(d);
 catalog.parts=catalog.parts.filter(p=>p.designId!==id);
 for(const e of elements)catalog.parts.push({id:'catalog_'+e.id,name:e.name,designId:id,elements:[clone(e)],note:e.kind==='image'?'שכבת תמונה עצמאית; העיטורים שבתוכה אינם וקטורים נפרדים':'חלק עצמאי לעריכה'});
}
fs.writeFileSync(path,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({designs:catalog.designs.length,parts:catalog.parts.length,added:specs.map(s=>s[0])}));
