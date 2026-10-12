const fs=require('node:fs'),file='public/new-shul-catalog.json';
const c=JSON.parse(fs.readFileSync(file,'utf8'));
for(const [id,name,frame,bg] of [
 ['d_rc_silver_leaves','ראש חודש · היכל עלי הכסף','catalog-silver-acanthus-frame.png','catalog-hall-ivory-background.png'],
 ['d_rc_walnut_vines','ראש חודש · היכל גפני האגוז','catalog-walnut-vine-frame.png','catalog-salonwalnut-background.png'],
]){
 const d=structuredClone(c.designs.find(d=>d.id==='d_rc_moon_crown_balanced'));d.id=id;d.name=name;
 const es=d.values.elements;es[0].image='/new-shul-assets/'+bg;es[0].name='רקע '+name.split(' · ')[1];
 for(const e of es){
  if(e.name.startsWith('מסגרת ')){e.image='/new-shul-assets/'+frame;e.crop={x:0,y:0,width:100,height:100};delete e.sourceMask;}
  if(e.name.startsWith('מילוי ')){
   e.kind='box';e.image='';e.fill='#fff5dc';e.color='#fff5dc';e.x+=2;e.y+=4;e.width-=4;e.height-=8;delete e.crop;delete e.sourceMask;
   if(id==='d_rc_walnut_vines')e.archFill=true;
  }
  if(id==='d_rc_silver_leaves'&&(['title','date','clock','parasha','footer'].includes(e.binding)||e.name==='ברכת ראש חודש'))e.color='#463823';
 }
 es.forEach((e,i)=>e.id=id+'_part_'+i);
 c.designs=c.designs.filter(x=>x.id!==id);c.designs.push(d);c.parts=c.parts.filter(p=>p.designId!==id);
 for(const e of es)c.parts.push({id:'catalog_'+e.id,name:e.name,designId:id,elements:[structuredClone(e)],note:e.kind==='image'?'תמונה נפרדת עם כוונון גוון, רוויה ובהירות':'חלק עצמאי עם עריכת צבע'});
}
fs.writeFileSync(file,JSON.stringify(c,null,2)+'\n');console.log({designs:c.designs.length,parts:c.parts.length});
